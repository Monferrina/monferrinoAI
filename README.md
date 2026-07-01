# monferrinoAI 🤖

[![Checkly](https://github.com/Monferrina/monferrinoAI/actions/workflows/checkly.yml/badge.svg)](https://github.com/Monferrina/monferrinoAI/actions/workflows/checkly.yml)
[![Keep-alive](https://github.com/Monferrina/monferrinoAI/actions/workflows/keepalive.yml/badge.svg)](https://github.com/Monferrina/monferrinoAI/actions/workflows/keepalive.yml)
[![Ingest](https://github.com/Monferrina/monferrinoAI/actions/workflows/ingest.yml/badge.svg)](https://github.com/Monferrina/monferrinoAI/actions/workflows/ingest.yml)

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![pgvector](https://img.shields.io/badge/pgvector-RAG-4169E1?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Voyage AI](https://img.shields.io/badge/Voyage_AI-embeddings-5A3FFF)](https://www.voyageai.com)
[![Firecrawl](https://img.shields.io/badge/Firecrawl-scraping-FF6B35)](https://www.firecrawl.dev)
[![Checkly](https://img.shields.io/badge/Checkly-monitoring-3A52EE)](https://www.checklyhq.com)

[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-scheduled-2088FF?logo=githubactions&logoColor=white)](https://github.com/Monferrina/monferrinoAI/actions)
[![CodeQL](https://img.shields.io/badge/CodeQL-security-2088FF?logo=github&logoColor=white)](https://codeql.github.com)
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-025E8C?logo=dependabot&logoColor=white)](https://github.com/Monferrina/monferrinoAI/network/updates)
[![License](https://img.shields.io/badge/License-All_Rights_Reserved-red)](https://github.com/Monferrina/monferrinoAI)

---

**Monferrino** è l'agente IA schedulato a supporto di **[vetreriamonferrina.com](https://vetreriamonferrina.com)**: cura SEO/AEO e contenuti, ingerisce l'attività dei competitor in un knowledge base RAG e monitora in continuo lo stato del sito. Gira interamente su **GitHub Actions** (nessun server da mantenere) con **Supabase** come memoria.

## Architettura

```mermaid
flowchart TD
    subgraph GHA["⏱️ GitHub Actions — scheduled"]
        KA["keep-alive<br/>(settimanale)"]
        ING["ingest competitor<br/>(mensile)"]
        CHK["checkly<br/>(su PR / push main)"]
    end

    subgraph PIPE["Pipeline — Node.js ESM"]
        KEEP["keepalive.mjs"]
        HEALTH["healthcheck.mjs"]
        HEART["heartbeat<br/>→ branch 'heartbeat'"]
        INGEST["ingest-competitors.mjs"]
        INGSITE["ingest-site.mjs"]
    end

    subgraph EXT["Servizi esterni"]
        FC["Firecrawl<br/>scraping competitor"]
        VOY["Voyage AI<br/>embeddings"]
        CL["Checkly<br/>monitoring SEO"]
    end

    subgraph DB["🗄️ Supabase — Postgres + pgvector"]
        SNAP["competitor_snapshots"]
        SITEPG["site_pages<br/>(KB proprio sito)"]
        RAG["RAG store<br/>(embeddings)"]
    end

    SITE["🌐 vetreriamonferrina.com"]
    AGENT["🤖 Agente claude-seo<br/>→ micro-PR sul sito"]

    KA --> KEEP --> DB
    KA --> HEALTH --> SITE
    KA --> HEART
    ING --> INGEST --> FC --> VOY --> RAG
    INGEST --> SNAP
    INGSITE --> FC
    SITE --> INGSITE --> SITEPG
    CHK --> CL --> SITE
    RAG -. contesto SEO .-> AGENT
    SITEPG -. "cosa esiste già" .-> AGENT
    AGENT -. PR enrichment .-> SITE
```

## Tech Stack

| Categoria          | Tecnologia                                                  |
| ------------------ | ----------------------------------------------------------- |
| Runtime            | Node.js 22 (ESM, zero-build)                                |
| Database / memoria | Supabase — PostgreSQL                                        |
| RAG                | pgvector + embeddings **Voyage AI**                         |
| Web scraping       | Firecrawl (snapshot competitor)                             |
| Monitoring         | Checkly — monitoring-as-code (SEO health, daily)            |
| Scheduling / CI    | GitHub Actions (cron settimanale + mensile)                 |
| Sicurezza          | CodeQL, Dependabot, secret scanning, ruleset `protect-main` |
| Test               | `node:test` (unit + integration su DB reale)                |

## Struttura

```
.
├── src/
│   ├── db.mjs                  # accesso Supabase (pg) + insert idempotente
│   ├── fetchers.mjs            # scrape (Firecrawl) + embed (Voyage) condivisi
│   └── snapshot.mjs            # normalizzazione snapshot (competitor + sito)
├── scripts/
│   ├── ingest-competitors.mjs  # scraping Firecrawl → embeddings → competitor_snapshots
│   ├── ingest-site.mjs         # scraping proprio sito → embeddings → site_pages (KB)
│   ├── keepalive.mjs           # ping DB (evita pausa Supabase free 7gg)
│   ├── healthcheck.mjs         # health check del sito
│   └── e2e.mjs                 # test end-to-end
├── __checks__/
│   └── seo.check.ts            # monitor Checkly (gruppo Agent-MonferrinoAI)
├── checkly.config.ts
└── .github/
    ├── workflows/              # keepalive · ingest · checkly
    └── dependabot.yml
```

## Workflow schedulati

| Workflow    | Quando              | Cosa fa                                                                       |
| ----------- | ------------------- | ----------------------------------------------------------------------------- |
| `keepalive` | settimanale (lun)   | ping Supabase + health check sito + **heartbeat** (anti-disattivazione 60gg)  |
| `ingest`    | mensile (1°)        | scraping competitor → `competitor_snapshots` + embeddings RAG                 |
| `checkly`   | su PR / push `main` | valida i monitor sulle PR, li deploya su Checkly al merge                      |

> I workflow schedulati girano **solo sul default branch**. Su repo pubblico GitHub li disabilita dopo 60gg di inattività: il keep-alive committa un **heartbeat** su un branch dedicato per mantenere il repo attivo.

## Sviluppo

Requisiti: **Node.js ≥ 22**, **npm ≥ 10**. Segreti in `.env.local` (mai committati).

```bash
npm ci
npm test              # unit + integration (node:test)
npm run healthcheck   # health check del sito
npm run ingest        # ingest competitor (consuma quota Firecrawl/Voyage)
npm run checkly:test  # valida i monitor Checkly
```

## Sicurezza

Policy di segnalazione vulnerabilità in [`SECURITY.md`](./SECURITY.md). Segreti solo in GitHub Secrets / `.env.local`; token dei workflow in sola lettura (least privilege); `main` protetto (solo PR squash, check CodeQL obbligatorio).

## Licenza

All Rights Reserved © Vetreria Monferrina di Fioravanti Giuseppe — Casale Monferrato (AL).
