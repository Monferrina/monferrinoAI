// Ingest del PROPRIO sito (vetreriamonferrina.com) nella KB → tabella site_pages.
// Corpus separato dai competitor: serve all'agente per sapere cosa c'è già e non duplicare.
// Idempotente (ON CONFLICT url,content_hash): rilanciabile dopo ogni pubblicazione.
//
// Uso:
//   node scripts/ingest-site.mjs            # tutte le pagine di contenuto (additivo, idempotente)
//   node scripts/ingest-site.mjs --limit 3  # primi N (test/budget)
//   node scripts/ingest-site.mjs --dry-run  # scrape+validate, NO insert
//
// Costo: ~1 credito Firecrawl/pagina. Voyage gratis (free tier per-modello).
// NB: nessun --fresh volutamente — non si svuota la KB del proprio sito per errore.

import { toSnapshot, validateSnapshot, pageType } from '../src/snapshot.mjs';
import { makeClient, loadEnv, insertSnapshot } from '../src/db.mjs';
import { scrape, embed } from '../src/fetchers.mjs';
import { logAiRun } from '../src/ai-log.mjs';

const startedAt = new Date();

// Source of truth = mappa del sito (firecrawl map vetreriamonferrina.com) filtrata alle pagine
// di contenuto. Esclusi: cookie/privacy (legali), preventivo (form), galleria (immagini),
// contatti (solo NAP), sitemap*.xml. Rivedere in PR ad ogni nuova pagina pubblicata.
const URLS = [
  'https://vetreriamonferrina.com',
  'https://vetreriamonferrina.com/servizi',
  'https://vetreriamonferrina.com/servizi/blindati',
  'https://vetreriamonferrina.com/servizi/box-doccia',
  'https://vetreriamonferrina.com/servizi/fori',
  'https://vetreriamonferrina.com/servizi/madras',
  'https://vetreriamonferrina.com/servizi/molature',
  'https://vetreriamonferrina.com/servizi/monolitici',
  'https://vetreriamonferrina.com/servizi/parapetti',
  'https://vetreriamonferrina.com/servizi/pensiline',
  'https://vetreriamonferrina.com/servizi/porte-interne',
  'https://vetreriamonferrina.com/servizi/sagomature',
  'https://vetreriamonferrina.com/servizi/sostituzione-vetri',
  'https://vetreriamonferrina.com/servizi/specchi',
  'https://vetreriamonferrina.com/servizi/stratificati',
  'https://vetreriamonferrina.com/servizi/vetrine',
  'https://vetreriamonferrina.com/servizi/vetrocamera',
  'https://vetreriamonferrina.com/servizi/vetrocamera-tripli',
  'https://vetreriamonferrina.com/blog',
  'https://vetreriamonferrina.com/blog/come-pulire-box-doccia-incrostato',
  'https://vetreriamonferrina.com/blog/come-pulire-mantenere-vetri',
  'https://vetreriamonferrina.com/blog/come-scegliere-vetro-box-doccia',
  'https://vetreriamonferrina.com/blog/come-tagliare-vetro-temperato',
  'https://vetreriamonferrina.com/blog/montare-siliconare-box-doccia',
  'https://vetreriamonferrina.com/blog/vetro-temperato-vs-stratificato',
  'https://vetreriamonferrina.com/blog/vetrocamera-doppio-o-triplo',
  'https://vetreriamonferrina.com/chi-siamo',
  'https://vetreriamonferrina.com/faq',
  'https://vetreriamonferrina.com/trasporto-e-montaggio',
];

const argLimit = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();
const dryRun = process.argv.includes('--dry-run');

const g = loadEnv('.env.local');
const VOYAGE = g('VOYAGE_API_KEY');

const urls = URLS.slice(0, argLimit);
console.log(`Ingest ${urls.length} pagine di vetreriamonferrina.com in site_pages (dry-run: ${dryRun})`);

// 1-2. scrape → record (gli scrape falliti si scartano)
let docs = [];
for (const url of urls) {
  const doc = scrape(url);
  if (doc) docs.push(toSnapshot({ ...doc, metadata: { ...doc.metadata, sourceURL: doc.metadata?.sourceURL || url } }, pageType(url)));
}
console.log(`scrape ok: ${docs.length}/${urls.length}`);
// Scarta le pagine 4xx/5xx PRIMA di embed: il loro markdown d'errore inquinerebbe il RAG
// (e falserebbe la soglia sotto: una valanga di 404 = ingest vuoto → deve fallire).
const before4xx = docs.length;
docs = docs.filter((d) => d.status_code < 400);
if (docs.length < before4xx) console.warn(`  scartate ${before4xx - docs.length} pagine con status_code >= 400.`);
// Soglia minima: sotto l'80% di scrape riusciti il run fallisce (exit 1). Senza,
// bastava 1/29 pagina per un run "verde" che maschera un ingest quasi vuoto.
const MIN_OK_RATIO = 0.8;
if (docs.length < Math.ceil(urls.length * MIN_OK_RATIO)) {
  console.error(`scrape sotto soglia (${docs.length}/${urls.length} < ${MIN_OK_RATIO * 100}%): abort.`);
  process.exit(1);
}

// 3. embed (un solo batch: ~29 pagine « 8M TPM Tier 1)
const embs = await embed(docs.map((d) => d.content_md), 'document', VOYAGE);
docs.forEach((d, i) => { d.embedding = embs[i]; });

// 4. validate → scarta i malformati (mai inserire dati sporchi)
const valid = [];
for (const d of docs) {
  const errs = validateSnapshot(d);
  if (errs.length) console.warn(`  SCARTATO ${d.url}: ${errs.join(', ')}`);
  else valid.push(d);
}
console.log(`validi: ${valid.length}/${docs.length}`);

if (dryRun) { console.log('dry-run: nessun insert.'); process.exit(0); }

// 5. insert idempotente in site_pages
const client = makeClient(g);
await client.connect();
let inserted = 0;
for (const d of valid) inserted += await insertSnapshot(client, d, 'site_pages');
await client.end();

const summary = `${inserted} nuovi, ${valid.length - inserted} già presenti (dedup), ${docs.length - valid.length} scartati, ${urls.length - docs.length} scrape falliti.`;
console.log(`\n✅ Ingest sito: ${summary}`);

// Registro attività AI (AI Act): traccia l'esito del run.
await logAiRun(g, {
  job: 'ingest-site',
  summary,
  meta: { urls: urls.length, inserted, valid: valid.length, dropped_4xx: before4xx - docs.length },
  startedAt,
});
