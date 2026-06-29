# Checklist run — Monferrino

Cosa l'agente verifica/registra a ogni esecuzione. **Ogni run logga su Supabase** (NON Notion): tabella di log con timestamp, tipo run, azioni proposte, decisioni, esito, supervisione umana (per AI Act).

## Run settimanale (leggera)
- [ ] Keep-alive Supabase (una query → evita pausa progetto free).
- [ ] Health check sito: home + pagine chiave raggiungibili (status, tempo).
- [ ] Log esito su Supabase.

## Run mensile (completa)
- [ ] Scrape sito live (stato corrente, prima di ogni analisi).
- [ ] Competitor: Firecrawl `changeTracking` sui 6 domini → diff contenuti.
- [ ] Drift SEO sulle pagine chiave (regressioni meta/heading/schema).
- [ ] CrUX snapshot (PageSpeed Insights API) → Supabase.
- [ ] Blog: 1 articolo (research fonti → write → `humanizer` → schema/SEO check).
- [ ] llms.txt: micro-PR di aggiornamento dopo pubblicazione blog.
- [ ] Digest email (Resend) a Giuseppe + Martina.
- [ ] Log completo su Supabase (azioni, decisioni, oversight).

## Note
- Schema della tabella di log: **da definire dopo il primo test reale** (schema-from-data, vedi `brief.md`).
- GBP/NAP check mensile: DOVE gira è da decidere (il sito ha già la Places key — non duplicarla).
