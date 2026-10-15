import type { Kalenderdatum } from './datum.js';

// Die einzige Stelle in Treaty, die das aktuelle Datum bestimmt.
//
// "Heute" ist immer der Kalendertag in Berlin (Konzeption 6.1). Der Server läuft in UTC.
// Zwischen 0 und 1 Uhr (Winterzeit) bzw. 0 und 2 Uhr (Sommerzeit) Berliner Zeit ist es
// in UTC noch der Vortag. Würde man das Datum in UTC bestimmen, wechselte das WV-Datum
// in diesem Zeitfenster auf den falschen Tag.
//
// Alle Regelfunktionen bekommen "heute" als Parameter und rufen diese Funktion nie
// selbst auf. Dadurch bleiben sie reine Funktionen und lassen sich mit festen Daten testen.

const BERLIN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Kalendertag in Berlin als "YYYY-MM-DD".
 * @param jetzt Zeitpunkt, für den das Datum bestimmt wird. Standard ist die aktuelle
 *              Uhrzeit, ein anderer Wert ist nur für Tests gedacht.
 */
export function heuteInBerlin(jetzt: Date = new Date()): Kalenderdatum {
  const teile = BERLIN.formatToParts(jetzt);
  const wert = (typ: 'year' | 'month' | 'day'): string => {
    const teil = teile.find((t) => t.type === typ);
    if (!teil) throw new Error(`Datumsteil ${typ} fehlt`);
    return teil.value;
  };
  return `${wert('year')}-${wert('month')}-${wert('day')}`;
}
