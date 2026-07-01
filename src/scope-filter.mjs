// Layer 1 scope filter per il backlog keyword (seo_keywords).
// Regole deterministiche che marcano fuori-scope l'OVVIO: brand competitor,
// domini off-topic (auto/tech/cultura), città fuori dalla zona servita.
// NON capisce il significato — è una blocklist, non un giudice AI. Il residuo
// ambiguo resta `todo` per la revisione umana. È una vetreria: Layer 1 basta.
// ponytail: blocklist manutenibile, niente ML. Aggiungere un Layer 2 LLM solo
// se un giorno il residuo ambiguo diventasse ingestibile (oggi non lo è).

// Brand di competitor/retailer: non ha senso posizionarsi sul loro nome.
const BRANDS = [
  'leroy merlin', 'faraone', 'ikea', 'doctor glass', 'unipol', 'glass drive',
  'carblas', 'mondo convenienza', 'bricoman', 'castorama', 'maison du monde',
  'bricocenter', 'amazon',
];

// Domini fuori scope: la vetreria fa vetro per EDILIZIA, non auto/tech/cultura.
// Termini scelti distintivi (nessuna parola-vetro comune li contiene) → match
// per sottostringa sicuro. I multiword sono frasi intere.
const OFF_TOPIC = [
  // automotive
  'parabrezza', 'vetri auto', 'vetro auto', 'automobil', 'automotive', 'carrozzeria',
  // tech / software / dispositivi
  'iphone', 'android', 'photoshop', 'archicad', 'autocad', 'revit', 'youtube',
  // vetro sintetico = acrilico/plexiglass, non vetro
  'vetro sintetico',
  // accademia / traduzione / cultura / misc off-topic
  'neuron', 'in inglese', 'in english', 'significato', 'canzone', 'alice ruppe',
  'chi ha inventato', 'chi ha scoperto', 'cosa vedere a', 'porta sfortuna',
  'specchiare una foto',
];

// Città lontane dalla zona servita (Casale Monferrato e dintorni): intento
// locale altrove = non nostro. Match a confine di parola (roma/bari sono corte).
const CITIES_OUT = [
  'roma', 'milano', 'napoli', 'torino', 'firenze', 'bologna', 'bari', 'palermo',
  'genova', 'venezia', 'verona', 'padova', 'livorno', 'andria', 'maser', 'catania',
];

/**
 * Classifica una keyword come in-scope o fuori-scope (Layer 1).
 * @param {string} keyword
 * @returns {{ noise: boolean, reason: string|null }}
 */
export function classifyScope(keyword) {
  const t = ` ${String(keyword).toLowerCase().trim()} `;
  for (const b of BRANDS) if (t.includes(b)) return { noise: true, reason: `brand:${b}` };
  for (const o of OFF_TOPIC) if (t.includes(o)) return { noise: true, reason: `off-topic:${o}` };
  for (const c of CITIES_OUT) {
    if (new RegExp(`\\b${c}\\b`).test(t)) return { noise: true, reason: `geo:${c}` };
  }
  return { noise: false, reason: null };
}
