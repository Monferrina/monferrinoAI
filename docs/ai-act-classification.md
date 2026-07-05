# Dossier di conformità AI Act & GDPR — Vetreria Monferrina

> **Natura del documento.** Autoclassificazione tecnica in-house redatta dal titolare del
> trattamento. **Non è una consulenza legale.** Base normativa: Reg. (UE) 2024/1689 (AI Act),
> Reg. (UE) 2016/679 (GDPR), Dir. (UE) 2019/790 art. 4 (Text and Data Mining).
> Ultimo aggiornamento: 2026-07-05. Responsabile: Marco Bellingeri.

## 0. Scopo

Documentare, in assenza di un consulente legale esterno, la classificazione del rischio e le
misure di conformità dei due sistemi automatizzati usati da Vetreria Monferrina. Per il livello
di rischio riscontrato (minimo / fuori-ambito) l'autoclassificazione documentata è proporzionata:
la firma di un professionista non è un requisito di legge a questo livello.

## 1. Sistemi in ambito

| Sistema | Cosa fa | Esito classificazione |
|---|---|---|
| **Glassy** | Chatbot sul sito vetrina | Fuori dall'ambito AI Act (non è un sistema di IA) |
| **monferrinoAI** | Agente SEO/AEO schedulato | Rischio **minimo** |

---

## 2. Glassy — chatbot del sito

**Descrizione.** Widget conversazionale su `vetreriamonferrina.com` basato su un **albero
decisionale statico** (`src/components/Chatbot.astro` + `src/data/chatbot-flow.json`). Nessun
LLM, nessun NLP, nessun machine learning. Risposte e percorsi predefiniti. Non raccoglie dati
personali, non ha database, non fa profilazione.

**Classificazione AI Act.** Non soddisfa la definizione di «sistema di IA» dell'art. 3(1)
(assenza di autonomia e di capacità inferenziale: è automazione deterministica a regole fisse).
→ **L'AI Act non si applica.**

**Trasparenza (art. 50).** Non obbligatoria (l'obbligo riguarda i sistemi di IA). A titolo di
**prudenza** è comunque implementata una disclosure sempre visibile nell'header del pannello:
«Assistente virtuale automatizzato». Diventa **obbligatoria** se Glassy evolve verso NLP/LLM.

**GDPR.** Nessun trattamento di dati personali → nessun obbligo.

**Trigger di ri-valutazione:** (a) integrazione di comprensione del testo libero (NLP/LLM);
(b) raccolta di email/nomi (lead generation). In quei casi: rivalutare art. 50 e GDPR.

---

## 3. monferrinoAI — agente SEO/AEO

**Descrizione.** Agente Node schedulato (GitHub Actions) che: mappa keyword, scrappa pagine
pubbliche di competitor via **Firecrawl**, genera embedding via **Voyage**, alimenta una knowledge
base **RAG su Supabase** per analisi di posizionamento SEO/AEO. **Uso interno esclusivo**, nessuna
interfaccia rivolta a utenti finali esterni.

**Classificazione AI Act.** Nessuna finalità nei settori ad alto rischio (Allegato III: HR,
credito, sanità, giustizia, ecc.). Non rivolto al pubblico. → **Rischio minimo**, nessun obbligo
formale di registrazione/valutazione di conformità.

**GPAI.** L'agente si appoggia a modelli di terzi (embedding Voyage; eventuali LLM). Gli obblighi
su copyright e dati di addestramento del modello ricadono sul **fornitore** del modello, non
sull'uso a valle.

**Mitigazioni di governance:**
- **Human gate su OGNI PR — mai auto-merge.** Nessuna modifica al sito/agente entra in produzione
  senza revisione umana. È la mitigazione centrale contro output automatizzati non supervisionati.
- **Registro attività** `ai_run_log` (Supabase, RLS lockdown): traccia l'esito di ogni run
  di ingest e del digest.

---

## 4. GDPR — trattamento dati nello scraping competitor

**Rischio.** Lo scraping di pagine competitor può intercettare **dati personali** non voluti
(email, telefoni, nomi di titolari/autori) e portarli in embedding + storage
(`competitor_snapshots.content_md`).

**Misure applicate (minimizzazione, art. 5(1)(c)):**
1. **`--only-main-content`** in fase di scrape → scarta nav/footer, dove risiede la maggior parte
   dei contatti.
2. **Redazione PII pre-embedding e pre-storage**: funzione `redact()` (regex email + telefoni IT)
   applicata al markdown prima di embedding, hashing e salvataggio → una sola redazione pulisce
   sia il vettore sia il testo conservato.
3. **Ceiling dichiarato:** i **nomi propri** non sono redatti (servirebbe un NER). Accettabile per
   pagine competitor B2B di edilizia, a bassa densità di PII. Da rivedere solo se un audit lo
   richiede.
4. **Finalità:** dati **oggettivi** per keyword-gap analysis (title, meta, headings, struttura),
   non profili di persone fisiche.

**Registro del trattamento (ROPA-lite):**
- *Finalità:* competitive intelligence SEO/AEO, uso interno.
- *Categorie di dati:* contenuti pubblici di pagine web; PII residua minimizzata via redazione.
- *Conservazione:* snapshot in `competitor_snapshots`, **retention max 90 giorni** (limitazione della
  conservazione, art. 5(1)(e)); enforcement via `DELETE` nel job keepalive (2×/settimana). ✓
- *Storage:* Supabase, region **`eu-west-3`** (Parigi) → dati residenti in UE. ✓
- *Condivisione:* nessuna con terzi.

---

## 5. TDM / Copyright (Dir. 2019/790 art. 4)

- **Opt-out machine-readable rispettato:** il crawler non aggira i segnali di rifiuto TDM
  (`robots.txt` / `ai.txt`). Firecrawl rispetta `robots.txt` di default.
- **Nessun bypass di barriere tecniche:** niente forzatura di login, paywall o CAPTCHA (sarebbe
  reato informatico). La lista di URL è curata e riguarda pagine pubbliche.
- **Uso lecito:** keyword-gap analysis e studio del posizionamento. **NON** si replicano
  integralmente contenuti creativi né si estraggono massivamente cataloghi/listini protetti
  (tutela del **diritto sui generis** sulle banche dati).
- **Identità:** ove il tooling lo consenta, User-Agent identificabile per dare al concorrente la
  possibilità di bloccare.

---

## 6. Governance e revisione

- Human gate su ogni PR; nessun auto-merge.
- `ai_run_log` come registro attività.
- Revisione di questo dossier a ogni cambiamento sostanziale dei sistemi (vedi trigger §2, §7) o
  almeno annuale.

## 7. Azioni aperte

| # | Azione | Priorità |
|---|---|---|
| 1 | ~~Policy di retention per `competitor_snapshots`~~ → risolta: 90 giorni via keepalive | ✓ chiusa 2026-07-05 |
| 2 | ~~Verificare region EU dello storage Supabase~~ → risolta: `eu-west-3` (Parigi, UE) | ✓ chiusa 2026-07-05 |
| 3 | Re-ingest `--fresh` per bonificare gli snapshot salvati prima della redazione | alta (post-merge) |
| 4 | Rivalutare art. 50 GDPR se Glassy passa a LLM o raccoglie lead | trigger |

## 8. Fonti di riferimento

- Ricerca Google AI Mode (2026-07-05) — autoclassificazione AI Act di chatbot decision-tree e
  agente di scraping SEO. *[allegare estratto]*
- Ricerca Google AI Mode (2026-07-05) — 3 pilastri UE per lo scraping competitivo Firecrawl
  (AI Act/TDM, GDPR, DMA/diritto sui database). *[allegare estratto]*
- `docs/ai-act.md` (repo monferrinoAI) — posture tecnica di dettaglio della pipeline.
