# Allegato — Fonti di riferimento (autoclassificazione)

Estratti delle ricerche usate a supporto del dossier. Fonte: Google AI Mode, 2026-07-05.
*Le risposte di un'IA generativa possono contenere errori; usate come inquadramento, non come
consulenza legale.*

---

## Fonte 1 — Classificazione AI Act di chatbot decision-tree e agente di scraping SEO

**Domanda:** un chatbot su sito vetrina che non raccoglie dati personali né sensibili, senza
database, a decisioni fisse guidate da albero decisionale limitato — come si classifica?

**Sintesi risposta.** Un sistema basato puramente su regole fisse, percorsi prestabiliti e alberi
decisionali statici (senza machine learning, NLP o modelli linguistici) **non è un sistema di IA**
ai sensi del Reg. UE 2024/1689: manca l'autonomia e la capacità di inferenza richieste dalla
definizione allineata all'OCSE. Di conseguenza:
- **AI Act:** non si applica.
- **Trasparenza (art. 50):** non obbligatoria (resta buona pratica informare che si tratta di un
  assistente automatizzato).
- **GDPR:** nessun impatto se il bot non raccoglie dati personali e non ha database.
- Diventa rilevante se il chatbot evolve verso NLP/LLM o raccoglie email/nomi (lead generation).

**Domanda:** agente AI di scraping competitor con Firecrawl, per SEO/AEO, a uso interno esclusivo?

**Sintesi risposta.** Classificato **rischio minimo/basso**: la finalità (analisi di marketing e
posizionamento) non rientra nei settori ad alto rischio; l'uso interno esclude gli obblighi di
trasparenza verso utenti finali. Se si appoggia a LLM di terzi (GPAI), la conformità su copyright e
addestramento ricade sul fornitore del modello. Attenzione alle normative correlate: TDM/opt-out
(art. 4 Dir. Copyright), diritto sui generis sulle banche dati, GDPR su PII intercettata, e best
practice tecniche (User-Agent identificabile, rate limiting).

---

## Fonte 2 — I 3 pilastri UE per lo scraping competitivo con Firecrawl

Lo scraping concorrenziale per SEO/AEO su **dati pubblici e non personali** è lecito in UE, ma
regolato da tre pilastri:

1. **AI Act & Direttiva Copyright (TDM).** Rispetto vincolante dell'opt-out TDM (art. 4): bloccare
   il crawler sui siti che esprimono rifiuto via marcatori machine-readable (`robots.txt`,
   `ai.txt`). Se i dati istruiscono una GPAI, obbligo di riepilogo delle fonti.
2. **GDPR.** Niente scraping di dati di contatto/persone fisiche (email, telefoni, team, recensioni
   riconducibili a persone) senza base giuridica. Configurare l'estrazione su **dati oggettivi**:
   tag H1–H6, meta-description, alberatura link, `sitemap.xml`, JSON-LD.
3. **DMA & concorrenza sleale.** Vietato lo scraping per copiare integralmente l'infrastruttura di
   un concorrente a fini parassitari. La Dir. UE sui database vieta l'estrazione massiva e
   sistematica di interi cataloghi/listini per replicarli.

**Checklist pratica:** identità trasparente (User-Agent chiaro); nessun bypass di CAPTCHA/paywall/
login (reato informatico in UE); uso lecito = keyword-gap analysis; uso illecito = generare
contenuti sintetici identici che cannibalizzano il traffico del concorrente.

**Configurazione conforme (concettuale):** `respectRobotsTxt: true`, estrazione limitata a elementi
SEO tecnici (meta_title, meta_description, headings, structured_data), rate-limiting.
*Nota di adattamento al nostro caso:* la pipeline monferrinoAI **non fa crawl largo** — scrappa una
lista fissa (~30 URL) da un monitor Firecrawl, quindi `maxDepth`/`limit` non sono rilevanti; i
controlli applicabili sono robots/TDM, redazione PII e User-Agent identificabile.
