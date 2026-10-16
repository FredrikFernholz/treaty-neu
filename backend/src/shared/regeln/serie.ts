import {
  datumImMonat,
  datumsteile,
  plusTage,
  tageImMonat,
  tageZwischen,
  wochentag,
  type Kalenderdatum,
  type Wochentag,
} from './datum.js';

// Serienaufgaben (Konzeption 7, Felddokumentation Blatt Aufgaben, Abschnitt Serie).
// Beim Abschließen einer Serienaufgabe wird der nächste Serientermin berechnet
// (naechsterSerientermin) und anhand der Seriendauer entschieden, ob die Serie
// weiterläuft (serieFortsetzen, Entscheidung 16.10.2026, Abgleich A-12).
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

/** Seriendauer: ohne Ende, bis zu einem Enddatum oder für eine feste Anzahl Termine. */
export type Seriendauer =
  | { dauer: 'ohne_ende' }
  | { dauer: 'bis_datum'; endDatum: Kalenderdatum }
  | { dauer: 'anzahl'; anzahlTermine: number };

/** Ergebnis beim Abschließen eines Serientermins. */
export type Serienfortsetzung =
  | { weiter: true; wvDatum: Kalenderdatum; anzahlBisher: number }
  | { weiter: false };

/**
 * Was beim Abschließen einer Serienaufgabe geschieht (Entscheidung 16.10.2026).
 *
 * Gerechnet wird vom bisherigen WV-Datum aus, nicht vom Tag des Abschließens, damit die
 * Serie nicht wandert. Liegt der nächste Termin vor heute, wird weitergerechnet, bis er
 * heute oder später liegt. Die übersprungenen Termine zählen bei "Endet nach n Terminen"
 * als verbraucht.
 *
 * anzahlBisher ist die Nummer des Termins, der gerade abgeschlossen wird. Die angelegte
 * Aufgabe ist Termin 1. Bei "Endet am" gilt ein Termin genau am Enddatum noch.
 *
 * Bei weiter: true wird die Aufgabe mit dem neuen WV-Datum auf NEU gesetzt und ihre
 * Unteraufgaben werden zurückgesetzt (das erledigt der Aufgaben-Dienst). Bei
 * weiter: false wird sie endgültig abgeschlossen.
 */
export function serieFortsetzen(
  serie: Serienmuster,
  dauer: Seriendauer,
  aktuell: { wvDatum: Kalenderdatum; anzahlBisher: number },
  heute: Kalenderdatum,
): Serienfortsetzung {
  if (!Number.isInteger(aktuell.anzahlBisher) || aktuell.anzahlBisher < 1) {
    throw new Error(`anzahlBisher muss eine ganze Zahl ab 1 sein, erhalten: ${aktuell.anzahlBisher}`);
  }
  if (dauer.dauer === 'anzahl' && (!Number.isInteger(dauer.anzahlTermine) || dauer.anzahlTermine < 1)) {
    throw new Error(`Anzahl Termine muss eine ganze Zahl ab 1 sein, erhalten: ${dauer.anzahlTermine}`);
  }

  let termin = aktuell.wvDatum;
  let anzahl = aktuell.anzahlBisher;
  do {
    termin = naechsterSerientermin(serie, termin);
    anzahl += 1;
  } while (tageZwischen(heute, termin) < 0); // Termin liegt noch vor heute

  if (dauer.dauer === 'anzahl' && anzahl > dauer.anzahlTermine) return { weiter: false };
  if (dauer.dauer === 'bis_datum' && tageZwischen(dauer.endDatum, termin) > 0) return { weiter: false };
  return { weiter: true, wvDatum: termin, anzahlBisher: anzahl };
}
