// E2E della pipeline competitor: scrape → toSnapshot → embed → validate → insert → similarity.
// On-demand (`npm run test:e2e`): tocca rete e consuma ~2 crediti Firecrawl (Voyage gratis).
// Insert in TEMP TABLE (session mode) → zero residui in produzione. Self-check con assert.

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { toSnapshot, validateSnapshot, EMBED_DIM } from '../src/snapshot.mjs';
import { makeClient, loadEnv, insertSnapshot } from '../src/db.mjs';

const g = loadEnv('.env.local');
const VOYAGE = g('VOYAGE_API_KEY');

// 2 pagine reali: una home + una pagina servizio specifica → testa il retrieval semantico.
const URLS = [
  { url: 'https://vetrariacasalese.it', page_type: 'home' },
  { url: 'https://vetrariacasalese.it/box-doccia-casale-monferrato', page_type: 'servizio' },
];

function scrape(url) {
  const out = execFileSync('firecrawl', ['scrape', url, '--format', 'markdown', '--json'], { encoding: 'utf8', maxBuffer: 50_000_000 });
  const j = JSON.parse(out);
  return j.data ?? j;
}

async function embed(texts, input_type) {
  const r = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: 'voyage-4', input_type }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error('Voyage: ' + JSON.stringify(b));
  return b.data.map((d) => d.embedding);
}

// 1-2. scrape → record
const docs = URLS.map(({ url, page_type }) => toSnapshot(scrape(url), page_type));
console.log('scrape ok:', docs.map((d) => d.domain + new URL(d.url).pathname));

// 3. embed (documenti)
const embs = await embed(docs.map((d) => d.content_md), 'document');
docs.forEach((d, i) => { d.embedding = embs[i]; });

// 4. validate l'intera catena
assert.equal(embs[0].length, EMBED_DIM, `dim embedding != ${EMBED_DIM}`);
for (const d of docs) assert.deepEqual(validateSnapshot(d), [], `record non valido: ${d.url}`);

// 5. insert in temp table (session mode → sticky + auto-clean, zero residui)
const client = makeClient(g, { port: 5432 });
await client.connect();
await client.query('create temp table competitor_snapshots (like public.competitor_snapshots including all)');
let inserted = 0;
for (const d of docs) inserted += await insertSnapshot(client, d);
assert.equal(inserted, docs.length, 'insert incompleti');

// 6. similarity: per "box doccia" la pagina specifica deve battere la home
const [q] = await embed(['box doccia su misura per il bagno'], 'query');
const { rows } = await client.query(
  `select url, round((embedding <=> $1::vector)::numeric, 4) as cos
   from competitor_snapshots order by embedding <=> $1::vector`,
  [`[${q.join(',')}]`],
);
console.log('similarity:', rows);
const dist = Object.fromEntries(rows.map((r) => [r.url, Number(r.cos)]));
const box = Object.keys(dist).find((u) => /box-doccia/.test(u));
const home = Object.keys(dist).find((u) => !/box-doccia/.test(u));
assert.ok(dist[box] < dist[home], `box-doccia (${dist[box]}) dovrebbe battere la home (${dist[home]}) per "box doccia"`);

await client.end();
console.log('\n✅ E2E OK: scrape → toSnapshot → embed → validate → insert → similarity');
