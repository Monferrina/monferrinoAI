// Digest mensile MonferrinoSEO → email via Resend.
// Legge da Supabase (posizionamento sito, cambi competitor, stato backlog keyword),
// costruisce un HTML sobrio e lo invia ai destinatari. Nessun dato inventato: se una
// sezione è vuota viene omessa; se non c'è nulla di rilevante non invia (niente spam).
//
// Uso:
//   node scripts/digest.mjs            # query + invio
//   node scripts/digest.mjs --dry-run  # query + stampa HTML, NESSUN invio
//
// Env: RESEND_API_KEY, DIGEST_TO (csv, obbligatorio per l'invio),
//      DIGEST_FROM (default 'MonferrinoSEO <agente@vetreriamonferrina.com>', dominio già verificato).

import { pathToFileURL } from 'node:url';
import { makeClient, loadEnv } from '../src/db.mjs';
import { logAiRun } from '../src/ai-log.mjs';

// --- Raccolta dati (tutte query di sola lettura) ---
async function collect(client) {
  const q = async (sql) => (await client.query(sql)).rows;

  const rankings = await q(`
    select keyword, position, prev_position, search_volume, url
    from seo_rankings
    where is_our_site = true
      and snapshot_date = (select max(snapshot_date) from seo_rankings where is_our_site = true)
    order by position asc nulls last`);

  const competitors = await q(`
    select domain,
           count(*) filter (where change_status is not null and change_status <> 'unchanged') as changed,
           count(*) as scanned,
           to_char(max(scraped_at), 'YYYY-MM-DD') as last_scan
    from competitor_snapshots
    where scraped_at >= now() - interval '35 days'
    group by domain
    order by changed desc, domain`);

  const backlog = await q(`
    select status, count(*)::int as n
    from seo_keywords
    where is_noise = false
    group by status
    order by n desc`);

  return { rankings, competitors, backlog };
}

// --- Costruzione HTML (funzione pura: input dati → stringa, testabile) ---
export function buildDigestHtml({ rankings, competitors, backlog }, monthLabel) {
  const BRAND = '#b56c33';
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const sections = [];

  // 1. Posizionamento sito
  if (rankings.length) {
    const movers = rankings
      .filter((r) => r.prev_position != null && r.position != null && r.prev_position !== r.position)
      .map((r) => ({ ...r, delta: r.position - r.prev_position }));
    const up = movers.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
    const down = movers.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
    const top = rankings.filter((r) => r.position != null).slice(0, 5);

    const row = (r, extra = '') =>
      `<tr><td style="padding:4px 8px">${esc(r.keyword)}</td>` +
      `<td style="padding:4px 8px;text-align:right">${r.position ?? '—'}</td>${extra}</tr>`;

    let html = `<p><strong>${rankings.length}</strong> keyword monitorate sul nostro dominio.</p>`;
    if (top.length) {
      html += `<p style="margin:8px 0 4px"><em>Migliori posizioni</em></p><table style="border-collapse:collapse;font-size:14px">${top.map((r) => row(r)).join('')}</table>`;
    }
    if (up.length) {
      html += `<p style="margin:8px 0 4px;color:#2e7d32"><em>In salita ▲</em></p><table style="border-collapse:collapse;font-size:14px">${up
        .map((m) => row(m, `<td style="padding:4px 8px;text-align:right;color:#2e7d32">+${-m.delta}</td>`))
        .join('')}</table>`;
    }
    if (down.length) {
      html += `<p style="margin:8px 0 4px;color:#c62828"><em>In discesa ▼</em></p><table style="border-collapse:collapse;font-size:14px">${down
        .map((m) => row(m, `<td style="padding:4px 8px;text-align:right;color:#c62828">-${m.delta}</td>`))
        .join('')}</table>`;
    }
    sections.push({ title: '📈 Posizionamento sito', html });
  }

  // 2. Competitor
  if (competitors.length) {
    const rows = competitors
      .map(
        (c) =>
          `<tr><td style="padding:4px 8px">${esc(c.domain)}</td>` +
          `<td style="padding:4px 8px;text-align:right">${c.changed}</td>` +
          `<td style="padding:4px 8px;text-align:right">${c.scanned}</td>` +
          `<td style="padding:4px 8px;text-align:right;color:#666">${esc(c.last_scan)}</td></tr>`,
      )
      .join('');
    const totChanged = competitors.reduce((s, c) => s + Number(c.changed), 0);
    sections.push({
      title: '🔍 Competitor (ultimi 35 giorni)',
      html:
        `<p><strong>${totChanged}</strong> pagine cambiate su ${competitors.length} domini monitorati.</p>` +
        `<table style="border-collapse:collapse;font-size:14px"><tr style="color:#666"><td style="padding:4px 8px">Dominio</td><td style="padding:4px 8px">Cambiate</td><td style="padding:4px 8px">Scansionate</td><td style="padding:4px 8px">Ultima</td></tr>${rows}</table>`,
    });
  }

  // 3. Backlog keyword
  if (backlog.length) {
    const total = backlog.reduce((s, b) => s + b.n, 0);
    const rows = backlog
      .map((b) => `<tr><td style="padding:4px 8px">${esc(b.status)}</td><td style="padding:4px 8px;text-align:right">${b.n}</td></tr>`)
      .join('');
    sections.push({
      title: '🗂️ Backlog keyword',
      html: `<p><strong>${total}</strong> keyword in scope.</p><table style="border-collapse:collapse;font-size:14px">${rows}</table>`,
    });
  }

  const body = sections
    .map((s) => `<h2 style="font-size:17px;margin:24px 0 6px;color:${BRAND}">${s.title}</h2>${s.html}`)
    .join('');

  return `<!doctype html><html lang="it"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:640px;margin:0 auto;padding:24px">
<h1 style="font-size:22px;color:${BRAND};margin:0">MonferrinoSEO — Digest ${esc(monthLabel)}</h1>
<p style="color:#666;margin:4px 0 0">Report automatico. Nessuna azione richiesta: le PR passano sempre da revisione umana.</p>
${body}
<hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px">
<p style="color:#999;font-size:12px">Generato da monferrinoAI · <a href="https://vetreriamonferrina.com" style="color:${BRAND}">vetreriamonferrina.com</a></p>
</body></html>`;
}

// --- Invio via Resend ---
async function send({ from, to, subject, html }, apiKey) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text().catch(() => '')).slice(0, 500)}`);
  return r.json();
}

// --- Main (solo se eseguito direttamente, non all'import dai test) ---
async function main() {
  const startedAt = new Date();
  const dryRun = process.argv.includes('--dry-run');
  const g = loadEnv('.env.local');

  const client = makeClient(g);
  await client.connect();
  let data;
  try {
    data = await collect(client);
  } finally {
    await client.end();
  }

  const hasContent = data.rankings.length || data.competitors.length || data.backlog.some((b) => b.n > 0);
  if (!hasContent) {
    console.log('Digest: nessun dato rilevante, invio saltato.');
    return;
  }

  const monthLabel = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const html = buildDigestHtml(data, monthLabel);
  const subject = `MonferrinoSEO — Digest ${monthLabel}`;

  if (dryRun) {
    console.log(html);
    console.log(`\n[dry-run] destinatari: ${process.env.DIGEST_TO || '(DIGEST_TO non impostato)'}`);
    return;
  }

  const apiKey = g('RESEND_API_KEY');
  const from = process.env.DIGEST_FROM || 'MonferrinoSEO <agente@vetreriamonferrina.com>';
  const to = (process.env.DIGEST_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!apiKey) throw new Error('RESEND_API_KEY mancante.');
  if (!to.length) throw new Error('DIGEST_TO mancante (csv di destinatari).');

  const res = await send({ from, to, subject, html }, apiKey);
  console.log(`Digest inviato a ${to.join(', ')} — id ${res.id}`);

  // Registro attività AI (AI Act): traccia l'invio.
  await logAiRun(g, {
    job: 'digest',
    summary: `inviato a ${to.length} destinatari`,
    meta: { rankings: data.rankings.length, competitors: data.competitors.length, resend_id: res.id },
    startedAt,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
