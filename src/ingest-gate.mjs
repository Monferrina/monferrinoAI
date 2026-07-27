// Gate di validità di un run di ingest. Puro: nessun I/O, quindi testabile davvero.
//
// Condiviso da ingest-competitors e ingest-site, che avevano la stessa soglia duplicata.
// Con la cadenza settimanale (dal 27/7) questi controlli girano 4 volte più spesso: un run
// che esce verde senza aver fatto nulla si accumula in silenzio molto più in fretta.

export const MIN_OK_RATIO = 0.8;

/**
 * Decide se un run di ingest è valido.
 *
 * @param {number} urlCount  quante URL doveva processare
 * @param {number} okCount   quante sono sopravvissute a scrape + filtri
 * @param {number} [minRatio]
 * @returns {{ok: boolean, reason?: string}}
 */
export function checkIngestRun(urlCount, okCount, minRatio = MIN_OK_RATIO) {
  // Lista vuota: la vecchia soglia non lo intercettava, perché 0 < Math.ceil(0 * 0.8) è
  // falso. Un monitor cancellato, rinominato o che risponde vuoto produceva quindi un run
  // verde a mani vuote, ogni settimana, senza un solo segnale.
  if (urlCount === 0) {
    return { ok: false, reason: 'lista URL vuota: la sorgente non ha restituito nulla' };
  }
  const soglia = Math.ceil(urlCount * minRatio);
  if (okCount < soglia) {
    return {
      ok: false,
      reason: `scrape sotto soglia (${okCount}/${urlCount} < ${minRatio * 100}%)`,
    };
  }
  return { ok: true };
}
