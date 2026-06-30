import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSnapshot, validateSnapshot, sha256, EMBED_DIM } from '../src/snapshot.mjs';

// --- toSnapshot: trasformazione scrape Firecrawl → record DB ---

const SCRAPE = {
  markdown: '# Vetreria\nBox doccia su misura.',
  metadata: {
    sourceURL: 'https://www.vetrariacasalese.it/box-doccia',
    statusCode: 200,
    language: 'it',
    title: 'Box doccia',
    description: 'Box doccia su misura a Casale',
    'article:modified_time': '2026-06-01T10:00:00+00:00',
  },
  changeTracking: { changeStatus: 'new', previousScrapeAt: null },
};

test('toSnapshot estrae i campi e normalizza il dominio (www-stripped)', () => {
  const r = toSnapshot(SCRAPE, 'servizio');
  assert.equal(r.domain, 'vetrariacasalese.it');
  assert.equal(r.url, 'https://www.vetrariacasalese.it/box-doccia');
  assert.equal(r.page_type, 'servizio');
  assert.equal(r.status_code, 200);
  assert.equal(r.language, 'it');
  assert.equal(r.change_status, 'new');
  assert.equal(r.page_modified_at, '2026-06-01T10:00:00+00:00');
});

test('toSnapshot calcola content_hash = sha256(content_md)', () => {
  const r = toSnapshot(SCRAPE, 'servizio');
  assert.equal(r.content_hash, sha256(SCRAPE.markdown));
  assert.match(r.content_hash, /^[0-9a-f]{64}$/);
});

test('toSnapshot usa metadata.url come fallback e gestisce campi opzionali assenti', () => {
  const r = toSnapshot({ markdown: 'x', metadata: { url: 'https://skyglass.it/' } }, 'home');
  assert.equal(r.domain, 'skyglass.it');
  assert.equal(r.title, null);
  assert.equal(r.change_status, null); // no changeTracking
});

// --- validateSnapshot: record valido di riferimento + fault injection ---

function validRecord(over = {}) {
  const content_md = '# Pagina\nContenuto reale.';
  return {
    domain: 'esempio.it',
    url: 'https://esempio.it/pagina',
    page_type: 'servizio',
    status_code: 200,
    language: 'it',
    title: 'T',
    description: 'D',
    page_modified_at: '2026-06-01T10:00:00+00:00',
    change_status: 'new',
    previous_scrape_at: null,
    content_md,
    content_hash: sha256(content_md),
    embedding: Array(EMBED_DIM).fill(0.01),
    ...over,
  };
}

test('record ben formato → nessun errore', () => {
  assert.deepEqual(validateSnapshot(validRecord()), []);
});

test('page_modified_at null è ammesso (campo opzionale)', () => {
  assert.deepEqual(validateSnapshot(validRecord({ page_modified_at: null })), []);
});

// fault injection: ogni mutazione DEVE essere catturata (un verde da solo non basta)
const FAULTS = [
  ['url malformato',            { url: 'non-un-url' },                          'url non valido'],
  ['status_code stringa',       { status_code: '200' },                        'status_code non intero 100–599'],
  ['status_code fuori range',   { status_code: 700 },                          'status_code non intero 100–599'],
  ['status_code null',          { status_code: null },                         'status_code non intero 100–599'],
  ['language vuoto',            { language: '' },                              'language vuoto'],
  ['content_md vuoto',          { content_md: '   ' },                         'content_md vuoto'],
  ['embedding dim sbagliata',   { embedding: Array(512).fill(0) },             `embedding.length != ${EMBED_DIM}`],
  ['embedding assente',         { embedding: undefined },                      `embedding.length != ${EMBED_DIM}`],
  ['embedding con NaN',         { embedding: Array(EMBED_DIM).fill(NaN) },     'embedding contiene valori non numerici'],
  ['page_modified_at invalido', { page_modified_at: 'non-una-data' },          'page_modified_at non parsabile'],
];

for (const [name, over, expected] of FAULTS) {
  test(`fault: ${name} → segnalato`, () => {
    const errs = validateSnapshot(validRecord(over));
    assert.ok(errs.includes(expected), `atteso "${expected}", ottenuto ${JSON.stringify(errs)}`);
  });
}

test('content_hash che non corrisponde al content_md → segnalato (integrità)', () => {
  const r = validRecord({ content_hash: sha256('altro contenuto') });
  assert.ok(validateSnapshot(r).includes('content_hash non corrisponde a content_md'));
});

test('content_hash non-sha256 → segnalato', () => {
  const r = validRecord({ content_hash: 'abc' });
  assert.ok(validateSnapshot(r).includes('content_hash non è uno sha256'));
});

test('record con più difetti → tutti gli errori raccolti', () => {
  const errs = validateSnapshot(validRecord({ url: 'x', status_code: 0, language: '' }));
  assert.ok(errs.length >= 3);
});
