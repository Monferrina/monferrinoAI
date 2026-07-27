import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail, esc } from '../src/mailer.mjs';

// L'invio è l'unico output osservabile di digest e briefing: se sbaglia header o non
// controlla lo stato della risposta, il run esce verde e la mail non arriva mai.
// fetch iniettato: nessuna rete, nessun mock globale.

const ok = (body = { id: 'abc-123' }) => {
  const chiamate = [];
  const f = async (url, opts) => {
    chiamate.push({ url, opts });
    return { ok: true, status: 200, json: async () => body };
  };
  return { f, chiamate };
};

const MSG = { from: 'A <a@x.it>', to: ['b@x.it'], subject: 'oggetto', html: '<p>ciao</p>' };

test('sendEmail: POST a Resend con bearer e JSON completo', async () => {
  const { f, chiamate } = ok();
  const res = await sendEmail(MSG, 'chiave-segreta', f);

  assert.equal(res.id, 'abc-123');
  assert.equal(chiamate.length, 1);
  const { url, opts } = chiamate[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers.Authorization, 'Bearer chiave-segreta');
  assert.equal(opts.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(opts.body), MSG);
});

test('sendEmail: destinatari multipli passano come array, non come stringa', async () => {
  const { f, chiamate } = ok();
  await sendEmail({ ...MSG, to: ['uno@x.it', 'due@x.it'] }, 'k', f);
  assert.deepEqual(JSON.parse(chiamate[0].opts.body).to, ['uno@x.it', 'due@x.it']);
});

test('sendEmail: risposta non-2xx lancia con stato e corpo', async () => {
  const f = async () => ({ ok: false, status: 422, text: async () => 'domain not verified' });
  await assert.rejects(() => sendEmail(MSG, 'k', f), /Resend 422: domain not verified/);
});

test('sendEmail: un 200 non basta, ma un 500 non deve passare in silenzio', async () => {
  // Il caso che rompe davvero: Resend accetta la richiesta e fallisce lato suo. Senza il
  // check su r.ok il job registrerebbe "inviato" con una mail mai partita.
  const f = async () => ({ ok: false, status: 500, text: async () => '' });
  await assert.rejects(() => sendEmail(MSG, 'k', f), /Resend 500/);
});

test('sendEmail: il corpo di errore viene troncato, non riversato nei log', async () => {
  const f = async () => ({ ok: false, status: 400, text: async () => 'x'.repeat(2000) });
  await assert.rejects(
    () => sendEmail(MSG, 'k', f),
    (e) => e.message.length < 600,
  );
});

test('sendEmail: se text() esplode resta l’errore di stato, non un crash', async () => {
  const f = async () => ({ ok: false, status: 503, text: async () => { throw new Error('socket'); } });
  await assert.rejects(() => sendEmail(MSG, 'k', f), /Resend 503/);
});

test('esc: neutralizza il markup nei valori che finiscono in HTML', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('vetro 6 & 8 mm'), 'vetro 6 &amp; 8 mm');
  assert.equal(esc(null), '');
  assert.equal(esc(0), '0'); // falsy ma valido: 0 recensioni non è "nessun dato"
});
