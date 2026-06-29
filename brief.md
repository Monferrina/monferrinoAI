# Brief — Monferrino

Agente IA **schedulato** (non interattivo) per **vetreriamonferrina.com**: SEO/AEO, blog, monitoraggio competitor e salute del sito. Gira via GitHub Actions, scrive su Supabase, riporta via email.

## Obiettivo
Far crescere visibilità organica e citazioni AI del sito, con interventi piccoli e verificabili (micro-PR, digest), senza intervento umano costante. L'umano supervisiona e approva; l'agente propone e documenta.

## Stack
- **RAG / storage:** Supabase Postgres + **pgvector**. (NON Notion.)
- **Embedding:** **Voyage AI** (`voyage-4*`), non Gemini. La dimensione `vector(N)` segue il modello scelto. Vedi wiki `[[voyage-ai]]`.
- **Scrape web:** Firecrawl (skill `firecrawl-*` via CLI) — sito live + `changeTracking` sui competitor.
- **Generazione testo:** Claude (model id correnti, da confermare al momento dell'uso).
- **Scrittura naturale:** skill `humanizer` come step finale sui post del blog.
- **Orchestrazione:** GitHub Actions (cron).
- **Email:** Resend (digest mensile).

## Regole operative (vincolanti)
1. **Scrape del sito live PRIMA di ogni run.** Mai assunzioni su contenuto/struttura: si parte sempre dai dati reali.
2. **Test prima dello schema (schema-from-data).** Lo schema Supabase si deriva DAI dati osservati in un test reale, non si progetta a priori.
3. **Segreti solo in `.env.local` / GitHub secrets repo-level.** Mai in chiaro nei file. Least privilege.
4. **Micro-interventi reversibili.** Modifiche al sito come PR piccole e revisionabili, mai push diretti distruttivi.
5. **Consultare la wiki `monferrina-docs` prima di implementare** qualsiasi componente.

## Cadenza
- **Settimanale (leggera):** keep-alive Supabase + health check del sito.
- **Mensile (completa):** blog + analisi competitor + drift SEO + digest email.

## Principio etico — concorrenza amichevole
⭐ (Giuseppe) I competitor si usano come **ispirazione e per trovare buchi di contenuto**, mai per danneggiarli. Nessuna azione ostile, nessuno scraping aggressivo oltre il necessario per l'analisi.

## Competitor (confermati 27/6)
`vetrariacasalese.it`, `vetreriabs.it`, `nuovavetrariaalessandrinasrl.it`, `vetreriavegal.com`, `vercellivetri.it`, `lanuovavetrinova.it`.

## Stagionalità
Primavera/estate → spingere **box doccia**. Tutto l'anno → **specchi**.

## AI Act (scadenza 2 agosto 2026, non spostabile)
Documentazione tecnica, registro attività AI, DPIA+FRIA con supporto legale, human oversight. Dettagli nella memory `project_ai_act_compliance` del repo sito.
