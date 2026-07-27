# Allegato: fonti di riferimento (autoclassificazione)

Estratti delle ricerche usate a supporto del dossier di autoclassificazione. Fonte: Google AI
Mode, 2026-07-05. Le risposte di un'IA generativa possono contenere errori: vanno usate come
inquadramento, non come consulenza legale.

---

## Fonte 1: classificazione AI Act di chatbot decision-tree e agente di scraping SEO

Domanda posta. Un chatbot su sito vetrina che non raccoglie dati personali né sensibili, senza
database, a decisioni fisse guidate da un albero decisionale limitato, come si classifica?

Sintesi della risposta. Un sistema basato puramente su regole fisse, percorsi prestabiliti e
alberi decisionali statici, quindi senza machine learning, NLP o modelli linguistici, non è un
sistema di IA ai sensi del Reg. UE 2024/1689: mancano l'autonomia e la capacità di inferenza
richieste dalla definizione allineata all'OCSE. Ne consegue che l'AI Act non si applica, che gli
obblighi di trasparenza dell'art. 50 non sono dovuti (resta buona pratica dichiarare che si
tratta di un assistente automatizzato) e che non c'è impatto GDPR finché il bot non raccoglie
dati personali e non ha un database. La classificazione cambia se il chatbot evolve verso NLP o
LLM, oppure se inizia a raccogliere email e nomi per lead generation.

Domanda posta. Un agente AI di scraping competitor con Firecrawl, per SEO e AEO, a uso interno
esclusivo, come si classifica?

Sintesi della risposta. Rischio minimo o basso: la finalità, cioè analisi di marketing e di
posizionamento, non rientra nei settori ad alto rischio, e l'uso interno esclude gli obblighi di
trasparenza verso utenti finali. Se il sistema si appoggia a LLM di terzi (GPAI), la conformità
su copyright e addestramento ricade sul fornitore del modello. Restano rilevanti le normative
correlate: TDM e opt-out (art. 4 della Direttiva Copyright), diritto sui generis sulle banche
dati, GDPR sui dati personali intercettati, oltre alle best practice tecniche di User-Agent
identificabile e rate limiting.

---

## Fonte 2: i tre pilastri UE per lo scraping competitivo con Firecrawl

Lo scraping concorrenziale per SEO e AEO su dati pubblici e non personali è lecito in UE, ma è
regolato da tre pilastri.

1. AI Act e Direttiva Copyright (TDM). Il rispetto dell'opt-out TDM (art. 4) è vincolante: il
   crawler va bloccato sui siti che esprimono rifiuto tramite marcatori machine-readable, cioè
   `robots.txt` e `ai.txt`. Se i dati istruiscono una GPAI scatta l'obbligo di riepilogo delle
   fonti.
2. GDPR. Niente scraping di dati di contatto o di persone fisiche (email, telefoni, pagine del
   team, recensioni riconducibili a una persona) senza base giuridica. L'estrazione va
   configurata su dati oggettivi: tag da H1 a H6, meta description, alberatura dei link,
   `sitemap.xml`, JSON-LD.
3. DMA e concorrenza sleale. È vietato lo scraping finalizzato a copiare integralmente
   l'infrastruttura di un concorrente a fini parassitari, e la direttiva UE sulle banche dati
   vieta l'estrazione massiva e sistematica di interi cataloghi o listini per replicarli.

In pratica la checklist è questa: identità trasparente con uno User-Agent chiaro, nessun bypass
di CAPTCHA, paywall o login (che in UE è reato informatico), uso lecito nella keyword-gap
analysis, uso illecito nel generare contenuti sintetici identici che cannibalizzano il traffico
del concorrente.

Una configurazione conforme, sul piano concettuale, tiene `respectRobotsTxt: true`, limita
l'estrazione agli elementi SEO tecnici (meta title, meta description, heading, structured data)
e applica rate limiting.

Adattamento al caso di questo repo. La pipeline monferrinoAI non fa crawl largo: fa lo scrape di
una lista fissa di 30 URL, definita in `monitor/competitor-monitor.json` e letta a run time dal
monitor Firecrawl, quindi `maxDepth` e `limit` non sono parametri rilevanti. I controlli
applicabili sono il rispetto di robots e TDM, la redazione dei dati personali (`redact()` in
`src/fetchers.mjs`) e lo User-Agent identificabile.
