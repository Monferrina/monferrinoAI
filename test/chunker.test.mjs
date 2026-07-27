import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkPage, splitSections, pageTitle } from '../src/chunker.mjs';

// Il chunker decide cosa il RAG potrà mai recuperare: quello che finisce nel chunk sbagliato,
// o in un chunk senza contesto, è perso per sempre. Tagliare male non dà errore, dà solo
// risposte peggiori, quindi i confini vanno verificati qui.

const PAGINA = `# Box doccia su misura

Realizziamo box doccia su misura in vetro temperato.

## Caratteristiche

Vetro da 6 o 8 mm, temperato secondo norma.

## Materiali

Profili in alluminio anodizzato o acciaio inox.

## Quando scegliere

Quando il vano non è regolare e i modelli standard non chiudono bene.`;

test('pageTitle: prende l’h1 e non un h2 qualsiasi', () => {
  assert.equal(pageTitle(PAGINA), 'Box doccia su misura');
  assert.equal(pageTitle('## Solo un h2\n\ntesto'), null);
});

test('splitSections: l’intro prima del primo h2 resta un blocco, non si perde', () => {
  const s = splitSections(PAGINA);
  assert.equal(s.length, 4); // intro + 3 sezioni
  assert.match(s[0], /^# Box doccia su misura/);
  assert.match(s[1], /^## Caratteristiche/);
});

test('chunkPage: ogni chunk porta in testa titolo pagina e heading', () => {
  // Senza il prefisso, "vetro da 6 o 8 mm" è un frammento che potrebbe stare su cinque
  // pagine diverse: l'embedding non saprebbe di quale prodotto parla.
  const c = chunkPage(PAGINA, { min: 10 });
  const caratteristiche = c.find((x) => x.heading === 'Caratteristiche');
  assert.match(caratteristiche.embed_text, /^Box doccia su misura > Caratteristiche/);
  assert.match(caratteristiche.text, /^## Caratteristiche/); // il testo salvato resta pulito
});

test('chunkPage: i frammenti troppo corti si fondono col precedente', () => {
  const md = `# Titolo\n\n## Lunga\n\n${'x '.repeat(150)}\n\n## Corta\n\nnota.`;
  const c = chunkPage(md, { min: 200, max: 5000 });
  assert.equal(c.length, 2); // intro-con-h1 fusa o meno, ma "Corta" non resta sola
  assert.match(c.at(-1).text, /## Corta/);
  assert.match(c.at(-1).text, /## Lunga/); // è finita dentro il chunk precedente
});

test('chunkPage: una sezione troppo lunga si spezza sugli h3', () => {
  const grosso = 'parola '.repeat(300); // ~2100 caratteri
  const md = `# Titolo\n\n## FAQ\n\n### Prima domanda\n\n${grosso}\n\n### Seconda domanda\n\n${grosso}`;
  const c = chunkPage(md, { min: 10, max: 1500 });
  const heading = c.map((x) => x.heading);
  assert.ok(heading.includes('Prima domanda'), 'la FAQ non è stata spezzata sugli h3');
  assert.ok(heading.includes('Seconda domanda'));
});

test('chunkPage: una sezione lunga SENZA h3 resta intera invece di essere mutilata', () => {
  // Meglio un chunk sopra soglia che uno tagliato a metà frase: il taglio a caso produce
  // due vettori entrambi sbagliati, mentre un chunk lungo è solo meno preciso.
  const md = `# Titolo\n\n## Muro di testo\n\n${'parola '.repeat(400)}`;
  const c = chunkPage(md, { min: 10, max: 1000 });
  assert.equal(c.length, 2); // intro + la sezione, non spezzata
  assert.ok(c[1].text.length > 1000);
});

test('chunkPage: input vuoto o solo spazi non produce chunk fantasma', () => {
  assert.deepEqual(chunkPage(''), []);
  assert.deepEqual(chunkPage('   \n\n  '), []);
  assert.deepEqual(chunkPage(null), []);
});

test('chunkPage: gli index sono progressivi e senza buchi', () => {
  const c = chunkPage(PAGINA, { min: 10 });
  assert.deepEqual(c.map((x) => x.index), [...c.keys()]);
});

test('chunkPage: nessun contenuto si perde per strada', () => {
  // La proprietà che conta davvero: la somma dei chunk deve contenere tutto il markdown.
  // Un bug nello split che mangia una sezione non darebbe errore, solo un buco nel RAG.
  const c = chunkPage(PAGINA, { min: 10 });
  const ricomposto = c.map((x) => x.text).join('\n\n');
  for (const riga of PAGINA.split('\n').map((r) => r.trim()).filter(Boolean)) {
    assert.ok(ricomposto.includes(riga), `riga persa dal chunking: ${riga}`);
  }
});
