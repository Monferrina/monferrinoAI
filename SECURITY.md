# Security Policy

## Segnalare una vulnerabilità

Per segnalare un problema di sicurezza in **monferrinoAI**, usa il canale **privato** di GitHub:

1. Vai sulla tab **Security** della repo → **Report a vulnerability**
   (Private Vulnerability Reporting è attivo).
2. In alternativa, scrivi a **giuseppefioravanti@proton.me**.

Non aprire issue pubbliche per le vulnerabilità: usa i canali privati sopra.

Cerchiamo di rispondere entro **7 giorni** e di rilasciare una correzione
appena possibile in base alla gravità.

## Cosa rientra

- Esposizione di segreti/credenziali (API key, password DB) nel codice o nei log.
- Falle nei workflow GitHub Actions (es. injection, permessi token eccessivi).
- Problemi nelle dipendenze (gestiti anche da Dependabot: alert + version updates).
- Accessi non autorizzati a Supabase / dati RAG.

## Cosa NON rientra

- Vulnerabilità del sito **vetreriamonferrina.com** (repo separata).
- Servizi di terze parti (Supabase, Checkly, Firecrawl, Voyage AI, Vercel):
  segnala ai rispettivi programmi di sicurezza.

## Buone pratiche già adottate

- Segreti solo in GitHub Secrets / `.env.local`, mai in chiaro nel repo.
- Token di default dei workflow in sola lettura (least privilege).
- Branch `main` protetto (ruleset `protect-main`): solo PR squash, con check CodeQL obbligatori.
- Secret scanning e Dependabot security updates attivi.
