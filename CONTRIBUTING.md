# Contributing

Grazie per l'interesse in monferrinoAI. Il progetto è l'agente schedulato a supporto di
[vetreriamonferrina.com](https://vetreriamonferrina.com): gira su GitHub Actions, con Supabase
come memoria.

## Flusso di lavoro

1. Crea un branch dal `main`, con `git checkout -b tipo/descrizione`.
2. Fai le modifiche seguendo le convenzioni del progetto.
3. Esegui in locale i tre gate della CI descritti sotto, non solo i test.
4. Committa con messaggi chiari, in Conventional Commits.
5. Apri una Pull Request verso `main`.

`main` è protetto dal ruleset `protect-main`: solo PR in squash, history lineare, check
obbligatori. Niente push diretti.

## I tre gate della CI

`.github/workflows/ci.yml` fa fallire la PR su uno qualsiasi di questi tre step, in
quest'ordine. Vanno eseguiti tutti prima di aprire la PR, perché `npm test` da solo ne copre uno
su tre e la CI può diventare rossa per motivi che in locale non si sono mai visti.

```bash
npm audit --audit-level=high   # nessuna vulnerabilita' nota di livello high o superiore
npm run lint                   # eslint su tutto il repo
npm test                       # node --test: unit e integration
```

L'integration test si auto-skippa se i secret del database non sono presenti, per esempio nelle
PR da fork, quindi la CI resta verde anche senza credenziali. L'end-to-end (`npm run test:e2e`)
non gira in CI perché consuma crediti Firecrawl e Voyage: si lancia a mano quando serve.

## Requisiti per le PR

- I tre gate sopra passano in locale.
- Una PR per feature o per fix, descritta chiaramente.
- Nessun segreto nel diff: chiavi API e token stanno solo in `.env.local` o nei GitHub Secrets.

## Convenzioni

I messaggi di commit seguono [Conventional Commits](https://www.conventionalcommits.org/), con i
prefissi `fix:`, `feat:`, `chore:`, `docs:`. I branch si chiamano `tipo/descrizione`, per esempio
`feat/drift-check` o `chore/ci-hardening`. Codice e commenti restano coerenti con la lingua del
file in cui stanno; i contenuti destinati a un lettore sono in italiano.

## Setup locale

Servono Node.js 22 o superiore (`engines.node` in `package.json`) e npm 10 o superiore.

```bash
npm ci
npm run lint
npm test
npm run healthcheck          # health check del sito
```

Nel repo non esiste un file `.env.example` da copiare. I segreti vanno scritti a mano in
`.env.local`, che è ignorato da git; `loadEnv()` in `src/db.mjs` legge prima `process.env` e poi
quel file, così in CI valgono i GitHub Secrets senza alcuna modifica al codice. Queste sono le
chiavi effettivamente lette dagli script.

| Chiave | Serve a |
| --- | --- |
| `SUPABASE_DB_HOST` | connessione Postgres, usata da ogni job |
| `SUPABASE_DB_NAME` | connessione Postgres |
| `SUPABASE_DB_USER` | connessione Postgres |
| `SUPABASE_DB_PASSWORD` | connessione Postgres |
| `SUPABASE_PROJECT_REGION` | compone l'host del pooler, in `src/db.mjs` e in `scripts/backup-db.sh` |
| `VOYAGE_API_KEY` | embeddings dei due ingest e del chunker |
| `RESEND_API_KEY` | invio di digest e briefing |
| `DIGEST_FROM` | mittente delle email, opzionale: senza, vale il default nel codice |
| `DIGEST_TO` | destinatari del digest mensile, csv |
| `BRIEFING_TO` | destinatari del briefing settimanale, csv, con fallback su `DIGEST_TO` |

`scripts/backup-db.sh` ne chiede altre quattro (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`), che servono solo a chi lancia il backup a mano.

Senza credenziali funzionano comunque `npm run lint`, gli unit test e
`npm run briefing -- --dry-run`, che usa dati di esempio e non apre nemmeno la connessione.

Vedi il [README](README.md) per architettura e workflow schedulati.

## Sicurezza

Per le vulnerabilità non aprire issue pubbliche: segui la [Security Policy](SECURITY.md).
