// Keep-alive Supabase: il free tier mette in pausa il progetto dopo 7 giorni di
// inattività. Una query settimanale lo tiene attivo e fa da health check.

import { makeClient, loadEnv } from '../src/db.mjs';

const g = loadEnv('.env.local');
const client = makeClient(g);
await client.connect();
const { rows } = await client.query(
  'select now() as ts, (select count(*)::int from public.competitor_snapshots) as snapshots',
);
await client.end();
console.log(`keep-alive ok: ${rows[0].ts} — ${rows[0].snapshots} snapshot in competitor_snapshots`);
