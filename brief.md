# Brief

Le decisioni di scopo commerciale che il codice non contiene e non può contenere: quali
competitor si sorvegliano e perché, con quale limite etico, quali prodotti spingere in
quale stagione. Architettura, stack e cadenza dei workflow stanno nel [README](./README.md)
e non sono ripetuti qui.

## Competitor sorvegliati

La lista di URL non vive in un file di configurazione del repo. `scripts/ingest-competitors.mjs`
la legge a ogni run dal monitor Firecrawl `019f1363-7672-736b-af55-3e04baad06fd`, che è la
fonte di verità: cambiare i target del monitor cambia l'ingest senza toccare il codice. La
copia riproducibile della config sta in [`monitor/competitor-monitor.json`](./monitor/competitor-monitor.json).

I domini sorvegliati sono sette, per 30 URL in tutto.

| Dominio                           | Zona              | Perché è dentro                                            | URL |
| --------------------------------- | ----------------- | ---------------------------------------------------------- | --- |
| `vetrariacasalese.it`             | Casale Monferrato | concorrente diretto, presente nel ranking locale             | 5   |
| `lanuovavetrinova.it`             | non rilevata      | molte pagine servizio, catalogo ampio                        | 5   |
| `skyglass.it`                     | fuori zona        | blog editoriale attivo su normative e bonus, fonte di temi   | 5   |
| `nuovavetrariaalessandrinasrl.it` | Alessandria       | catalogo servizi sovrapposto al nostro                       | 4   |
| `vetreriavegal.com`               | Alessandria       | parapetti, scale e lavorazioni del vetro                     | 4   |
| `vetreriabs.it`                   | non rilevata      | statico, blog fermo dal 2020, basso valore                   | 4   |
| `vercellivetri.it`                | Vercelli          | shop e blog, il più strutturato del territorio               | 3   |

Skyglass è l'unico fuori zona e ci sta per un motivo diverso dagli altri: non contende la
SERP locale, ma copre i temi informazionali che alimentano il backlog editoriale. Altri
cinque domini sono stati mappati e scartati perché statici o fuori territorio; il razionale
completo, con tutte e dodici le fonti valutate, sta in [`monitor/README.md`](./monitor/README.md).

## Concorrenza amichevole

I competitor si usano per capire dove il sito ha buchi di contenuto, mai per danneggiarli:
nessuna azione ostile, nessuno scraping oltre il necessario all'analisi. Non è solo una
dichiarazione di intenti, il codice la vincola su punti verificabili.

Il monitor Firecrawl gira una volta al mese e l'ingest una volta a settimana, sempre sulle
stesse trenta pagine: nessun crawl ricorsivo, nessuna scoperta automatica di URL nuovi.
`scrape()` in `src/fetchers.mjs` passa `--only-main-content`, quindi prende il contenuto e
scarta navigazione e piè di pagina invece di aspirare il sito intero. `redact()` maschera
email e numeri di telefono prima che il markdown raggiunga l'embedding, così i recapiti di
terzi non entrano nel database. La ritenzione è la stessa dai due lati: 90 giorni di diff
sul monitor (`retentionDays`) e 90 giorni di snapshot in Postgres, purgati da
`scripts/keepalive.mjs`.

Del materiale scrapato non esce testo verso l'esterno. Il digest mensile
(`scripts/digest.mjs`) riporta per dominio solo il conteggio delle pagine cambiate,
quelle scansionate e la data dell'ultima scansione. Il briefing del lunedì non legge
affatto `competitor_snapshots`.

## Stagionalità

Assunzione commerciale del titolare, non un dato misurato, e non implementata da nessuna
parte: nessuno script legge una stagione e nessuna colonna del backlog la rappresenta.
Vale come criterio per la persona che sceglie cosa scrivere quando il backlog offre più
candidate equivalenti.

Box doccia in primavera e in estate, specchi tutto l'anno.

## Schema derivato dai dati

Lo schema Supabase si deriva dai dati osservati in un run reale, non si progetta a priori.
Vale soprattutto per le tabelle che nascono da contenuto di terzi, dove i campi disponibili
dipendono da come sono fatti i siti sorgente e non da come si vorrebbe che fossero. La
[checklist](./checklist.md) rimanda qui per questa regola.

## Conformità

Documentazione tecnica AI Act, registro delle attività e classificazione del rischio stanno
in [`docs/ai-act.md`](./docs/ai-act.md) e
[`docs/ai-act-classification.md`](./docs/ai-act-classification.md).
