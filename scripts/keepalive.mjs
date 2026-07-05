// Keep-alive Supabase: il free tier mette in pausa il progetto dopo 7 giorni di
// inattività. Una query settimanale lo tiene attivo e fa da health check.

import { makeClient, loadEnv } from '../src/db.mjs';

// Retention GDPR (art. 5(1)(e) — limitazione della conservazione): gli snapshot competitor
// si conservano al massimo 3 mesi. Enforcement qui perché il keepalive è già connesso al DB e
// gira 2×/settimana (lun+gio) → età massima effettiva ~90+4 giorni. ponytail: piggyback sul
// keepalive, niente pg_cron; se un giorno servisse enforcement esatto giornaliero → pg_cron.
const RETENTION_DAYS = 90;

const g = loadEnv('.env.local');
const client = makeClient(g);
await client.connect();
const { rowCount: purged } = await client.query(
  'delete from public.competitor_snapshots where scraped_at < now() - make_interval(days => $1)',
  [RETENTION_DAYS],
);
const { rows } = await client.query(
  'select now() as ts, (select count(*)::int from public.competitor_snapshots) as snapshots',
);
await client.end();
console.log(
  `keep-alive ok: ${rows[0].ts} — ${rows[0].snapshots} snapshot in competitor_snapshots ` +
    `(retention ${RETENTION_DAYS}gg: ${purged} cancellati)`,
);
