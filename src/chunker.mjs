// Taglia il markdown di una pagina nelle sue sezioni, per il RAG a livello di paragrafo.
//
// Perché strutturale e non a lunghezza fissa: il markdown arriva da Firecrawl con gli heading
// veri del sito, e ogni pagina servizio ha una struttura regolare (intro, caratteristiche,
// materiali, quando scegliere, FAQ). Tagliare sugli heading segue i confini che ha deciso una
// persona; tagliare ogni N caratteri li attraversa a caso. Costo zero, nessun modello in più.
//
// Misurato sulle 29 pagine reali: 197 sezioni, mediana 460 caratteri, p90 756.
// Solo 3 sezioni sopra 1500 (si spezzano sugli h3) e 5 sotto 200 (si fondono con la precedente).

const MIN = 200;
const MAX = 1500;

// Sezioni che sul NOSTRO sito sono navigazione o call-to-action, non contenuto.
// Lista esplicita e non euristica: provate e scartate sia la densità di link (conta le
// immagini e boccia 60 chunk buoni) sia la quantità di prosa residua (gli intro dei blog ne
// hanno meno dei CTA). Nessun segnale strutturale li separa, quindi si nominano.
// Il sito è nostro e questi titoli sono stabili: se cambiano, va aggiornata questa lista.
// Misurato: senza filtro, cercando «specchi» tre dei primi cinque risultati erano blocchi
// "Servizi correlati" di pagine che non c'entravano.
export const SEZIONI_NAVIGAZIONE = [
  /^(servizi|articoli) correlati$/i,
  /richiedi un preventivo/i,
  /^hai un progetto/i,
  /^vuoi saperne di più/i,
  /^non (hai trovato|trovi)/i,
];

// Coda comune a tutte le pagine: avviso cookie e testo del widget chatbot. Firecrawl li
// prende perché sono nel DOM, ma non sono contenuto della pagina e finirebbero nell'ultimo
// chunk di ognuna delle 29.
const CODA = /\n+Questo sito usa solo cookie tecnici[\s\S]*$/;
// Link di salto in cima, prima dell'h1.
const SALTO = /^\[Vai al contenuto principale\]\([^)]*\)\s*/;

export function cleanPage(md) {
  return String(md ?? '').replace(SALTO, '').replace(CODA, '').trim();
}

// Il titolo della pagina prefissa OGNI chunk prima dell'embedding. Un chunk che parla di
// "vetro temperato 8 mm" senza contesto potrebbe stare su cinque pagine diverse: il prefisso
// gli dice su quale sta. È la versione a costo zero del contextual retrieval, che invece
// farebbe scrivere il cappello a un modello.
export function pageTitle(md) {
  return md.match(/^# (.+)$/m)?.[1].trim() ?? null;
}

const headingOf = (blocco) => blocco.match(/^#{2,3} (.+)$/m)?.[1].trim() ?? null;

/**
 * Sezioni di primo livello: tutto ciò che precede il primo `##` resta come blocco iniziale
 * (è il titolo più l'introduzione, che sono contenuto vero e non scarto).
 */
export function splitSections(md) {
  return md
    .split(/^(?=## )/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Una pagina markdown diventa una lista di chunk pronti da embeddare.
 * Ritorna oggetti con `heading`, `text` (il markdown originale del pezzo) e `embed_text`
 * (il testo che va davvero a Voyage, col titolo pagina in testa).
 */
export function chunkPage(mdGrezzo, { min = MIN, max = MAX } = {}) {
  const md = cleanPage(mdGrezzo);
  if (!md) return [];
  const titolo = pageTitle(md);

  // 1. sezioni sugli h2, saltando navigazione e CTA, poi le troppo lunghe si spezzano sugli h3.
  const grezzi = [];
  for (const sezione of splitSections(md)) {
    const h = headingOf(sezione);
    if (h && SEZIONI_NAVIGAZIONE.some((re) => re.test(h))) continue;
    if (sezione.length <= max) {
      grezzi.push(sezione);
      continue;
    }
    const sotto = sezione.split(/^(?=### )/m).map((s) => s.trim()).filter(Boolean);
    // Una sezione lunga senza h3 dentro non si può spezzare senza tagliare a caso:
    // meglio un chunk lungo che uno mutilato a metà frase.
    grezzi.push(...(sotto.length > 1 ? sotto : [sezione]));
  }

  // 2. i frammenti troppo corti si fondono con il precedente. Un chunk da 75 caratteri
  // produce un vettore quasi privo di segnale, che poi compare fra i vicini per caso.
  const uniti = [];
  for (const pezzo of grezzi) {
    if (pezzo.length < min && uniti.length) uniti[uniti.length - 1] += `\n\n${pezzo}`;
    else uniti.push(pezzo);
  }

  return uniti.map((text, index) => {
    const heading = headingOf(text);
    const contesto = [titolo, heading].filter(Boolean).join(' > ');
    return {
      index,
      heading,
      text,
      embed_text: contesto ? `${contesto}\n\n${text}` : text,
    };
  });
}
