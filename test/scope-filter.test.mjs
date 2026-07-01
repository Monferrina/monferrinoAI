// Unit test del Layer 1 scope filter. Casi reali emersi dalla pulizia 1/7.
// Zero dipendenze/costo (node:test, funzione pura).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyScope } from '../src/scope-filter.mjs';

test('marca noise i brand competitor', () => {
  assert.equal(classifyScope('specchio leroy merlin').noise, true);
  assert.equal(classifyScope('pensiline faraone').noise, true);
  assert.equal(classifyScope('dove rivolgersi all ikea per vetri su misura').noise, true);
});

test('marca noise off-topic (auto/tech/cultura/traduzione)', () => {
  assert.equal(classifyScope('riparazione vetri auto').noise, true);
  assert.equal(classifyScope('come mettere pannelli di vetrocamera in revit').noise, true);
  assert.equal(classifyScope('cosa sono i neuroni specchio').noise, true);
  assert.equal(classifyScope('come si dice specchio in inglese').noise, true);
  assert.equal(classifyScope('quando alice ruppe lo specchio').noise, true);
  assert.equal(classifyScope('dove trovare vetro sintetico su misura').noise, true);
});

test('marca noise geo fuori zona', () => {
  assert.equal(classifyScope('a livorno porte scorrevoli in vetro').noise, true);
  assert.equal(classifyScope('chi vende porte scorrevoli in vetro ad andria').noise, true);
});

test('TIENE le keyword in scope (nessun falso positivo)', () => {
  for (const kw of [
    'ringhiera in vetro',
    'balaustra in vetro',
    'prezzo vetro antisfondamento',
    'come applicare il vetro temperato', // "app" non deve matchare
    'specchiere su misura',
    'box doccia walk-in',
    'vetrina espositiva',
    'vetro romano decorato', // "roma" dentro "romano" non deve matchare (confine di parola)
  ]) {
    assert.equal(classifyScope(kw).noise, false, `falso positivo su "${kw}"`);
  }
});
