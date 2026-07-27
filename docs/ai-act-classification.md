# Dossier di conformità AI Act e GDPR, Vetreria Monferrina

> Natura del documento: autoclassificazione tecnica in-house redatta dal titolare del
> trattamento. **Non è una consulenza legale.** Base normativa: Reg. (UE) 2024/1689 (AI Act),
> Reg. (UE) 2016/679 (GDPR), Dir. (UE) 2019/790 art. 4 (Text and Data Mining).
>
> Titolare del trattamento e responsabile del documento: Vetreria Monferrina.
> Ultimo aggiornamento: 2026-07-27.

## 0. Scopo

Documentare, in assenza di un consulente legale esterno, la classificazione del rischio e le
misure di conformità dei due sistemi automatizzati usati da Vetreria Monferrina. Per il livello
di rischio riscontrato (minimo o fuori ambito) l'autoclassificazione documentata è
proporzionata: la firma di un professionista non è un requisito di legge a questo livello.

## 1. Sistemi in ambito

| Sistema | Cosa fa | Base normativa applicata | Esito | Cosa riapre la valutazione |
|---|---|---|---|---|
| **Glassy** | Chatbot sul sito vetrina, albero decisionale statico | AI Act art. 3(1) e art. 50; GDPR | Fuori dall'ambito AI Act, non è un sistema di IA | Passaggio a NLP o LLM; raccolta di email o nomi (lead generation) |
| **monferrinoAI** | Agente SEO/AEO schedulato, RAG su pagine pubbliche | AI Act Allegato III e art. 50; GDPR art. 5; Dir. 2019/790 art. 4 | Rischio **minimo**, nessun obbligo di registrazione o valutazione di conformità | Pubblicazione senza human gate; cessione o licenza del software a terzi; cambio della lista competitor (v. §7) |

I trigger di questa tabella sono l'unica cosa che va sorvegliata nel tempo. Finché nessuno
scatta, il dossier si rivede a ogni cambiamento sostanziale dei sistemi o almeno una volta
l'anno (§6).

---

## 2. Glassy, chatbot del sito

Glassy è un widget conversazionale su `vetreriamonferrina.com` basato su un **albero
decisionale statico** (`src/components/Chatbot.astro` più `src/data/chatbot-flow.json` nel repo
del sito). Nessun LLM, nessun NLP, nessun machine learning: risposte e percorsi sono
predefiniti. Non raccoglie dati personali, non ha database, non fa profilazione.

Sulla classificazione AI Act non soddisfa la definizione di «sistema di IA» dell'art. 3(1),
perché mancano l'autonomia e la capacità inferenziale richieste: è automazione deterministica a
regole fisse. L'AI Act quindi non si applica.

Sulla trasparenza (art. 50) l'obbligo non c'è, dato che riguarda i sistemi di IA. A titolo di
**prudenza** è comunque implementata una disclosure sempre visibile nell'header del pannello,
«Assistente virtuale automatizzato». Diventa **obbligatoria** se Glassy evolve verso NLP o LLM.

Sul GDPR non c'è alcun trattamento di dati personali, quindi nessun obbligo.

---

## 3. monferrinoAI, agente SEO/AEO

monferrinoAI è un agente Node schedulato su GitHub Actions che mappa keyword, scrappa pagine
pubbliche di competitor via **Firecrawl**, genera embedding via **Voyage** e alimenta una
knowledge base **RAG su Supabase** per l'analisi di posizionamento SEO/AEO. L'uso è **interno
esclusivo** e non esiste alcuna interfaccia rivolta a utenti finali esterni.

Il RAG è su due livelli. `site_pages` tiene un vettore per pagina intera e risponde alla
domanda se un tema esista già sul sito. `site_chunks` tiene un vettore per sezione, tagliata
sugli heading del markdown da `src/chunker.mjs` e derivata da `site_pages` senza alcuno scrape
aggiuntivo: serve alle keyword che arricchiscono una pagina esistente, dove la domanda è dove
manchi il pezzo nuovo.

L'unico output schedulato verso una persona è il **briefing settimanale**
(`.github/workflows/agent.yml`, cron del lunedì alle 11:00 UTC): sceglie una keyword dal
backlog, interroga il RAG e manda per email URL, heading e distanze coseno. Non genera testo,
non tocca il repo del sito e non ha credenziali di modello. L'articolo lo scrive una persona.

Sulla classificazione AI Act non c'è nessuna finalità nei settori ad alto rischio
dell'Allegato III (risorse umane, credito, sanità, giustizia e simili) e il sistema non è
rivolto al pubblico: **rischio minimo**, nessun obbligo formale di registrazione o di
valutazione di conformità.

Sul fronte GPAI l'agente si appoggia a un solo modello di terzi, gli embedding `voyage-4` di
Voyage AI. Non è presente alcun modello generativo: in `src/` e in `scripts/` l'unica chiamata a
un modello è la POST a `api.voyageai.com` in `src/fetchers.mjs`, e l'inventario completo sta in
[`ai-act.md`](./ai-act.md) §3.1.1. Gli obblighi su copyright e dati di addestramento del
modello ricadono sul **fornitore**, non sull'uso a valle.

Le mitigazioni di governance sono due. La prima è il human gate su **ogni** PR, senza
auto-merge: nessuna modifica al sito o all'agente entra in produzione senza revisione umana, ed
è la mitigazione centrale contro output automatizzati non supervisionati. La seconda è il
registro attività `ai_run_log` su Supabase, con RLS abilitata e forzata e nessun grant ad anon o
authenticated, che traccia l'esito di ogni run automatico: i job registrati dal codice sono
`ingest-competitors`, `ingest-site`, `chunk-site`, `digest` e `agent-briefing`.

---

## 4. GDPR, trattamento dati nello scraping competitor

Il rischio è che lo scraping di pagine competitor intercetti **dati personali** non voluti
(email, telefoni, nomi di titolari o autori) e li porti in embedding e storage, dentro
`competitor_snapshots.content_md`.

Le misure applicate per la minimizzazione (art. 5(1)(c)) sono quattro:

1. `--only-main-content` in fase di scrape, che scarta nav e footer, dove risiede la maggior
   parte dei contatti.
2. Redazione PII prima di embedding e storage con la funzione `redact()` (regex su email e
   telefoni italiani), applicata al markdown e ai metadati prima di embedding, hashing e
   salvataggio: una sola redazione pulisce sia il vettore sia il testo conservato.
3. Ceiling dichiarato: i **nomi propri** non sono redatti, servirebbe un NER. Accettabile per
   pagine competitor B2B di edilizia, a bassa densità di PII, e da rivedere solo se un audit lo
   richiede.
4. Finalità limitata a dati **oggettivi** per la keyword-gap analysis (title, meta, heading,
   struttura), non a profili di persone fisiche.

Registro del trattamento in forma ridotta (ROPA-lite):

| Voce | Contenuto | Verifica |
|---|---|---|
| Finalità | Competitive intelligence SEO/AEO, uso interno | |
| Categorie di dati | Contenuti pubblici di pagine web, PII residua minimizzata via redazione | |
| Conservazione | `competitor_snapshots`, retention massima 90 giorni (art. 5(1)(e)) | Enforcement via `DELETE` nel job keepalive, 2 volte a settimana, verificato in `scripts/keepalive.mjs` |
| Storage | Supabase, region `eu-west-3` (Parigi), dati residenti in UE | Verificato su `SUPABASE_PROJECT_REGION` |
| Condivisione | Nessuna con terzi | |

---

## 5. TDM e copyright (Dir. 2019/790 art. 4)

L'opt-out machine-readable è rispettato: il crawler non aggira i segnali di rifiuto TDM
(`robots.txt`, `ai.txt`) e Firecrawl rispetta il `robots.txt` di default.

Non c'è alcun bypass di barriere tecniche, quindi niente forzatura di login, paywall o CAPTCHA,
che sarebbe reato informatico. La lista di URL è curata e riguarda pagine pubbliche.

L'uso è lecito perché limitato alla keyword-gap analysis e allo studio del posizionamento.
**Non** si replicano integralmente contenuti creativi né si estraggono massivamente cataloghi o
listini protetti, a tutela del **diritto sui generis** sulle banche dati.

Sull'identificazione del crawler c'è un limite da dichiarare invece che una misura da vantare:
la CLI Firecrawl non espone un flag di User-Agent personalizzato, quindi lo User-Agent **non è
impostato**. Il rispetto del `robots.txt` resta garantito lato servizio. La stessa posizione è
documentata in [`ai-act.md`](./ai-act.md) §6.1, ed è l'unica versione valida.

---

## 6. Governance e revisione

Il human gate vale su ogni PR e non esiste auto-merge. Il registro attività è `ai_run_log`.
Questo dossier si rivede a ogni cambiamento sostanziale dei sistemi (v. i trigger del §1 e le
azioni del §7) o almeno una volta l'anno.

## 7. Azioni

| # | Azione | Stato |
|---|---|---|
| 1 | Policy di retention per `competitor_snapshots`, risolta con 90 giorni via keepalive | chiusa il 2026-07-05 |
| 2 | Verifica della region EU dello storage Supabase, risolta con `eu-west-3` (Parigi, UE) | chiusa il 2026-07-05 |
| 3 | Re-ingest `--fresh` per bonificare gli snapshot salvati prima della redazione, non necessaria e verificata sui dati | chiusa il 2026-07-27, v. nota sotto |
| 4 | Rivalutare art. 50 e GDPR se Glassy passa a LLM o raccoglie lead | aperta, dipende da un trigger del §1 |

### Nota sull'azione 3, perché è chiusa senza eseguirla

Interrogato il DB il 2026-07-27, sui **30 snapshot** presenti (tutti del 2026-07-05):

| Controllo sui metadati `title` e `description` | Righe |
|---|---|
| contengono `@` (email) | 0 |
| pattern telefono fisso IT (`0…`) | 0 |
| pattern telefono mobile IT (`3…`) | 0 |
| sequenze di 6 o più cifre | 0 |
| `content_md` con marcatori `[email]` o `[tel]` | 14 su 30 (redazione già applicata) |

I metadati delle pagine competitor sono **copy SEO**, non recapiti, del tipo «Vetraio ad Asti»
o «Realizzazione specchi su misura». Il rischio identificato in review era reale in astratto,
ma su questo corpus non si materializza.

Un re-ingest `--fresh` avrebbe svuotato la tabella e consumato circa 30 crediti Firecrawl più
un batch Voyage **per non correggere nulla**. Con `redact()` ora applicato anche ai metadati, i
futuri snapshot sono coperti per costruzione.

Questa verifica va rifatta se cambia la lista dei competitor: un sito che mette il numero di
telefono nel `<title>` è raro ma non impossibile. La query è una `count(*) filter (...)` su
`competitor_snapshots`.

## 8. Fonti di riferimento

Gli estratti integrali delle due ricerche a supporto dell'autoclassificazione sono in
[`ai-act-annex-fonti.md`](./ai-act-annex-fonti.md):

1. Classificazione AI Act di un chatbot decision-tree e di un agente di scraping SEO.
2. I tre pilastri UE per lo scraping competitivo con Firecrawl (AI Act e TDM, GDPR, DMA e
   diritto sui database).

La postura tecnica di dettaglio della pipeline sta in [`ai-act.md`](./ai-act.md), nello stesso
repo.
