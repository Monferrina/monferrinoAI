// Trasformazione e validazione dei record competitor_snapshots.
// Funzioni pure, zero dipendenze esterne (solo node:crypto/url) — base della piramide di test.
// La pipeline (scrape Firecrawl → embed Voyage → insert Supabase) importa queste funzioni.

import crypto from 'node:crypto';
import { URL } from 'node:url';
// redact() vive in fetchers.mjs (sede dei fetcher esterni); qui è l'UNICO punto in cui si
// costruisce content_md, quindi redigere qui pulisce in un colpo solo embedding + storage + hash
// di dedup, per competitor e sito (entrambi passano da toSnapshot). Nessun ciclo: fetchers non
// importa snapshot. redact è pura regex, non intacca la testabilità di questo modulo.
import { redact } from './fetchers.mjs';

export const EMBED_DIM = 1024; // voyage-4
// Cap sul markdown prima di embed+hash: evita payload Voyage sovradimensionati.
// ponytail: cap fisso ~8k token; alzalo se il RAG deve indicizzare pagine più lunghe.
export const MAX_CONTENT_CHARS = 32_000;

export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Euristica page_type dall'URL (per QC/segmentazione, vedi playbook).
export function pageType(url) {
  const p = new URL(url).pathname.replace(/\/+$/, '').toLowerCase();
  if (p === '') return 'home';
  if (/(^|\/)(blog|news|articol)/.test(p)) return 'blog';
  if (/(^|\/)(shop|prodott|product|store)/.test(p)) return 'shop';
  return 'servizio';
}

// Scrape doc Firecrawl (markdown + metadata + changeTracking) → record DB (senza embedding).
// L'embedding viene aggiunto a valle dal batch Voyage, poi si valida il record completo.
export function toSnapshot(doc, page_type) {
  const m = doc.metadata ?? {};
  const ct = doc.changeTracking;
  const url = m.sourceURL || m.url;
  // redact PRIMA di slice+hash: PII fuori da embedding, testo salvato e hash di dedup in un colpo solo.
  const content_md = redact(doc.markdown || '').slice(0, MAX_CONTENT_CHARS);
  return {
    domain: new URL(url).hostname.replace(/^www\./, ''),
    url,
    page_type,
    status_code: m.statusCode ?? null,
    language: m.language ?? null,
    // Redatti come il body: un recapito nella <meta description> non deve restare in
    // chiaro mentre lo stesso numero nel testo diventa [tel]. redact(null) ritorna null.
    title: redact(m.title ?? null),
    description: redact(m.description ?? null),
    page_modified_at: m['article:modified_time'] || m.modifiedTime || null,
    change_status: ct?.changeStatus ?? null,
    previous_scrape_at: ct?.previousScrapeAt ?? null,
    content_md,
    content_hash: sha256(content_md),
  };
}

// Guardrail anti-codice/injection sul markdown scrapato (input di terzi NON fidato).
// Ritorna l'elenco delle minacce (array vuoto = contenuto pulito). Stessa logica di scarto
// di validateSnapshot/4xx: quello che matcha NON entra nel RAG. Va eseguito PRIMA dell'embed.
// Le pagine competitor sono marketing/servizi di vetrerie: codice, <script> o frasi tipo
// "ignora le istruzioni" sono anomali per definizione → scarto sicuro.
// ponytail: euristiche a regex/densità, non un parser. Sufficiente per il profilo (contenuto
// edilizia B2B); rivedere le soglie solo se un corpus legittimamente tecnico va indicizzato.

// Frasi di prompt-injection (IT/EN). Pattern stretti: intento esplicito di scavalcare le istruzioni.
const INJECTION_RES = [
  // I determinanti si accumulano ("tutte le istruzioni"), quindi il gruppo va ripetuto:
  // con un solo `?` opzionale "tutte " lo consumava e "le istruzioni" non veniva piu' raggiunto.
  // {0,3} tiene il quantificatore limitato → nessun ReDoS.
  /(?:ignor(?:e|a|are)|dimentica)\s+(?:(?:all|the|any|tutt[ei]|l[ea]|ogni)\s+){0,3}(?:previous|prior|above|preceding|precedent\w*)?\s*(?:instructions?|prompts?|istruzion\w+)/i,
  /disregard\s+.{0,30}?(?:instructions?|prompt|rules?)/i,
  /forget\s+(?:all\s+|everything\s+|your\s+)?(?:previous|prior|above)?\s*(?:instructions?|rules?|prompt)/i,
  /(?:new|updated|revised|nuove?)\s+(?:instructions?|istruzion\w+)\s*[:-]/i,
  /(?:system|developer)\s+(?:prompt|message|instructions?)/i,
  /(?:sei|agisci come|comportati come)\s+(?:ora\s+)?(?:un|una|il|la)\b.{0,40}?(?:assistente|modello|ai|dan)\b/i,
];
// Markup attivo: script, URI javascript:, handler inline. onlyMainContent ne toglie molto,
// ma un'iniezione nel corpo principale passerebbe.
const ACTIVE_MARKUP_RE = /<script\b|javascript:|\son(?:error|load|click|mouseover)\s*=/i;
// Blocchi di codice fenced ```…```; ne misuro la copertura sul contenuto.
const CODE_FENCE_RE = /```[\s\S]*?```/g;
// Sopra questa quota di contenuto dentro blocchi di codice = pagina "di codice", non testo.
const CODE_DENSITY_MAX = 0.3;

export function scanContent(md) {
  const s = String(md ?? '');
  const threats = [];
  if (INJECTION_RES.some((re) => re.test(s))) threats.push('prompt-injection sospetta');
  if (ACTIVE_MARKUP_RE.test(s)) threats.push('markup attivo (script/js)');
  const fenced = (s.match(CODE_FENCE_RE) || []).reduce((n, b) => n + b.length, 0);
  if (s.length > 0 && fenced / s.length > CODE_DENSITY_MAX) threats.push('densità di codice anomala');
  return threats;
}

// Ritorna l'elenco degli errori (array vuoto = record valido, pronto per l'insert).
// Un record con errori va scartato/segnalato, MAI inserito.
export function validateSnapshot(r) {
  const errs = [];

  try { new URL(r?.url); } catch { errs.push('url non valido'); }
  if (!r?.domain) errs.push('domain mancante');

  // status_code: intero HTTP 100–599
  if (!Number.isInteger(r?.status_code) || r.status_code < 100 || r.status_code > 599)
    errs.push('status_code non intero 100–599');

  if (!r?.language || !String(r.language).trim()) errs.push('language vuoto');
  if (!r?.content_md || !String(r.content_md).trim()) errs.push('content_md vuoto');

  // content_hash: sha256 (64 hex) e coerente col content_md (integrità)
  if (!/^[0-9a-f]{64}$/.test(r?.content_hash ?? ''))
    errs.push('content_hash non è uno sha256');
  else if (r?.content_md != null && r.content_hash !== sha256(r.content_md))
    errs.push('content_hash non corrisponde a content_md');

  // embedding: esattamente EMBED_DIM numeri finiti
  if (!Array.isArray(r?.embedding) || r.embedding.length !== EMBED_DIM)
    errs.push(`embedding.length != ${EMBED_DIM}`);
  else if (!r.embedding.every((x) => typeof x === 'number' && Number.isFinite(x)))
    errs.push('embedding contiene valori non numerici');

  // page_modified_at: opzionale, ma se presente dev'essere parsabile a timestamp
  if (r?.page_modified_at != null && Number.isNaN(Date.parse(r.page_modified_at)))
    errs.push('page_modified_at non parsabile');

  return errs;
}
