// Applica il Layer 1 scope filter al backlog seo_keywords: marca is_noise le
// keyword fuori-scope (brand competitor, off-topic, geo fuori zona).
// Da rilanciare a ogni nuovo import di keyword così il backlog resta pulito.
//
// Uso:
//   node scripts/scope-filter.mjs           # dry-run: elenca cosa verrebbe marcato
//   node scripts/scope-filter.mjs --apply   # set is_noise=true sui match
//
// Costo: zero (solo query DB). Idempotente: rilanciabile senza effetti doppi.

import { makeClient, loadEnv } from '../src/db.mjs';
import { classifyScope } from '../src/scope-filter.mjs';

const apply = process.argv.includes('--apply');
const client = makeClient(loadEnv('.env.local'));
await client.connect();
try {
  const { rows } = await client.query(
    "select keyword from seo_keywords where status = 'todo' and is_noise = false",
  );
  const hits = rows
    .map((r) => ({ keyword: r.keyword, ...classifyScope(r.keyword) }))
    .filter((r) => r.noise);

  console.log(`Scansione ${rows.length} keyword todo → ${hits.length} fuori-scope:`);
  for (const h of hits) console.log(`  [${h.reason}] ${h.keyword}`);

  if (!hits.length) {
    console.log('Backlog già pulito, niente da marcare.');
  } else if (apply) {
    const res = await client.query(
      "update seo_keywords set is_noise = true where status = 'todo' and is_noise = false and keyword = any($1::text[])",
      [hits.map((h) => h.keyword)],
    );
    console.log(`Applicato: ${res.rowCount} keyword marcate is_noise.`);
  } else {
    console.log('(dry-run — rilancia con --apply per marcare)');
  }
} finally {
  await client.end();
}
