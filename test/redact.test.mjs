// Self-check della redazione PII (GDPR/TDM): email + telefoni IT mascherati,
// misure e anni intatti. Zero dipendenze/costo (node:test, funzione pura regex).
// Deve fallire se la redazione si rompe → gate reale, non decorativo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../src/fetchers.mjs';

test('maschera le email', () => {
  assert.equal(redact('Scrivi a info@vetrariacasalese.it oggi'), 'Scrivi a [email] oggi');
  assert.equal(redact('mario.rossi+lavori@sub.dominio.co.uk'), '[email]');
});

test('maschera i telefoni IT (fisso e mobile, con/senza prefisso e separatori)', () => {
  for (const [raw, expected] of [
    ['tel 0142 563728',        'tel [tel]'],
    ['cell +39 333 1234567',   'cell [tel]'],
    ['whatsapp 333-123-4567',  'whatsapp [tel]'],
    ['fisso 0142563728',       'fisso [tel]'],
    ['mobile 3331234567',      'mobile [tel]'],
  ]) {
    assert.equal(redact(raw), expected, `atteso "${expected}" per "${raw}"`);
  }
});

test('NON tocca misure, anni e codici corti (conservativa)', () => {
  for (const s of [
    'vetro 6 mm temperato',
    'spessore 10 mm, luce 2400 mm',
    'catalogo 2024 aggiornato',
    'box doccia 90x120 cm',
  ]) {
    assert.equal(redact(s), s, `falso positivo su "${s}"`);
  }
});

test('gestisce input vuoto/nullo senza errori', () => {
  assert.equal(redact(''), '');
  assert.equal(redact(null), null);
});

// Runnable stand-alone: `node test/redact.test.mjs` esegue comunque i test via node:test.
