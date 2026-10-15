import { Decimal } from 'decimal.js';

// Geldbeträge in Treaty (Entscheidung vom 15.10.2026, docs/entscheidungen.md).
//
// Geld wird nie mit einer normalen JavaScript-Zahl (number) gerechnet, weil diese binär
// gespeichert wird und Dezimalwerte wie 1,005 nicht exakt darstellen kann. Stattdessen
// rechnet Treaty mit decimal.js. Dieses Modul ist der einzige Ort, der decimal.js direkt
// verwendet. Aller übrige Code arbeitet mit den Funktionen und dem Typ Betrag von hier.
//
// Regeln:
//  - Beträge kommen als Text herein ("1234.56"), so wie mysql2 DECIMAL-Spalten liefert.
//  - Zwischenergebnisse (z. B. Minuten / 60 * Stundensatz) werden nicht gerundet.
//  - Gerundet wird kaufmännisch auf 2 Nachkommastellen, und zwar je Teilsumme an der
//    Stelle, an der die Geschäftsregel es verlangt (Konzeption 7).
//  - In die Datenbank geht nur ein gerundeter Betrag, als Text für DECIMAL(12,2).

// Eigene Decimal-Variante, damit die Einstellungen nicht von anderem Code verändert
// werden können, der decimal.js ebenfalls benutzt.
//  - precision 40: Stellen für Zwischenergebnisse, weit mehr als DECIMAL(12,2) braucht
//  - ROUND_HALF_UP: kaufmännische Rundung, ab ...5 wird vom Nullpunkt weg gerundet,
//    also 1,005 → 1,01 und -1,005 → -1,01
const Geld = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Ein Geldbetrag oder ein Zwischenergebnis einer Geldberechnung. */
export type Betrag = Decimal;

// Erlaubt sind nur Ziffern mit optionalem Minus und optionalem Dezimalpunkt, z. B.
// "12", "-3.5", "1234.56". Kein Komma, keine Tausenderpunkte, keine Leerzeichen.
// Deutsche Eingaben wie "1.234,56" wandelt später die Oberfläche vorher um.
const BETRAG_TEXT = /^-?\d+(\.\d+)?$/;

// Größter Wert einer Spalte DECIMAL(12,2): 10 Stellen vor und 2 nach dem Komma.
const DB_HOECHSTWERT = new Geld('9999999999.99');

/**
 * Liest einen Betrag aus Text ein, etwa aus der Datenbank oder einem Formular.
 * Bewusst kein number als Eingabe, damit kein ungenauer Gleitkommawert hereinkommt.
 */
export function betrag(text: string): Betrag {
  if (!BETRAG_TEXT.test(text)) {
    throw new Error(`Ungültiger Betrag "${text}", erwartet z. B. "1234.56"`);
  }
  return new Geld(text);
}

/** Rundet kaufmännisch auf 2 Nachkommastellen (1,005 → 1,01; -1,005 → -1,01). */
export function rundeKaufmaennisch(wert: Betrag): Betrag {
  return new Geld(wert).toDecimalPlaces(2, Geld.ROUND_HALF_UP);
}

/** Addiert beliebig viele Beträge, ohne zu runden. Ohne Beträge ergibt sich 0. */
export function summe(...werte: Betrag[]): Betrag {
  return werte.reduce<Betrag>((bisher, wert) => bisher.plus(wert), new Geld(0));
}

/**
 * Gibt einen Betrag als Text für eine DECIMAL(12,2)-Spalte zurück, z. B. "1234.50".
 * Der Betrag muss bereits gerundet sein. So fällt eine vergessene Rundung sofort auf,
 * statt dass hier stillschweigend gerundet wird.
 */
export function alsDbWert(wert: Betrag): string {
  if (wert.decimalPlaces() > 2) {
    throw new Error(`Betrag ${wert.toString()} ist nicht auf 2 Nachkommastellen gerundet`);
  }
  if (wert.abs().greaterThan(DB_HOECHSTWERT)) {
    throw new Error(`Betrag ${wert.toString()} ist zu groß für DECIMAL(12,2)`);
  }
  // -0 (etwa aus -0,004 gerundet) als "0.00" ausgeben, nicht als "-0.00".
  return wert.isZero() ? '0.00' : wert.toFixed(2);
}
