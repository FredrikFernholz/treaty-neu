import {
  datumImMonat,
  datumsteile,
  plusTage,
  tageImMonat,
  wochentag,
  type Kalenderdatum,
  type Wochentag,
} from './datum.js';

// Serienaufgaben (Konzeption 7, Felddokumentation Blatt Aufgaben, Abschnitt Serie).
// Beim Abschließen einer Serienaufgabe wird der nächste Serientermin berechnet.
// Hier steht nur diese Datumsberechnung. Ob die Serie danach weiterläuft (Seriendauer)
// und von welchem Tag aus gerechnet wird, regelt der Aufrufer.
//
// Der Wiederholungstag ist Teil der Serie und wird nicht aus dem letzten Termin
// abgelesen. Eine monatliche Serie zum 31. bleibt deshalb beim 31., auch wenn ein
// kürzerer Monat dazwischen liegt (31.01. → 28.02. → 31.03.). Ebenso kehrt eine
// jährliche Serie zum 29.02. im nächsten Schaltjahr auf den 29.02. zurück.

/** Serienmuster mit dem jeweils zugehörigen Wiederholungstag. */
export type Serienmuster =
  | { muster: 'taeglich' }
  | { muster: 'woechentlich'; wochentag: Wochentag }
  | { muster: 'monatlich'; tagImMonat: number }
  | { muster: 'jaehrlich'; monat: number; tag: number };

/** Prüft den Wiederholungstag und wirft bei ungültigen Angaben. */
function pruefeSerie(serie: Serienmuster): void {
  if (serie.muster === 'woechentlich') {
    if (!Number.isInteger(serie.wochentag) || serie.wochentag < 1 || serie.wochentag > 7) {
      throw new Error(`Wochentag muss 1 (Montag) bis 7 (Sonntag) sein, erhalten: ${serie.wochentag}`);
    }
  }
  if (serie.muster === 'monatlich') {
    if (!Number.isInteger(serie.tagImMonat) || serie.tagImMonat < 1 || serie.tagImMonat > 31) {
      throw new Error(`Tag im Monat muss 1 bis 31 sein, erhalten: ${serie.tagImMonat}`);
    }
  }
  if (serie.muster === 'jaehrlich') {
    // Der Jahrestag muss in irgendeinem Jahr existieren, der 29.02. ist also erlaubt.
    // Deshalb wird gegen ein Schaltjahr (2000) geprüft.
    const { monat, tag } = serie;
    const gueltig =
      Number.isInteger(monat) && monat >= 1 && monat <= 12 &&
      Number.isInteger(tag) && tag >= 1 && tag <= tageImMonat(2000, monat);
    if (!gueltig) {
      throw new Error(`Ungültiger Jahrestag ${serie.tag}.${serie.monat}.`);
    }
  }
}

/**
 * Nächster Serientermin nach dem übergebenen letzten Termin.
 *
 * - täglich: der Folgetag
 * - wöchentlich: der nächste Tag mit dem gewählten Wochentag, immer nach dem letzten
 *   Termin. Fällt der letzte Termin selbst auf diesen Wochentag, ist es eine Woche später.
 * - monatlich: der gewählte Tag im Folgemonat, begrenzt auf die Länge dieses Monats
 * - jährlich: der gewählte Tag im Folgejahr. Den 29.02. gibt es nur in Schaltjahren,
 *   sonst wird er zum 28.02. (Konzeption 7, der Prototyp nimmt hier den 01.03.).
 */
export function naechsterSerientermin(serie: Serienmuster, letzterTermin: Kalenderdatum): Kalenderdatum {
  pruefeSerie(serie);
  const { jahr, monat } = datumsteile(letzterTermin);
  switch (serie.muster) {
    case 'taeglich':
      return plusTage(letzterTermin, 1);
    case 'woechentlich': {
      // Abstand 1 bis 7 Tage. Bei gleichem Wochentag ergibt die Rechnung 0, dann 7.
      const abstand = (serie.wochentag - wochentag(letzterTermin) + 7) % 7 || 7;
      return plusTage(letzterTermin, abstand);
    }
    case 'monatlich':
      return monat === 12
        ? datumImMonat(jahr + 1, 1, serie.tagImMonat)
        : datumImMonat(jahr, monat + 1, serie.tagImMonat);
    case 'jaehrlich':
      return datumImMonat(jahr + 1, serie.monat, serie.tag);
  }
}
