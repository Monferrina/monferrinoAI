import test from 'node:test';
import assert from 'node:assert/strict';
import { checkIngestRun, MIN_OK_RATIO } from '../src/ingest-gate.mjs';

// Il gate decide se un run di ingest e' credibile. Con la cadenza settimanale gira 4 volte
// piu' spesso: un run verde a mani vuote si accumulerebbe in silenzio molto in fretta.

test('lista URL vuota: abort — era il buco della vecchia soglia', () => {
  const r = checkIngestRun(0, 0);
  assert.equal(r.ok, false);
  assert.match(r.reason, /vuota/);
  // La vecchia condizione era `docs.length < Math.ceil(urls.length * 0.8)`:
  // con 0 URL diventa 0 < 0, cioe' falso, quindi NON abortiva.
  assert.equal(0 < Math.ceil(0 * MIN_OK_RATIO), false);
});

test('sotto la soglia dell 80%: abort', () => {
  const r = checkIngestRun(30, 23); // 23 < ceil(24)
  assert.equal(r.ok, false);
  assert.match(r.reason, /23\/30/);
});

test('esattamente alla soglia: passa', () => {
  assert.equal(checkIngestRun(30, 24).ok, true); // ceil(30 * 0.8) = 24
});

test('tutte riuscite: passa', () => {
  assert.equal(checkIngestRun(29, 29).ok, true);
});

test('una sola pagina riuscita su molte: abort (il caso che la soglia esiste per prendere)', () => {
  assert.equal(checkIngestRun(30, 1).ok, false);
});

test('una sola URL attesa e riuscita: passa (--limit 1 resta usabile)', () => {
  assert.equal(checkIngestRun(1, 1).ok, true);
});

test('soglia personalizzata rispettata', () => {
  assert.equal(checkIngestRun(10, 5, 0.5).ok, true);
  assert.equal(checkIngestRun(10, 4, 0.5).ok, false);
});
