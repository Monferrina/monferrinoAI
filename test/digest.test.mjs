import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigestHtml } from '../scripts/digest.mjs';

const DATA = {
  rankings: [
    { keyword: 'box doccia casale', position: 3, prev_position: 7, search_volume: 200, url: '/servizi/box-doccia' },
    { keyword: 'parapetti vetro', position: 12, prev_position: 5, search_volume: 100, url: '/servizi/parapetti' },
    { keyword: 'vetreria <casale>', position: 1, prev_position: 1, search_volume: 500, url: '/' },
  ],
  competitors: [{ domain: 'skyglass.it', changed: 2, scanned: 5, last_scan: '2026-07-01' }],
  backlog: [{ status: 'todo', n: 110 }, { status: 'published', n: 30 }],
};

test('buildDigestHtml: sezioni, movers su/giù e HTML escaping', () => {
  const html = buildDigestHtml(DATA, 'luglio 2026');
  assert.match(html, /Digest luglio 2026/);
  assert.match(html, /Posizionamento sito/);
  assert.match(html, /Competitor/);
  assert.match(html, /Backlog keyword/);
  // mover in salita (7→3 = +4) e in discesa (5→12 = -7)
  assert.match(html, /\+4/);
  assert.match(html, /-7/);
  // escaping: la keyword con < > non deve iniettare tag
  assert.match(html, /vetreria &lt;casale&gt;/);
  assert.doesNotMatch(html, /vetreria <casale>/);
});

test('buildDigestHtml: sezioni vuote vengono omesse', () => {
  const html = buildDigestHtml({ rankings: [], competitors: [], backlog: [] }, 'luglio 2026');
  assert.doesNotMatch(html, /Posizionamento sito/);
  assert.doesNotMatch(html, /Competitor/);
  assert.doesNotMatch(html, /Backlog keyword/);
});
