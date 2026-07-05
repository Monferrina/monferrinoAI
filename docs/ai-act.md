# MonferrinoSEO — Documentazione tecnica AI Act

> Documentazione tecnica del sistema di IA a supporto della conformità al
> Regolamento (UE) 2024/1689 (AI Act). Base per la revisione legale (DPIA/FRIA).
>
> **Ultimo aggiornamento:** 2026-07-04 · **Scadenza compliance target:** 2026-08-02

## 1. Identificazione del sistema

- **Nome:** MonferrinoSEO (agente IA — repo `Monferrina/monferrinoAI`).
- **Titolare:** Vetreria Monferrina.
- **Finalità:** far crescere la visibilità organica e le citazioni AI del sito
  `vetreriamonferrina.com` tramite interventi piccoli e verificabili (micro-PR di
  contenuto SEO/AEO, monitoraggio competitor, digest periodici).
- **Principio operativo:** *l'agente propone e documenta, l'umano supervisiona e
  approva.* Nessuna modifica va in produzione senza revisione umana.

## 2. Classificazione del rischio

Il sistema **non** rientra tra le pratiche vietate (art. 5) né tra i sistemi ad
alto rischio dell'Allegato III (non tratta biometria, occupazione, credito,
servizi essenziali, giustizia, ecc.). È uno strumento di supporto al marketing
con output testuali sempre mediati da revisione umana.

Rientra negli **obblighi di trasparenza** (art. 50) per i contenuti generati o
assistiti dall'IA. Il progetto adotta comunque, in via cautelativa e proporzionata,
misure tipiche dei sistemi ad alto rischio (documentazione tecnica, logging delle
attività, oversight umano) per robustezza e tracciabilità.

> La classificazione definitiva e l'eventuale DPIA/FRIA sono **rimandate alla
> valutazione legale** (vedi §8).

## 3. Descrizione del sistema

### 3.1 Componenti

| Componente | Ruolo | Tecnologia |
|-----------|-------|-----------|
| Ingest competitor | Scrape periodico pagine competitor → embed → DB | `scripts/ingest-competitors.mjs`, Firecrawl, Voyage |
| Ingest sito | Scrape pagine proprie → embed → DB (RAG) | `scripts/ingest-site.mjs` |
| Monitor competitor | Rilevamento cambi pagine (Firecrawl monitor) | monitor id `019f1363-…`, cron mensile |
| Store / RAG | Snapshot + embedding vettoriali | Supabase Postgres + pgvector |
| Digest | Report periodico via email | `scripts/digest.mjs`, Resend |
| Registro attività | Log delle operazioni automatiche | tabella `public.ai_run_log` |
| Backup | Dump schema su object storage | `scripts/backup-db.sh`, Cloudflare R2 |

### 3.2 Flusso dati (input → output)

- **Input:** contenuti web pubblici (pagine competitor e proprie), keyword da
  strumenti SEO, dati di posizionamento.
- **Elaborazione:** scrape → normalizzazione/validazione (`src/snapshot.mjs`) →
  embedding (Voyage) → recupero semantico (RAG) → generazione di proposte di
  contenuto on-page.
- **Output:** **Pull Request** sul repo del sito con arricchimenti di contenuto
  (mai auto-merge) + digest informativi. Nessuna decisione automatizzata con
  effetti giuridici su persone.

### 3.3 Livello di autonomia

- Oggi: **assistito**. Le PR sono aperte in sessione interattiva con revisione
  contestuale; il merge è sempre umano.
- Futuro (Tier B, **non ancora costruito**): workflow headless che *apre* PR in
  autonomia — comunque **senza mai fare merge**. Vincoli previsti: token
  short-lived (GitHub App, no PAT), least-privilege sul solo repo sito, gate di
  revisione umana obbligatorio, budget per run limitato.

## 4. Sorveglianza umana (art. 14)

- **Human gate su OGNI PR:** nulla arriva in produzione senza approvazione umana
  esplicita (merge manuale). È la mitigazione chiave, già in atto.
- Rimozione dell'auto-merge dai workflow automatici (es. aggiornamento recensioni):
  le PR restano aperte in attesa di revisione.
- Anti prompt-injection: i dati esterni (scrape, DB) sono trattati come **non
  fidati**; non vengono eseguite istruzioni contenute nei contenuti raccolti.

## 5. Registro delle attività (art. 12 — logging)

Tabella `public.ai_run_log` (Supabase), popolata da ogni job automatico:

| Colonna | Contenuto |
|--------|-----------|
| `job` | operazione (`ingest-competitors`, `ingest-site`, `digest`, futura `seo-pr`) |
| `status` | `ok` \| `error` |
| `summary` | esito leggibile |
| `meta` | contatori strutturati (jsonb) |
| `started_at` / `finished_at` | finestra temporale del run |

Il logging è **non bloccante** (`src/ai-log.mjs`): un errore di registrazione non
fa mai fallire il job tracciato. RLS abilitata + forzata + `revoke` su anon/auth
(nessun accesso via API pubblica).

## 6. Dati e privacy

- I contenuti raccolti sono **pagine web pubbliche**. Non è finalità del sistema
  trattare dati personali.
- Le recensioni Google mostrate sul sito sono aggregati pubblici; l'`aggregateRating`
  self-serving è stato rimosso dallo structured data (scelta SEO + prudenza).
- Segreti (chiavi API, credenziali DB) solo in `.env.local`/GitHub Secrets, mai in
  codice o in chat. TLS in transito verso il DB in modalità **verify-full** (CA
  Supabase pinnata).

### 6.1 Posture di conformità della pipeline Firecrawl

- **GDPR — minimizzazione PII.** Il markdown scrapato è redatto (`redact()` in
  `src/fetchers.mjs`) **prima** di embedding, storage e hash di dedup: la redazione
  avviene una sola volta in `toSnapshot` (`src/snapshot.mjs`), unico punto in cui si
  costruisce `content_md`, e copre così sia competitor sia sito. Maschera email e
  telefoni italiani via regex (`[email]` / `[tel]`). Lo scrape usa
  `--only-main-content`, che già scarta nav/footer (dove si annidano recapiti).
  *Ceiling:* i nomi propri **non** sono coperti (servirebbe un NER) — accettabile per
  pagine competitor B2B di edilizia; si valuterà un NER solo se un audit lo richiede.
- **TDM / Copyright (art. 4 Dir. UE 2019/790).** Firecrawl cloud rispetta il
  `robots.txt` di default (non disabilitato). La lista URL è **curata** dal monitor
  (pagine pubbliche, nessun crawl largo): nessun bypass di login, paywall o CAPTCHA,
  nessun aggiramento di barriere tecniche o opt-out. I dati servono ad analisi di
  **keyword-gap** (uso lecito), non a replicare o ripubblicare i contenuti altrui.
  *Nota:* la CLI Firecrawl non espone un flag di User-Agent personalizzato, quindi
  non è impostato; il rispetto del robots resta garantito lato servizio.
- **AI Act — rischio minimo.** Uso interno esclusivo (audit SEO), output sempre
  mediati da revisione umana: nessun impatto sui diritti degli interessati.

## 7. Gestione del rischio e mitigazioni

| Rischio | Mitigazione |
|--------|-------------|
| Contenuto errato/allucinato in produzione | Human gate su ogni PR + test/gate CI |
| Prompt injection da contenuti scrapati | Dati esterni non fidati, nessuna esecuzione di istruzioni |
| Inquinamento del RAG | Validazione snapshot + scarto pagine 4xx/5xx prima dell'embed |
| Fallimenti silenziosi dei job | Soglie minime di successo + niente `|| echo`, cron monitorati |
| Accesso non autorizzato ai dati | RLS su tutte le tabelle, secret gestiti, backup cifrati |
| Perdita di tracciabilità | Registro `ai_run_log` di tutte le operazioni |

## 8. Stato compliance e prossimi passi

| Voce | Stato |
|------|-------|
| Documentazione tecnica del sistema | ✅ questo documento |
| Registro attività AI (log su Supabase) | ✅ `ai_run_log` attivo |
| Sorveglianza umana su output | ✅ human gate su ogni PR |
| Trasparenza contenuti AI (art. 50) | ⏳ da formalizzare (disclosure) |
| Classificazione definitiva del rischio | ⏳ **valutazione legale** |
| DPIA + FRIA | ⏳ **supporto legale** (entro 2026-08-02) |

> **Nota normativa:** monitorare il *Digital Omnibus* — possibile proroga degli
> obblighi alto-rischio (ipotesi 2027-12-02), non ancora in vigore. La scadenza di
> riferimento resta 2026-08-02 finché non diversamente disposto.

## 9. Riferimenti

- Regolamento (UE) 2024/1689 (AI Act) — art. 5, 12, 14, 50, Allegato III.
- Repo sistema: `Monferrina/monferrinoAI` · Sito: `vetreriamonferrina.com`.
- Brief e checklist operativa: `brief.md`, `checklist.md`.
