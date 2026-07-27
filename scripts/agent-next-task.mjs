// Sceglie il PROSSIMO lavoro dal backlog SEO e stampa su stdout il briefing JSON che
// l'agente Claude Code (claude -p) leggerà. Qui non si genera contenuto: si decide su cosa.
//
// Uso:
//   node scripts/agent-next-task.mjs                         # una candidata qualsiasi
//   node scripts/agent-next-task.mjs --content-type faq      # solo di quel tipo
//   node scripts/agent-next-task.mjs --dry-run               # esempio, nessuna connessione (CI)
//
// Env: gli stessi di db.mjs + VOYAGE_API_KEY (serve l'embedding della keyword per il RAG).
// Exit 1 = backlog vuoto o errore: un run che non ha nulla da fare deve dirlo, non uscire verde.
//
// SICUREZZA (§4 dossier AI Act, seconda linea dopo scanContent sull'ingest):
// il briefing NON contiene una riga di content_md. Del RAG escono solo url e distanza.
// Il testo scrapato è input non fidato: se non entra nel briefing, non può entrare nel prompt.

import { pathToFileURL } from 'node:url';
import { makeClient, loadEnv } from '../src/db.mjs';
import { embed } from '../src/fetchers.mjs';

// Normalizza il testo che arriva dal DB prima di finire nel prompt dell'agente: whitespace
// collassato (niente newline che simulino un cambio di turno) e lunghezza tagliata.
// Le keyword vengono da un harvest esterno, quindi sono dati altrui anche se sembrano innocue.
const clean = (s, max) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim().slice(0, max));
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Query della candidata. Il filtro opzionale passa come parametro anche quando è null
 * ($1 is null = nessun filtro): una sola SQL, nessuna concatenazione di stringhe.
 * Ordine: volume desc, kd asc, keyword — l'ultimo campo rende il run riproducibile a parità
 * di volume/kd, altrimenti la scelta dipenderebbe dall'ordine fisico delle righe.
 */
export function candidateQuery(contentType = null) {
  return {
    text: `select keyword, cluster, search_volume, kd, intent, content_type, target_page
             from public.seo_keywords
            where status = 'todo'
              and coalesce(is_noise, false) = false
              and ($1::text is null or content_type = $1)
            order by search_volume desc nulls last, kd asc nulls last, keyword asc
            limit 1`,
    values: [contentType ?? null],
  };
}

// Le 3 pagine del sito semanticamente più vicine alla keyword.
// distinct on (url): site_pages è versionata (insert idempotente su url+content_hash), senza
// dedup le 3 righe potevano essere 3 versioni della stessa pagina — e il RAG diceva una cosa sola.
const VICINE_SQL = `
  select url, distanza from (
    select distinct on (url) url, embedding <=> $1::vector as distanza
      from public.site_pages
     where embedding is not null
     order by url, 2
  ) t
  order by distanza
  limit 3`;

/**
 * Briefing: riga di seo_keywords + vicine di site_pages → JSON per l'agente.
 * Pura, così il --dry-run stampa esattamente la stessa forma della produzione.
 */
export function buildBriefing(kw, vicine = []) {
  return {
    keyword: clean(kw.keyword, 200),
    cluster: clean(kw.cluster, 120),
    volume: num(kw.search_volume),
    kd: num(kw.kd),
    intent: clean(kw.intent, 40),
    content_type: clean(kw.content_type, 40),
    target_page: clean(kw.target_page, 300),
    // Solo url + distanza: serve all'agente per NON riproporre roba che c'è già.
    // Nessun testo delle pagine, di proposito (vedi nota sicurezza in testa al file).
    gia_esistente: vicine.slice(0, 3).map((r) => {
      const d = num(r.distanza); // pg torna i float8 come stringa: Number() prima di arrotondare
      return { url: clean(r.url, 300), distanza: d === null ? null : Math.round(d * 1e4) / 1e4 };
    }),
  };
}

// Esempio del --dry-run: dati finti, stessa funzione di build → se la forma cambia, cambia qui.
const ESEMPIO = {
  kw: {
    keyword: 'montare box doccia', cluster: 'box-doccia', search_volume: 480, kd: 21,
    intent: 'informational', content_type: 'faq', target_page: '/blog/montare-siliconare-box-doccia',
  },
  vicine: [
    { url: 'https://vetreriamonferrina.com/blog/montare-siliconare-box-doccia', distanza: 0.1842 },
    { url: 'https://vetreriamonferrina.com/servizi/box-doccia', distanza: 0.2913 },
    { url: 'https://vetreriamonferrina.com/faq', distanza: 0.4107 },
  ],
};

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--content-type');
  const contentType = i > -1 ? argv[i + 1] : null;

  if (argv.includes('--dry-run')) {
    console.log(JSON.stringify(buildBriefing(ESEMPIO.kw, ESEMPIO.vicine), null, 2));
    return;
  }

  const g = loadEnv('.env.local');
  const voyage = g('VOYAGE_API_KEY');
  // Senza embedding il briefing uscirebbe con gia_esistente vuoto: l'agente crederebbe che il
  // sito non copre nulla e duplicherebbe. Meglio fermarsi che produrre un briefing bugiardo.
  if (!voyage) throw new Error('VOYAGE_API_KEY mancante: senza RAG non so cosa esiste già.');

  const client = makeClient(g);
  await client.connect();
  try {
    const q = candidateQuery(contentType);
    const { rows: [kw] } = await client.query(q.text, q.values);
    if (!kw) {
      const filtro = contentType ? ` con content_type='${contentType}'` : '';
      console.error(`Backlog vuoto: nessuna keyword status='todo' non-noise${filtro}. Niente da fare.`);
      process.exitCode = 1;
      return;
    }

    const [vec] = await embed([kw.keyword], 'query', voyage);
    const { rows: vicine } = await client.query(VICINE_SQL, [`[${vec.join(',')}]`]);

    console.log(JSON.stringify(buildBriefing(kw, vicine), null, 2));
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main().catch((e) => {
    console.error(`agent-next-task: ${e.message.split('\n')[0]}`);
    process.exit(1);
  });
}
