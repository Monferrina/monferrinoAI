# Checklist run — Monferrino

Cosa l'agente verifica/registra a ogni esecuzione. **Ogni run logga su Supabase** (NON Notion): tabella di log con timestamp, tipo run, azioni proposte, decisioni, esito, supervisione umana (per AI Act).

## Run settimanale (leggera)
- [x] Keep-alive Supabase (`.github/workflows/keepalive.yml`, lunedì → evita pausa progetto free).
- [ ] Health check sito: home + pagine chiave raggiungibili (status, tempo).
- [ ] Log esito su Supabase.

## Run mensile (completa)
- [x] Ingest competitor → `competitor_snapshots` (`.github/workflows/ingest.yml`, 1° del mese, scrape→embed→insert idempotente).
- [ ] Scrape sito live (stato corrente, prima di ogni analisi).
- [x] Competitor: Firecrawl `monitor` (AI-judge) su 7 domini / 30 pagine → diff contenuti. Vedi [`monitor/README.md`](monitor/README.md).
- [ ] Drift SEO sulle pagine chiave (regressioni meta/heading/schema).
- [ ] CrUX snapshot (PageSpeed Insights API) → Supabase.
- [ ] Blog: 1 articolo (research fonti → write → `humanizer` → schema/SEO check).
- [ ] llms.txt: micro-PR di aggiornamento dopo pubblicazione blog.
- [ ] Digest email (Resend) a Giuseppe + Martina.
- [ ] Log completo su Supabase (azioni, decisioni, oversight).

## Ingest iniziale (una tantum, prima dei run a regime)
- [x] **SAMRUSH ingerito (29/6)** → tabelle `seo_keywords` (489 kw: vol/KD/cpc/cluster/source + target_page/intent/is_noise/content_type/status) e `seo_rankings` (37: 16 nostre + 21 vetrariacasalese.it). Dati strutturati, no embedding. Le 10 analisi `.md` restano da embeddare (Voyage) solo quando si definisce il retrieval RAG per il blog.
- [x] **Check sito live (29/6, firecrawl map):** 17 pagine servizio + 8 blog GIÀ LIVE (i pillar dei report sono pubblicati). Strategia confermata fattibile; slug `target_page` validati sui path reali.
- [ ] ~~Leggere e ingerire i documenti da `~/Desktop/SAMRUSH/`~~ (fatto sopra):
  - 46 CSV export Semrush (`*_pages_*`, `*_issues_*`, `*_mega_export_*`, structured data, keyword/backlink).
  - 10 analisi `.md` già prodotte (ANALISI_SEO, BACKLINK_E_OPPORTUNITA, PIANO_AEO, ONPAGE_IDEAS, MAPPA_PAGINE_KEYWORD, ROUND5_SINTESI…).
  - `ideas_*.xlsx` (keyword ideas), PDF listing management, dump API in `api_20260623/` e `api_20260624/`.
  - → derivare: priorità keyword/AEO, gap di contenuto, issue tecniche del sito; embeddare i testi rilevanti (Voyage) come contesto per la generazione blog.
  - ⚠️ Schema della/e tabella/e: **schema-from-data** — osservare le colonne reali dei CSV prima di progettare (come fatto per `competitor_snapshots`).

## Note
- Schema della tabella di log: **da definire dopo il primo test reale** (schema-from-data, vedi `brief.md`).
- GBP/NAP check mensile: DOVE gira è da decidere (il sito ha già la Places key — non duplicarla).
- **Monitor competitor attivo**: `firecrawl monitor` id `019f1363-7672-736b-af55-3e04baad06fd`, **30 pagine su 7 domini** (post-analisi 12 mappe, +skyglass blog +vercellivetri blog), cron mensile `0 9 1 * *` Europe/Rome, **~60 cr/check** (AI-judge ≈2x). Config versionata in `monitor/`. Notifiche da collegare (webhook/email col digest Resend).
