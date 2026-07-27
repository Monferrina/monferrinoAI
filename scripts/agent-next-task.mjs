// Sceglie il PROSSIMO lavoro dal backlog SEO e ne produce il briefing.
// Qui non si genera contenuto: si decide su cosa. La scrittura dell'articolo la fa una
// persona con Claude Code in locale, partendo da questo briefing e da prompts/genera-articolo.md.
//
// Uso:
//   node scripts/agent-next-task.mjs                         # briefing JSON su stdout
//   node scripts/agent-next-task.mjs --content-type faq      # solo di quel tipo
//   node scripts/agent-next-task.mjs --email                 # invia il briefing e marca la keyword
//   node scripts/agent-next-task.mjs --dry-run [--email]     # esempio offline, nessuna connessione
//
// Env: gli stessi di db.mjs + VOYAGE_API_KEY (embedding della keyword per il RAG);
//      con --email anche RESEND_API_KEY e DIGEST_TO (csv di destinatari).
// Exit 1 = backlog vuoto o errore: un run che non ha nulla da fare deve dirlo, non uscire
// verde. Il backlog esaurito non è un guasto ma va visto, e l'alert del workflow è già lì.
//
// SICUREZZA (§3 di prompts/genera-articolo.md, seconda linea dopo scanContent sull'ingest):
// il briefing NON contiene una riga di content_md. Del RAG escono solo url e distanza.
// Il testo scrapato è input non fidato: se non entra nel briefing, non può entrare nel prompt.

import { pathToFileURL } from 'node:url';
import { makeClient, loadEnv } from '../src/db.mjs';
import { embed } from '../src/fetchers.mjs';
import { sendEmail, esc } from '../src/mailer.mjs';
import { logAiRun } from '../src/ai-log.mjs';

// Normalizza il testo che arriva dal DB prima di finire nel briefing: whitespace collassato
// (niente newline che simulino un cambio di turno) e lunghezza tagliata.
// Le keyword vengono da un harvest esterno, quindi sono dati altrui anche se sembrano innocue.
const clean = (s, max) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim().slice(0, max));
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Query della candidata. Il filtro opzionale passa come parametro anche quando è null
 * ($1 is null = nessun filtro): una sola SQL, nessuna concatenazione di stringhe.
 * Ordine: volume desc, kd asc, keyword — l'ultimo campo rende il run riproducibile a parità
 * di volume/kd, altrimenti la scelta dipenderebbe dall'ordine fisico delle righe.
 */
export function candidateQuery(contentType = null) {
  return {
    text: `select id, keyword, cluster, search_volume, kd, intent, content_type, target_page
             from public.seo_keywords
            where status = 'todo'
              and coalesce(is_noise, false) = false
              and ($1::text is null or content_type = $1)
            order by search_volume desc nulls last, kd asc nulls last, keyword asc
            limit 1`,
    values: [contentType ?? null],
  };
}

/**
 * Testo da embeddare per cercare nel RAG. NON la sola keyword: verificato sulle 6 candidate
 * in cima al backlog, la keyword secca è sempre la query peggiore e su «docce» (distanza
 * 0,77) pescava /blog invece di /servizi/box-doccia, che è la sua stessa target_page.
 * Con cluster e target_page accodati la distanza scende (0,77 → 0,47) e la pagina giusta
 * arriva prima su 6 casi su 6. Una keyword di 1-2 parole non ha abbastanza segnale da sola.
 */
export function ragQuery(kw) {
  return [kw.keyword, kw.cluster, kw.target_page].filter(Boolean).join(' ');
}

// Le 3 pagine del sito semanticamente più vicine alla keyword.
// distinct on (url): site_pages è versionata (insert idempotente su url+content_hash), senza
// dedup le 3 righe potevano essere 3 versioni della stessa pagina — e il RAG diceva una cosa sola.
const VICINE_SQL = `
  select url, distanza from (
    select distinct on (url) url, embedding <=> $1::vector as distanza
      from public.site_pages
     where embedding is not null
     order by url, 2
  ) t
  order by distanza
  limit 3`;

/**
 * Le sezioni della pagina target, in ordine di lettura, con la distanza di ognuna dalla
 * keyword. Risponde alla domanda delle keyword `onpage-enrich`, che sono più della metà del
 * backlog: non «quale pagina tocco» (lo dice già target_page) ma «cosa c'è già su quella
 * pagina e dove manca il pezzo». Ordinate per chunk_index e non per distanza, perché serve
 * vedere la struttura della pagina, non una classifica.
 *
 * Il confronto normalizza entrambi i lati a un percorso senza dominio né slash finale:
 * site_chunks salva l'URL intero, il backlog salva lo slug.
 */
const SEZIONI_SQL = `
  select heading, chunk_index, embedding <=> $1::vector as distanza
    from (
      select heading, chunk_index, embedding,
             coalesce(nullif(rtrim(regexp_replace(url, '^https?://[^/]+', ''), '/'), ''), '/') as percorso
        from public.site_chunks
    ) t
   where percorso = coalesce(nullif(rtrim($2, '/'), ''), '/')
   order by chunk_index`;

// Una keyword briefata non deve ripresentarsi il lunedì dopo: senza questo UPDATE lo script
// è deterministico e manderebbe per sempre la stessa candidata. 'briefed' è uno stato
// intermedio fra 'todo' e 'published': se l'articolo non viene scritto la riga resta lì,
// visibile, e si rimette a 'todo' a mano. Il filtro on status evita di riscrivere una riga
// che nel frattempo qualcuno ha già portato a 'published'.
const MARCA_SQL = `update public.seo_keywords set status = 'briefed' where id = $1 and status = 'todo'`;

/**
 * Briefing: riga di seo_keywords + vicine di site_pages → JSON per chi scriverà l'articolo.
 * Pura, così il --dry-run stampa esattamente la stessa forma della produzione.
 */
export function buildBriefing(kw, vicine = [], sezioni = []) {
  return {
    keyword: clean(kw.keyword, 200),
    cluster: clean(kw.cluster, 120),
    volume: num(kw.search_volume),
    kd: num(kw.kd),
    intent: clean(kw.intent, 40),
    content_type: clean(kw.content_type, 40),
    target_page: clean(kw.target_page, 300),
    // Solo url + distanza: serve a NON riproporre roba che c'è già.
    // Nessun testo delle pagine, di proposito (vedi nota sicurezza in testa al file).
    gia_esistente: vicine.slice(0, 3).map((r) => {
      const d = num(r.distanza); // pg torna i float8 come stringa: Number() prima di arrotondare
      return { url: clean(r.url, 300), distanza: d === null ? null : Math.round(d * 1e4) / 1e4 };
    }),
    // Le sezioni della pagina target, in ordine di lettura. Anche qui solo heading e
    // distanza: il testo della sezione resta nel DB, non entra nel briefing.
    sezioni_pagina: sezioni.map((r) => {
      const d = num(r.distanza);
      return { heading: clean(r.heading, 200), distanza: d === null ? null : Math.round(d * 1e4) / 1e4 };
    }),
  };
}

/**
 * Email del briefing. Il JSON grezzo resta in fondo dentro un <pre>: è quello che si copia
 * e si incolla in Claude Code, e deve arrivare intatto anche se la tabella sopra cambia.
 */
export function buildBriefingHtml(b) {
  const BRAND = '#b56c33';
  const riga = (k, v) =>
    `<tr><td style="padding:4px 8px;color:#666">${k}</td><td style="padding:4px 8px"><strong>${esc(v ?? '—')}</strong></td></tr>`;

  const vicine = b.gia_esistente.length
    ? `<table style="border-collapse:collapse;font-size:14px">${b.gia_esistente
        .map(
          (r) =>
            `<tr><td style="padding:4px 8px"><a href="${esc(r.url)}" style="color:${BRAND}">${esc(r.url)}</a></td>` +
            `<td style="padding:4px 8px;text-align:right;color:#666">${r.distanza ?? '—'}</td></tr>`,
        )
        .join('')}</table>` +
      '<p style="color:#999;font-size:12px;margin:6px 0 0">Distanza coseno: più bassa = più simile. Sotto 0,35 il tema è già coperto bene.</p>'
    : '<p>Nessuna pagina simile nel RAG: argomento scoperto.</p>';

  // Le sezioni della pagina target, tutte e in ordine di lettura. Il valore è la STRUTTURA:
  // si vede cosa la pagina già copre senza aprirla. Le distanze sono un indizio debole e
  // vanno presentate come tali: misurate sulle pagine reali, lo scarto fra la sezione più
  // vicina e la più lontana sta fra 0,01 e 0,15, perché una pagina di quattro sezioni sul
  // box doccia parla di box doccia in tutte e quattro.
  const sezioni = b.sezioni_pagina.length
    ? `<table style="border-collapse:collapse;font-size:14px">${b.sezioni_pagina
        .map(
          (s) =>
            `<tr><td style="padding:4px 8px">${esc(s.heading ?? '(apertura)')}</td>` +
            `<td style="padding:4px 8px;text-align:right;color:#666">${s.distanza ?? '—'}</td></tr>`,
        )
        .join('')}</table>` +
      '<p style="color:#999;font-size:12px;margin:6px 0 0">Questa è la struttura attuale della pagina. Le distanze qui dentro sono vicine fra loro (tutte le sezioni parlano dello stesso argomento): servono a orientarsi, non a decidere.</p>'
    : `<p>La pagina <code>${esc(b.target_page ?? '')}</code> non è ancora nel RAG: o non esiste, o l'ingest non l'ha ancora vista.</p>`;

  return `<!doctype html><html lang="it"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:640px;margin:0 auto;padding:24px">
<h1 style="font-size:22px;color:${BRAND};margin:0">Briefing settimanale — ${esc(b.keyword)}</h1>
<p style="color:#666;margin:4px 0 0">Scelta dal backlog. La scrittura è manuale: apri Claude Code sul repo del sito con <code>prompts/genera-articolo.md</code> e il JSON qui sotto.</p>
<h2 style="font-size:17px;margin:24px 0 6px;color:${BRAND}">🎯 La candidata</h2>
<table style="border-collapse:collapse;font-size:14px">
${riga('keyword', b.keyword)}${riga('cluster', b.cluster)}${riga('volume', b.volume)}${riga('kd', b.kd)}${riga('intent', b.intent)}${riga('tipo', b.content_type)}${riga('pagina target', b.target_page)}
</table>
<h2 style="font-size:17px;margin:24px 0 6px;color:${BRAND}">🔎 Cosa esiste già sul sito</h2>
${vicine}
<h2 style="font-size:17px;margin:24px 0 6px;color:${BRAND}">📄 Le sezioni di ${esc(b.target_page ?? 'la pagina target')}</h2>
${sezioni}
<h2 style="font-size:17px;margin:24px 0 6px;color:${BRAND}">🛠️ Da qui in poi, a mano</h2>
<ol style="font-size:14px;padding-left:20px;margin:0">
<li>Apri Claude Code nel repo del sito.</li>
<li>Incolla <code>prompts/genera-articolo.md</code> (repo monferrinoAI) e il JSON qui sotto.</li>
<li>Prima della PR, nel repo del sito: <code>npm run lint</code>, <code>npx astro check</code>, <code>npx vitest run</code>.</li>
</ol>
<p style="color:#999;font-size:12px;margin:6px 0 0">Non usare <code>/blog-write</code>: i suoi default (2.000+ parole, statistiche, immagini stock, grafici) vanno contro le regole editoriali del sito. Il perché sta in testa a <code>genera-articolo.md</code>.</p>
<h2 style="font-size:17px;margin:24px 0 6px;color:${BRAND}">📋 Briefing da incollare</h2>
<pre style="background:#f6f6f6;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto">${esc(JSON.stringify(b, null, 2))}</pre>
<hr style="border:none;border-top:1px solid #eee;margin:28px 0 12px">
<p style="color:#999;font-size:12px">Generato da monferrinoAI · la keyword è passata a <code>briefed</code>: se non la scrivi, rimettila a <code>todo</code>.</p>
</body></html>`;
}

// Esempio del --dry-run: dati finti, stesse funzioni di build → se la forma cambia, cambia qui.
const ESEMPIO = {
  kw: {
    keyword: 'montare box doccia', cluster: 'box-doccia', search_volume: 480, kd: 21,
    intent: 'informational', content_type: 'faq', target_page: '/blog/montare-siliconare-box-doccia',
  },
  vicine: [
    { url: 'https://vetreriamonferrina.com/blog/montare-siliconare-box-doccia', distanza: 0.1842 },
    { url: 'https://vetreriamonferrina.com/servizi/box-doccia', distanza: 0.2913 },
    { url: 'https://vetreriamonferrina.com/faq', distanza: 0.4107 },
  ],
  sezioni: [
    { heading: null, chunk_index: 0, distanza: 0.3812 },
    { heading: 'Caratteristiche', chunk_index: 1, distanza: 0.4091 },
    { heading: 'Quando scegliere box doccia', chunk_index: 2, distanza: 0.4405 },
    { heading: 'Domande frequenti', chunk_index: 3, distanza: 0.4127 },
  ],
};

async function main() {
  const startedAt = new Date();
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--content-type');
  const contentType = i > -1 ? argv[i + 1] : null;
  const email = argv.includes('--email');

  if (argv.includes('--dry-run')) {
    const b = buildBriefing(ESEMPIO.kw, ESEMPIO.vicine, ESEMPIO.sezioni);
    console.log(email ? buildBriefingHtml(b) : JSON.stringify(b, null, 2));
    return;
  }

  const g = loadEnv('.env.local');
  const voyage = g('VOYAGE_API_KEY');
  // Senza embedding il briefing uscirebbe con gia_esistente vuoto: chi scrive crederebbe che
  // il sito non copre nulla e duplicherebbe. Meglio fermarsi che produrre un briefing bugiardo.
  if (!voyage) throw new Error('VOYAGE_API_KEY mancante: senza RAG non so cosa esiste già.');

  const apiKey = email ? g('RESEND_API_KEY') : null;
  // BRIEFING_TO e non DIGEST_TO: il digest è un report per il titolare, il briefing è un
  // ordine di lavoro per chi scrive l'articolo. Fallback su DIGEST_TO per non restare muti
  // se il secret non è ancora stato creato. Gli indirizzi stanno nei secret, mai qui:
  // questo repo è pubblico.
  const to = (g('BRIEFING_TO') || g('DIGEST_TO') || '').split(',').map((s) => s.trim()).filter(Boolean);
  // I controlli sull'invio stanno PRIMA della query: fallire dopo aver marcato la keyword
  // significherebbe bruciarla senza che l'email sia partita.
  if (email && !apiKey) throw new Error('RESEND_API_KEY mancante.');
  if (email && !to.length) throw new Error('BRIEFING_TO mancante (csv di destinatari).');

  const client = makeClient(g);
  await client.connect();
  try {
    const q = candidateQuery(contentType);
    const { rows: [kw] } = await client.query(q.text, q.values);
    if (!kw) {
      const filtro = contentType ? ` con content_type='${contentType}'` : '';
      console.error(`Backlog vuoto: nessuna keyword status='todo' non-noise${filtro}. Niente da fare.`);
      process.exitCode = 1;
      return;
    }

    const [vec] = await embed([ragQuery(kw)], 'query', voyage);
    const vettore = `[${vec.join(',')}]`;
    const { rows: vicine } = await client.query(VICINE_SQL, [vettore]);
    const { rows: sezioni } = kw.target_page
      ? await client.query(SEZIONI_SQL, [vettore, kw.target_page])
      : { rows: [] };
    const briefing = buildBriefing(kw, vicine, sezioni);

    if (!email) {
      console.log(JSON.stringify(briefing, null, 2));
      return;
    }

    const res = await sendEmail(
      {
        from: g('DIGEST_FROM') || 'MonferrinoSEO <agente@vetreriamonferrina.com>',
        to,
        subject: `MonferrinoSEO — briefing: ${briefing.keyword}`,
        html: buildBriefingHtml(briefing),
      },
      apiKey,
    );
    // Marcatura DOPO l'invio: se Resend fallisce la keyword resta 'todo' e torna lunedì.
    // Il caso opposto (marcata ma non spedita) perderebbe la candidata in silenzio.
    const marcate = (await client.query(MARCA_SQL, [kw.id])).rowCount;
    console.log(`Briefing "${briefing.keyword}" inviato a ${to.join(', ')} — id ${res.id}, marcate ${marcate}`);

    // Registro attività AI (AI Act art. 12).
    await logAiRun(g, {
      job: 'agent-briefing',
      summary: `briefing "${briefing.keyword}" a ${to.length} destinatari`,
      meta: { keyword_id: kw.id, vicine: briefing.gia_esistente.length, resend_id: res.id },
      startedAt,
    });
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main().catch((e) => {
    console.error(`agent-next-task: ${e.message.split('\n')[0]}`);
    process.exit(1);
  });
}
