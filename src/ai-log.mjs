// Registro attività AI (AI Act art. 12, logging). Inserisce una riga in
// public.ai_run_log per ogni operazione automatica del sistema.
//
// NON-FATALE per design: il logging di conformità non deve MAI far fallire il job
// che sta tracciando. Se il DB è irraggiungibile, logga un warning e prosegue.

import { makeClient } from './db.mjs';

export async function logAiRun(g, { job, status = 'ok', summary = null, meta = null, startedAt = null }) {
  const client = makeClient(g);
  try {
    await client.connect();
    await client.query(
      `insert into public.ai_run_log (job, status, summary, meta, started_at, finished_at)
       values ($1, $2, $3, $4, coalesce($5, now()), now())`,
      [job, status, summary, meta ? JSON.stringify(meta) : null, startedAt],
    );
  } catch (e) {
    console.warn(`  ai_run_log: log '${job}' fallito (non bloccante): ${e.message.split('\n')[0]}`);
  } finally {
    await client.end().catch(() => {});
  }
}
