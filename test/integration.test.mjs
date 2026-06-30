// Integration: insert+query reali su Supabase contro una TEMP TABLE omonima a
// competitor_snapshots (LIKE ... INCLUDING ALL) → stessi vincoli/indici, zero
// residui in produzione. Embedding sintetici → nessun credito Voyage/Firecrawl.
// Si auto-skippa se manca .env.local (es. CI senza secrets).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeClient, loadEnv, insertSnapshot } from '../src/db.mjs';
import { validateSnapshot, sha256, EMBED_DIM } from '../src/snapshot.mjs';

let g = null;
try { g = loadEnv('.env.local'); } catch { /* no env → skip */ }
const skip = !(g && g('SUPABASE_DB_PASSWORD')) ? 'no .env.local / credenziali DB' : false;

let client;
before(async () => {
  if (skip) return;
  client = makeClient(g, { port: 5432 }); // session mode: temp table sticky + pulite a end()
  await client.connect();
  // temp table = clone con vincoli/indici (incl. UNIQUE(url,content_hash) e vector(1024))
  await client.query('create temp table competitor_snapshots (like public.competitor_snapshots including all)');
});
after(async () => { if (client) await client.end(); });

// vettore 1024-dim con `val` in posizione `pos`, resto 0
const vec = (pos, val = 1) => { const v = Array(EMBED_DIM).fill(0); v[pos] = val; return v; };

function rec(over = {}) {
  const content_md = over.content_md ?? `# Pagina ${over.url ?? ''}\nContenuto.`;
  return {
    domain: 'esempio.it', url: 'https://esempio.it/p', page_type: 'servizio',
    status_code: 200, language: 'it', title: 'T', description: 'D',
    page_modified_at: '2026-06-01T10:00:00+00:00', change_status: 'new', previous_scrape_at: null,
    content_md, content_hash: sha256(content_md), embedding: vec(0),
    ...over,
  };
}
const count = async () => (await client.query('select count(*)::int n from competitor_snapshots')).rows[0].n;

test('insert di un record valido → 1 riga, validateSnapshot pulito', { skip }, async () => {
  await client.query('truncate competitor_snapshots');
  const r = rec({ url: 'https://esempio.it/box-doccia' });
  assert.deepEqual(validateSnapshot(r), []);
  assert.equal(await insertSnapshot(client, r), 1);
  assert.equal(await count(), 1);
});

test('idempotenza: stesso (url, content_hash) due volte → 1 riga (2° insert saltato)', { skip }, async () => {
  await client.query('truncate competitor_snapshots');
  const r = rec({ url: 'https://esempio.it/specchi' });
  assert.equal(await insertSnapshot(client, r), 1);
  assert.equal(await insertSnapshot(client, r), 0); // ON CONFLICT DO NOTHING
  assert.equal(await count(), 1);
});

test('snapshot nuovo: stesso url ma contenuto cambiato (hash diverso) → 2 righe', { skip }, async () => {
  await client.query('truncate competitor_snapshots');
  const url = 'https://esempio.it/vetrate';
  await insertSnapshot(client, rec({ url, content_md: 'vecchio' }));
  await insertSnapshot(client, rec({ url, content_md: 'nuovo' }));
  assert.equal(await count(), 2);
});

test('retrieval cosine: la query torna prima la riga semanticamente più vicina', { skip }, async () => {
  await client.query('truncate competitor_snapshots');
  await insertSnapshot(client, rec({ url: 'https://esempio.it/a', content_md: 'A', embedding: vec(0) }));
  await insertSnapshot(client, rec({ url: 'https://esempio.it/b', content_md: 'B', embedding: vec(1) }));
  await insertSnapshot(client, rec({ url: 'https://esempio.it/c', content_md: 'C', embedding: vec(2) }));
  const q = vec(0); q[1] = 0.1; // più vicino ad A
  const { rows } = await client.query(
    `select url from competitor_snapshots order by embedding <=> $1::vector limit 1`,
    [`[${q.join(',')}]`],
  );
  assert.equal(rows[0].url, 'https://esempio.it/a');
});

test('il DB rifiuta un embedding di dimensione errata (vincolo vector(1024))', { skip }, async () => {
  await client.query('truncate competitor_snapshots');
  const bad = rec({ url: 'https://esempio.it/bad', embedding: Array(512).fill(0) });
  await assert.rejects(() => insertSnapshot(client, bad), /expected 1024 dimensions|different vector dimensions/i);
});
