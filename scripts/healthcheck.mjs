// Health check settimanale del sito: home + sitemap + campione di pagine reali.
// HTTP diretto (no Firecrawl, zero crediti). Nessuna assunzione sugli slug: le
// pagine si leggono dal sitemap (fonte autorevole, regola "no assumptions" del brief).
// Esce con codice 1 se il sito è giù → il workflow fallisce e GitHub notifica.

const BASE = process.env.SITE_URL || 'https://vetreriamonferrina.com';
const SAMPLE = 6; // pagine dal sitemap da verificare a campione
const SLOW_MS = 3000; // soglia warning di lentezza

async function check(url) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    return { url, status: r.status, ok: r.ok, ms: Math.round(performance.now() - t0), res: r };
  } catch (e) {
    return { url, status: 0, ok: false, ms: Math.round(performance.now() - t0), error: e.message };
  }
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const results = [];
const fails = [];
const record = (r, label) => { results.push(r); if (!r.ok) fails.push(`${label} ${r.status || r.error}`); };

// 1. home
record(await check(BASE), 'home');

// 2. sitemap (gestisce il sitemap-index: segue il primo sub-sitemap)
const sm = await check(new URL('/sitemap.xml', BASE).href);
record(sm, 'sitemap');
let pages = [];
if (sm.ok) {
  const all = locs(await sm.res.text());
  pages = all.filter((u) => !u.endsWith('.xml'));
  if (!pages.length && all.length) { // è un index → segui il primo sotto-sitemap
    const sub = await check(all[0]);
    record(sub, 'sub-sitemap');
    if (sub.ok) pages = locs(await sub.res.text()).filter((u) => !u.endsWith('.xml'));
  }
}

// 3. campione UNIFORME sul sitemap (copre blog/servizi/statiche, non solo le prime)
const pool = pages.filter((u) => u.replace(/\/$/, '') !== BASE.replace(/\/$/, ''));
const step = Math.max(1, Math.ceil(pool.length / SAMPLE));
const sample = pool.filter((_, i) => i % step === 0).slice(0, SAMPLE);
for (const u of sample) record(await check(u), new URL(u).pathname);

// report
console.log(`Health check ${BASE} — ${results.length} URL:`);
for (const r of results) {
  const slow = r.ok && r.ms > SLOW_MS ? ' ⚠ lento' : '';
  console.log(`  ${r.ok ? '✓' : '✗'} ${String(r.status || 'ERR').padEnd(3)} ${String(r.ms).padStart(5)}ms  ${r.url}${slow}`);
}
console.log(`sitemap: ${pages.length} pagine, campione verificato: ${sample.length}`);

if (fails.length) { console.error(`\n❌ Health check FALLITO: ${fails.join(', ')}`); process.exit(1); }
console.log('\n✅ Sito raggiungibile.');
