// Trasformazione e validazione dei record competitor_snapshots.
// Funzioni pure, zero dipendenze esterne (solo node:crypto/url) — base della piramide di test.
// La pipeline (scrape Firecrawl → embed Voyage → insert Supabase) importa queste funzioni.

import crypto from 'node:crypto';
import { URL } from 'node:url';

export const EMBED_DIM = 1024; // voyage-4

export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Scrape doc Firecrawl (markdown + metadata + changeTracking) → record DB (senza embedding).
// L'embedding viene aggiunto a valle dal batch Voyage, poi si valida il record completo.
export function toSnapshot(doc, page_type) {
  const m = doc.metadata ?? {};
  const ct = doc.changeTracking;
  const url = m.sourceURL || m.url;
  const content_md = doc.markdown || '';
  return {
    domain: new URL(url).hostname.replace(/^www\./, ''),
    url,
    page_type,
    status_code: m.statusCode ?? null,
    language: m.language ?? null,
    title: m.title ?? null,
    description: m.description ?? null,
    page_modified_at: m['article:modified_time'] || m.modifiedTime || null,
    change_status: ct?.changeStatus ?? null,
    previous_scrape_at: ct?.previousScrapeAt ?? null,
    content_md,
    content_hash: sha256(content_md),
  };
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
