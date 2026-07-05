// Fetcher esterni della pipeline: scrape (Firecrawl CLI) + embed (Voyage).
// Estratti qui perché condivisi da ingest-competitors, ingest-site ed e2e —
// una sola sede per il modello Voyage e per la gestione della CLI Firecrawl.

import { execFileSync } from 'node:child_process';

// Redazione PII sul markdown, PRIMA di embed/storage/hash. Sole regex, zero librerie.
// Conservativa: maschera email e telefoni IT (fisso/mobile, con/senza +39, separatori
// spazi/punti/trattini) senza toccare misure ("6 mm"), anni ("2024") o codici corti.
// ponytail: redazione email+tel via regex; i nomi propri NON sono coperti (servirebbe un NER)
// — accettabile per pagine competitor B2B di edilizia. Aggiungere NER solo se un audit lo richiede.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// (?<!\d)…(?!\d): niente match parziali dentro numeri più lunghi (es. codici/ID).
// Prefisso +39/0039 opzionale; poi fisso 0+prefisso+5-8 cifre, oppure mobile 3XX+3+3/4 cifre.
// Il minimo di cifre richiesto tiene fuori misure e anni.
const TEL_RE = /(?<!\d)(?:(?:\+|00)39[\s.-]?)?(?:0\d{1,3}[\s.-]?\d{5,8}|3\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4})(?!\d)/g;

export function redact(md) {
  if (!md) return md;
  return String(md).replace(EMAIL_RE, '[email]').replace(TEL_RE, '[tel]');
}

// Scrape singolo via CLI Firecrawl → doc (markdown + metadata + changeTracking) o null.
// onlyMainContent: scarta nav/footer (competitor/site). retry: 1 tentativo extra su errore transitorio.
export function scrape(url, { onlyMainContent = true, retry = true } = {}) {
  const args = ['scrape', url, '--format', 'markdown', '--json'];
  if (onlyMainContent) args.push('--only-main-content');
  for (let attempt = 0; attempt <= (retry ? 1 : 0); attempt++) {
    try {
      const out = execFileSync('firecrawl', args,
        { encoding: 'utf8', maxBuffer: 50_000_000, stdio: ['ignore', 'pipe', 'pipe'] });
      const j = JSON.parse(out);
      return j.data ?? j;
    } catch (e) {
      if (retry && attempt === 0) { console.warn(`  retry ${url}`); continue; }
      // stderr della CLI = errore vero (rate-limit, auth, URL morto); più utile del generico "Command failed".
      const detail = (e.stderr?.toString().trim() || e.message).split('\n')[0];
      console.error(`  SCRAPE FALLITO ${url}: ${detail}`);
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
  // r.ok PRIMA di r.json(): un 5xx/rate-limit può tornare HTML/testo → r.json() esploderebbe
  // con un errore opaco, nascondendo lo status reale.
  if (!r.ok) throw new Error(`Voyage ${r.status}: ${(await r.text().catch(() => '')).slice(0, 500)}`);
  const b = await r.json();
  return b.data.map((d) => d.embedding);
}
