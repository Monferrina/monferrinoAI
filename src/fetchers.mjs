// Fetcher esterni della pipeline: scrape (Firecrawl CLI) + embed (Voyage).
// Estratti qui perché condivisi da ingest-competitors, ingest-site ed e2e —
// una sola sede per il modello Voyage e per la gestione della CLI Firecrawl.

import { execFileSync } from 'node:child_process';

// Scrape singolo via CLI Firecrawl → doc (markdown + metadata + changeTracking) o null.
// onlyMainContent: scarta nav/footer (competitor/site). retry: 1 tentativo extra su errore transitorio.
export function scrape(url, { onlyMainContent = true, retry = true } = {}) {
  const args = ['scrape', url, '--format', 'markdown', '--json'];
  if (onlyMainContent) args.push('--only-main-content');
  for (let attempt = 0; attempt <= (retry ? 1 : 0); attempt++) {
    try {
      const out = execFileSync('firecrawl', args,
        { encoding: 'utf8', maxBuffer: 50_000_000, stdio: ['ignore', 'pipe', 'ignore'] });
      const j = JSON.parse(out);
      return j.data ?? j;
    } catch (e) {
      if (retry && attempt === 0) { console.warn(`  retry ${url}`); continue; }
      console.error(`  SCRAPE FALLITO ${url}: ${e.message.split('\n')[0]}`);
      return null;
    }
  }
}

// Embed batch via Voyage voyage-4 (dim 1024). input_type: 'document' per la KB, 'query' per la ricerca.
export async function embed(texts, input_type, apiKey) {
  const r = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: 'voyage-4', input_type }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error('Voyage: ' + JSON.stringify(b));
  return b.data.map((d) => d.embedding);
}
