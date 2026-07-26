# MonferrinoSEO — Documentazione tecnica AI Act

> Documentazione tecnica del sistema di IA a supporto della conformità al
> Regolamento (UE) 2024/1689 (AI Act). Base per la revisione legale (DPIA/FRIA).
>
> **Ultimo aggiornamento:** 2026-07-26 · **Scadenza compliance target:** 2026-08-02

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

### 3.1.1 Inventario dei modelli (*model discovery*)

Un solo modello gira dentro questo repo, e non è generativo.

| Modello | Fornitore | Versione | Cosa fa | Dove | Cosa vede | Cosa può fare |
|---|---|---|---|---|---|---|
| `voyage-4` | Voyage AI | dim **1024** | Embedding testuali (`input_type: document` per la KB, `query` per la ricerca) | `src/fetchers.mjs` → `embed()` | Markdown **già redatto** da `redact()` (email e telefoni mascherati) | Restituire vettori. Nient'altro: non genera testo, non decide, non scrive |

**Nessun modello generativo è presente in questo repository.** Le proposte di
contenuto del §3.2 nascono in **sessione interattiva** con un assistente esterno
(vedi §3.3, livello «assistito»): non esiste in `src/` o `scripts/` alcuna chiamata
a un'API di completion o chat. Chi cerca il confine dell'autonomia lo trova qui —
il repo sa **leggere e ricordare**, non sa **scrivere da solo**.

Firecrawl non è un modello: è uno scraper. Compare in questo inventario solo per
escluderlo esplicitamente, come richiede la pratica di *model discovery* (dichiarare
anche ciò che AI **non** è).

### 3.2 Flusso dati (input → output)

- **Input:** contenuti web pubblici (pagine competitor e proprie), keyword da
  strumenti SEO, dati di posizionamento.
- **Elaborazione:** scrape → normalizzazione/validazione (`src/snapshot.mjs`) →
  embedding (Voyage) → recupero semantico (RAG) → generazione di proposte di
  contenuto on-page.
- **Output:** **Pull Request** sul repo del sito con arricchimenti di contenuto
  (mai auto-merge) + digest informativi. Nessuna decisione automatizzata con
  effetti giuridici su persone.

#### Mappa dati e AI — fonte → tabella → chi legge

Risponde alla domanda che un audit fa per prima: *quali dati alimentano il RAG, da
dove arrivano, e cosa può uscirne.*

| Fonte | Come entra | Dove finisce | Chi la legge | Cosa ne esce |
|---|---|---|---|---|
| Pagine pubbliche del competitor (`vetrariacasalese.it`) | Firecrawl `--only-main-content`, lista URL curata dal monitor | `public.competitor_snapshots` (markdown + embedding 1024) | Recupero semantico in sessione assistita | Analisi di keyword-gap. **Mai** ripubblicazione |
| Pagine pubbliche del sito proprio (`vetreriamonferrina.com`) | `scripts/ingest-site.mjs`, stesso percorso | `public.site_pages` | Idem — serve a sapere «cosa esiste già» | Evita contenuti duplicati nelle proposte |
| Esito dei job automatici | `src/ai-log.mjs` | `public.ai_run_log` | Digest mensile e diagnosi | Report via email (Resend) |

**Tre barriere, tutte prima dello storage e dell'embedding:**

1. `redact()` (`src/fetchers.mjs`) maschera email e telefoni italiani **prima** di
   embed, storage e hash di dedup. *Ceiling dichiarato:* i nomi propri non sono
   coperti — servirebbe un NER (v. §6.1).
2. `scanContent()` (`src/snapshot.mjs`) scarta le pagine con prompt-injection,
   markup attivo o densità di codice anomala: quello che matcha **non entra nel RAG**.
3. La validazione dello snapshot scarta 4xx/5xx prima dell'embedding.

**Chi tratta i dati, fuori di qui:** Firecrawl (scraping), Voyage AI (embedding),
Supabase (storage), Resend (email del digest), Cloudflare R2 (backup cifrati).
Nessuno di questi riceve dati personali di clienti: le richieste di preventivo
vivono sul sito, in un'altra proprietà, e non entrano mai in questa pipeline.

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
  fidati**; non vengono eseguite istruzioni contenute nei contenuti raccolti. La
  barriera non è solo un principio: `scanContent()` (`src/snapshot.mjs`) scarta gli
  snapshot avvelenati **prima** dell'embedding, con test su ogni payload coperto.
- **Verifica di output handling (2026-07-26).** Una review indipendente ha tracciato
  ogni percorso in cui contenuto non fidato potrebbe raggiungere un sink: nessuna
  query SQL è costruita per concatenazione (tutti i valori passano da parametri `$n`),
  nessun output di modello viene consumato programmaticamente, e il digest HTML escapa
  il testo che arriva dal DB. La stessa review ha però trovato un buco reale nel
  guardrail — la frase italiana «ignora **tutte le** istruzioni» sfuggiva alla regex
  perché il gruppo dei determinanti era ripetibile una volta sola — corretto e coperto
  da test di regressione. È il motivo per cui questa riga dice *verificato* e non
  *presumibilmente sicuro*.

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

### 6.0 Retention — cosa si tiene, per quanto, perché

Dichiarata qui perché «per sempre» non è una politica: è l'assenza di una politica.

| Dato | Dove | Per quanto | Perché |
|---|---|---|---|
| Snapshot competitor (`competitor_snapshots`) | Supabase | **24 mesi** dall'ultimo scrape | Servono a vedere come cambiano i contenuti nel tempo; oltre i due anni un confronto SEO non dice più nulla di utile |
| KB del sito proprio (`site_pages`) | Supabase | Finché la pagina esiste; sostituita a ogni ingest | È uno specchio del sito, non un archivio storico |
| Registro attività (`ai_run_log`) | Supabase | **24 mesi** | Tracciabilità delle operazioni automatiche (AI Act art. 12). Allineato agli snapshot per non avere log orfani |
| Backup del DB | Cloudflare R2 | Da **lifecycle rule per prefisso** su R2, non dal codice | Il backup è la rete di sicurezza del free tier Supabase, che non ne fa |
| Log di esecuzione dei workflow | GitHub Actions | Retention di default GitHub (90 giorni) | Diagnosi a breve termine; il registro durevole è `ai_run_log` |

Non ci sono dati personali di clienti in questa pipeline (§3.2), quindi la retention
qui è igiene di ROT — *redundant, obsolete, trivial* — non un obbligo GDPR.

**Ceiling dichiarato:** la pulizia oltre i 24 mesi è **manuale**, non c'è un cron che
la esegue. È una scelta: con volumi di poche centinaia di righe l'automazione
costerebbe più della potatura. Da rivedere se le tabelle crescono di un ordine di
grandezza.

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
| Trasparenza contenuti AI (art. 50) | ✅ disclosure chatbot ("Assistente virtuale automatizzato") sul sito |
| Inventario dei modelli (*model discovery*) | ✅ §3.1.1 — un solo modello, `voyage-4`, non generativo |
| Mappa dati e AI (fonte → tabella → chi legge) | ✅ §3.2 |
| Verifica di output handling | ✅ §4 — review indipendente del 2026-07-26 |
| Retention dichiarata | ✅ §6.0 — pulizia manuale, ceiling dichiarato |
| Classificazione definitiva del rischio | ⏳ **valutazione legale** |
| DPIA + FRIA | ⏳ **supporto legale** (entro 2026-08-02) |
| Disclosure sui contenuti generati pubblicati sul sito | ⏳ **decisione da prendere prima del go-live della generazione** (v. sotto) |

> **La sola azione con una scadenza naturale.** Quando le proposte di contenuto
> inizieranno ad arrivare sul sito della vetreria, i pezzi pubblicati dichiareranno
> l'assistenza dell'IA? È una decisione, non codice: la forma minima è una riga a
> piè di pezzo. Va presa *prima* del go-live, non dopo — dopo diventa una rettifica.
> Oggi non è urgente perché in questo repo non esiste alcun modello generativo
> (§3.1.1), ma il momento in cui lo diventerà è prevedibile.

> **Nota normativa:** monitorare il *Digital Omnibus* — possibile proroga degli
> obblighi alto-rischio (ipotesi 2027-12-02), non ancora in vigore. La scadenza di
> riferimento resta 2026-08-02 finché non diversamente disposto.

## 9. Riferimenti

- Regolamento (UE) 2024/1689 (AI Act) — art. 5, 12, 14, 50, Allegato III.
- Repo sistema: `Monferrina/monferrinoAI` · Sito: `vetreriamonferrina.com`.
- Brief e checklist operativa: `brief.md`, `checklist.md`.
