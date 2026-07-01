# Contributing

Grazie per l'interesse in **monferrinoAI**. Il progetto è l'agente IA schedulato a supporto di [vetreriamonferrina.com](https://vetreriamonferrina.com): gira su GitHub Actions, con Supabase come memoria.

## Flusso di lavoro

1. **Crea un branch** dal `main`: `git checkout -b tipo/descrizione`
2. **Fai le modifiche** seguendo le convenzioni del progetto
3. **Esegui i test**: `npm test`
4. **Committa** con messaggi chiari (Conventional Commits)
5. **Apri una Pull Request** verso `main`

> `main` è protetto dal ruleset `protect-main`: solo PR (squash), history lineare, check CodeQL obbligatori. Niente push diretti.

## Requisiti per le PR

- Tutti i test passano (`npm test` — `node:test`, unit + integration su DB reale).
- Una PR per feature/fix, descritta chiaramente.
- Nessun segreto nel diff: API key e token solo in `.env.local` / GitHub Secrets.

## Convenzioni

- **Commit**: [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `chore:`, `docs:`, …).
- **Branch**: `tipo/descrizione` (es. `feat/drift-check`, `chore/ci-hardening`).
- **Lingua**: codice e commenti in italiano/inglese coerenti col file; contenuti utente in italiano.

## Setup locale

Requisiti: **Node.js ≥ 22**, **npm ≥ 10**.

```bash
npm ci
cp .env.example .env.local   # popola i segreti (mai committati)
npm test                     # unit + integration
npm run healthcheck          # health check del sito
```

Vedi il [README](README.md) per architettura e workflow schedulati.

## Sicurezza

Per vulnerabilità **non aprire issue pubbliche**: segui la [Security Policy](SECURITY.md).
