// Job monitor→DB: scrape delle pagine competitor → pipeline → insert idempotente
// in competitor_snapshots. Lista URL letta dal monitor Firecrawl live (source of truth).
// Idempotente (ON CONFLICT url,content_hash): rilanciabile, niente doppioni.
//
// Uso:
//   node scripts/ingest-competitors.mjs            # tutte le pagine del monitor (additivo, idempotente)
//   node scripts/ingest-competitors.mjs --limit 3  # primi N (test/budget)
//   node scripts/ingest-competitors.mjs --dry-run  # scrape+validate, NO insert
//   node scripts/ingest-competitors.mjs --fresh    # TRUNCATE prima (solo popolamento iniziale pulito)
//
// Costo: ~1 credito Firecrawl/pagina (scrape only-main-content, no judge). Voyage gratis (free tier per-modello).

import { execFileSync } from 'node:child_process';
import { toSnapshot, validateSnapshot, pageType } from '../src/snapshot.mjs';
import { makeClient, loadEnv, insertSnapshot } from '../src/db.mjs';
import { scrape, embed } from '../src/fetchers.mjs';

// Monitor "Competitor vetrerie" — source of truth della lista URL (vedi monitor/README.md)
const MONITOR_ID = '019f1363-7672-736b-af55-3e04baad06fd';

const argLimit = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();
const dryRun = process.argv.includes('--dry-run');
const fresh = process.argv.includes('--fresh');

const g = loadEnv('.env.local');
const VOYAGE = g('VOYAGE_API_KEY');

const mon = JSON.parse(execFileSync('firecrawl', ['monitor', 'get', MONITOR_ID], { encoding: 'utf8' })).data;
const urls = mon.targets.flatMap((t) => t.urls).slice(0, argLimit);
console.log(`Ingest ${urls.length} pagine dal monitor "${mon.name}" (dry-run: ${dryRun})`);

// 1-2. scrape → record (gli scrape falliti si scartano)
const docs = [];
for (const url of urls) {
  const doc = scrape(url);
  if (doc) docs.push(toSnapshot({ ...doc, metadata: { ...doc.metadata, sourceURL: doc.metadata?.sourceURL || url } }, pageType(url)));
}
console.log(`scrape ok: ${docs.length}/${urls.length}`);
if (!docs.length) process.exit(1);

// 3. embed (un solo batch: 30 pagine « 8M TPM Tier 1)
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

// 5. insert idempotente in competitor_snapshots reale (batch mode 6543: solo autocommit insert)
const client = makeClient(g);
await client.connect();
if (fresh) { await client.query('truncate public.competitor_snapshots restart identity'); console.log('--fresh: tabella svuotata.'); }
let inserted = 0;
for (const d of valid) inserted += await insertSnapshot(client, d);
await client.end();

console.log(`\n✅ Ingest: ${inserted} nuovi, ${valid.length - inserted} già presenti (dedup), ${docs.length - valid.length} scartati, ${urls.length - docs.length} scrape falliti.`);
