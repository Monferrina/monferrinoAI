// Invio email via Resend, condiviso fra digest mensile e briefing settimanale.
// Il dominio vetreriamonferrina.com è già verificato su Resend (SPF/DKIM/DMARC).

// Escape per i valori che finiscono dentro l'HTML dell'email. Le keyword arrivano da un
// harvest esterno e gli URL dal DB: sono dati altrui anche quando sembrano innocui.
//
// Le virgolette sono nell'elenco perché questi valori finiscono anche DENTRO attributi
// (`href="..."`), non solo fra i tag: senza, un URL che contiene una virgoletta chiude
// l'attributo e apre la porta a un `onclick` iniettato. Trovato da CodeQL come
// js/incomplete-html-attribute-sanitization e corretto qui invece che sui singoli
// chiamanti, che sono dodici fra digest e briefing.
const ENTITA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITA[c]);

// fetchImpl iniettabile: i test verificano richiesta ed errori senza toccare la rete e
// senza mock globali (stessa scelta di send-quote sul sito).
export async function sendEmail({ from, to, subject, html }, apiKey, fetchImpl = fetch) {
  const r = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text().catch(() => '')).slice(0, 500)}`);
  return r.json();
}
