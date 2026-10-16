import { describe, expect, test } from 'vitest';
import { ampelAufgabe, fristAnzeige } from './aufgabe.js';

// Jede Tabellenzeile ist ein eigener Testfall. Die Daten wurden vorab unabhängig mit
// JavaScript-Date in UTC berechnet, nicht mit den Funktionen aus datum.ts.
// "heute" ist meist Freitag, 16.10.2026. Die Zahl im Kommentar sind die Kalendertage
// bis zum Termin.

describe('ampelAufgabe', () => {
  // [heute, WV-Datum, erwartete Farbe]
  test.each([
    ['2026-10-16', '2026-11-15', 'gruen'], // 30
    ['2026-10-16', '2026-10-22', 'gruen'], // 6, erste grüne Stelle
    ['2026-10-16', '2026-10-21', 'gelb'], // 5, letzte gelbe Stelle von oben
    ['2026-10-16', '2026-10-17', 'gelb'], // 1, Samstag zählt als Kalendertag mit
    ['2026-10-16', '2026-10-16', 'gelb'], // 0, WV-Datum ist heute
    ['2026-10-16', '2026-10-15', 'rot'], // -1, verstrichen
    ['2026-10-16', '2026-09-16', 'rot'], // -30
    ['2026-10-28', '2026-11-03', 'gruen'], // 6 über das Monatsende
  ])('heute %s, WV-Datum %s → %s', (heute, wvDatum, erwartet) => {
    expect(ampelAufgabe({ wvDatum, abgeschlossen: false }, heute)).toBe(erwartet);
  });

  test.each([
    ['2026-10-16', '2026-10-16'], // wäre gelb
    ['2026-10-16', '2026-09-16'], // wäre rot
  ])('abgeschlossen ist immer grün (heute %s, WV-Datum %s)', (heute, wvDatum) => {
    expect(ampelAufgabe({ wvDatum, abgeschlossen: true }, heute)).toBe('gruen');
  });
});

describe('fristAnzeige', () => {
  // [heute, Frist-Datum, erwartete Darstellung]
  test.each([
    ['2026-10-16', '2026-11-15', 'neutral'], // 30
    ['2026-10-16', '2026-10-24', 'neutral'], // 8, letzte neutrale Stelle
    ['2026-10-16', '2026-10-23', 'blinkend'], // 7, erste blinkende Stelle
    ['2026-10-16', '2026-10-17', 'blinkend'], // 1
    ['2026-10-16', '2026-10-16', 'blinkend'], // 0, Fälligkeitstag
    ['2026-10-16', '2026-10-15', 'rot'], // -1, abgelaufen
    ['2026-10-16', '2026-09-16', 'rot'], // -30
    ['2026-12-31', '2027-01-08', 'neutral'], // 8 über den Jahreswechsel
    ['2026-12-31', '2027-01-07', 'blinkend'], // 7 über den Jahreswechsel
  ])('heute %s, Frist-Datum %s → %s', (heute, fristDatum, erwartet) => {
    expect(fristAnzeige({ fristDatum, abgeschlossen: false }, heute)).toBe(erwartet);
  });

  test('ohne Frist-Datum gibt es keine Anzeige', () => {
    expect(fristAnzeige({ fristDatum: null, abgeschlossen: false }, '2026-10-16')).toBeNull();
  });

  test.each([
    ['2026-10-16', '2026-10-23'], // wäre blinkend
    ['2026-10-16', '2026-09-16'], // wäre rot
  ])('abgeschlossen zeigt keine Frist (heute %s, Frist-Datum %s)', (heute, fristDatum) => {
    expect(fristAnzeige({ fristDatum, abgeschlossen: true }, heute)).toBeNull();
  });
});
