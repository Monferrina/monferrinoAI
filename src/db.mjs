// Connessione Supabase + insert idempotente per competitor_snapshots.
// Pooler IPv4 (il direct host db.<ref>.supabase.co è IPv6-only → ENOTFOUND).

import fs from 'node:fs';
import pg from 'pg';

// Legge .env.local senza dipendenze (i segreti restano solo lì). Ritorna getter g(KEY).
export function loadEnv(path = '.env.local') {
  const env = fs.readFileSync(path, 'utf8');
  return (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1].trim();
}

// port 6543 = transaction mode (default, ok per insert batch di produzione).
// port 5432 = session mode (sticky): necessario per le TEMP TABLE dei test —
// in transaction mode il pool non le isola tra connessioni.
export function makeClient(g, { port = 6543 } = {}) {
  const ref = g('SUPABASE_DB_HOST').split('.')[1]; // db.<ref>.supabase.co → <ref>
  const region = g('SUPABASE_PROJECT_REGION');
  return new pg.Client({
    host: `aws-0-${region}.pooler.supabase.com`,
    port,
    database: g('SUPABASE_DB_NAME'),
    user: `${g('SUPABASE_DB_USER')}.${ref}`, // postgres.<ref>
    password: g('SUPABASE_DB_PASSWORD'), // raw (contiene '#'): niente url-encoding
    ssl: { rejectUnauthorized: false },
  });
}

const COLS = [
  'domain', 'url', 'page_type', 'status_code', 'language', 'title', 'description',
  'page_modified_at', 'change_status', 'previous_scrape_at', 'content_md', 'content_hash', 'embedding',
];

// Insert idempotente: ON CONFLICT (url, content_hash) DO NOTHING.
// Tabella non qualificata → in produzione colpisce public.competitor_snapshots,
// nei test la temp table omonima (precedenza nella search_path). Ritorna 1=inserito, 0=duplicato.
export async function insertSnapshot(client, r) {
  const placeholders = COLS.map((c, i) => (c === 'embedding' ? `$${i + 1}::vector` : `$${i + 1}`));
  const values = COLS.map((c) => (c === 'embedding' ? `[${r.embedding.join(',')}]` : r[c] ?? null));
  const sql = `insert into competitor_snapshots (${COLS.join(', ')})
    values (${placeholders.join(', ')})
    on conflict (url, content_hash) do nothing`;
  const res = await client.query(sql, values);
  return res.rowCount;
}
