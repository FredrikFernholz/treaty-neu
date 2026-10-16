import { describe, expect, test } from 'vitest';
import {
  naechsterSerientermin,
  serieFortsetzen,
  type Seriendauer,
  type Serienmuster,
} from './serie.js';

// Jede Tabellenzeile ist ein eigener Testfall. Die erwarteten Termine wurden vorab
// unabhängig mit JavaScript-Date in UTC berechnet, nicht mit den Funktionen aus datum.ts.

describe('naechsterSerientermin', () => {
  // [Serie, letzter Termin, nächster Termin]
  test.each<[Serienmuster, string, string]>([
    // täglich: Folgetag
    [{ muster: 'taeglich' }, '2026-10-16', '2026-10-17'],
    [{ muster: 'taeglich' }, '2026-12-31', '2027-01-01'], // Jahreswechsel
    [{ muster: 'taeglich' }, '2028-02-28', '2028-02-29'], // Schaltjahr

    // wöchentlich: nächster gewählter Wochentag, letzter Termin Fr 16.10.2026
    [{ muster: 'woechentlich', wochentag: 5 }, '2026-10-16', '2026-10-23'], // Fr → Fr, eine Woche
    [{ muster: 'woechentlich', wochentag: 1 }, '2026-10-16', '2026-10-19'], // → Mo
    [{ muster: 'woechentlich', wochentag: 4 }, '2026-10-16', '2026-10-22'], // → Do
    [{ muster: 'woechentlich', wochentag: 6 }, '2026-10-16', '2026-10-17'], // → Sa, Folgetag
    [{ muster: 'woechentlich', wochentag: 1 }, '2026-12-30', '2027-01-04'], // Mi → Mo, Jahreswechsel

    // monatlich: gewählter Tag im Folgemonat, begrenzt auf die Monatslänge
    [{ muster: 'monatlich', tagImMonat: 15 }, '2026-10-15', '2026-11-15'],
    [{ muster: 'monatlich', tagImMonat: 15 }, '2026-12-15', '2027-01-15'], // Jahreswechsel
    [{ muster: 'monatlich', tagImMonat: 31 }, '2027-01-31', '2027-02-28'], // Februar
    [{ muster: 'monatlich', tagImMonat: 31 }, '2027-02-28', '2027-03-31'], // zurück zum 31.
    [{ muster: 'monatlich', tagImMonat: 31 }, '2027-03-31', '2027-04-30'], // April
    [{ muster: 'monatlich', tagImMonat: 30 }, '2028-01-30', '2028-02-29'], // Februar im Schaltjahr

    // jährlich: gleicher Tag im Folgejahr, 29.02. → 28.02. ohne Schaltjahr
    [{ muster: 'jaehrlich', monat: 10, tag: 15 }, '2026-10-15', '2027-10-15'],
    [{ muster: 'jaehrlich', monat: 12, tag: 31 }, '2026-12-31', '2027-12-31'],
    [{ muster: 'jaehrlich', monat: 2, tag: 29 }, '2028-02-29', '2029-02-28'],
    [{ muster: 'jaehrlich', monat: 2, tag: 29 }, '2029-02-28', '2030-02-28'],
    [{ muster: 'jaehrlich', monat: 2, tag: 29 }, '2030-02-28', '2031-02-28'],
    [{ muster: 'jaehrlich', monat: 2, tag: 29 }, '2031-02-28', '2032-02-29'], // zurück zum 29.02.
  ])('%j nach %s → %s', (serie, letzterTermin, erwartet) => {
    expect(naechsterSerientermin(serie, letzterTermin)).toBe(erwartet);
  });

  test.each<[Serienmuster]>([
    [{ muster: 'woechentlich', wochentag: 0 as never }],
    [{ muster: 'woechentlich', wochentag: 8 as never }],
    [{ muster: 'monatlich', tagImMonat: 0 }],
    [{ muster: 'monatlich', tagImMonat: 32 }],
    [{ muster: 'monatlich', tagImMonat: 1.5 }],
    [{ muster: 'jaehrlich', monat: 2, tag: 30 }],
    [{ muster: 'jaehrlich', monat: 4, tag: 31 }],
    [{ muster: 'jaehrlich', monat: 13, tag: 1 }],
  ])('ungültige Serie %j wirft', (serie) => {
    expect(() => naechsterSerientermin(serie, '2026-10-16')).toThrow();
  });

  test('ungültiger letzter Termin wirft', () => {
    expect(() => naechsterSerientermin({ muster: 'taeglich' }, '2027-02-29')).toThrow();
  });
});

describe('serieFortsetzen', () => {
  // "heute" ist Freitag, 16.10.2026. anzahlBisher zählt ab der angelegten Aufgabe als
  // Termin 1. Die Erwartungswerte sind von Hand abgezählt, die Monatsfolge zum 31.
  // wurde zusätzlich mit JavaScript-Date geprüft.
  const heute = '2026-10-16';
  const taeglich: Serienmuster = { muster: 'taeglich' };
  const freitags: Serienmuster = { muster: 'woechentlich', wochentag: 5 };
  const ohneEnde: Seriendauer = { dauer: 'ohne_ende' };

  // [Serie, Dauer, bisheriges WV-Datum, abgeschlossener Termin, erwartetes Ergebnis]
  test.each<[string, Serienmuster, Seriendauer, string, number, ReturnType<typeof serieFortsetzen>]>([
    // ohne Ende
    ['pünktlich abgeschlossen', taeglich, ohneEnde, '2026-10-16', 1,
      { weiter: true, wvDatum: '2026-10-17', anzahlBisher: 2 }],
    ['eine Woche zu spät, Termine bis heute übersprungen', taeglich, ohneEnde, '2026-10-09', 1,
      { weiter: true, wvDatum: '2026-10-16', anzahlBisher: 8 }], // 10.–15.10. verbraucht, heute zählt
    ['wöchentlich, ein Termin übersprungen, nächster ist heute', freitags, ohneEnde, '2026-10-02', 1,
      { weiter: true, wvDatum: '2026-10-16', anzahlBisher: 3 }],
    ['monatlich zum 31., neun Monate zu spät', { muster: 'monatlich', tagImMonat: 31 }, ohneEnde,
      '2026-01-31', 1, { weiter: true, wvDatum: '2026-10-31', anzahlBisher: 10 }],
    ['WV-Datum liegt in der Zukunft, es wird von dort aus gerechnet', taeglich, ohneEnde, '2026-10-20', 4,
      { weiter: true, wvDatum: '2026-10-21', anzahlBisher: 5 }],

    // Endet nach n Terminen
    ['Termin 2 von 3 abgeschlossen', taeglich, { dauer: 'anzahl', anzahlTermine: 3 }, '2026-10-16', 2,
      { weiter: true, wvDatum: '2026-10-17', anzahlBisher: 3 }],
    ['Termin 3 von 3 abgeschlossen, Serie endet', taeglich, { dauer: 'anzahl', anzahlTermine: 3 }, '2026-10-16', 3,
      { weiter: false }],
    ['Serie mit 1 Termin endet sofort', taeglich, { dauer: 'anzahl', anzahlTermine: 1 }, '2026-10-16', 1,
      { weiter: false }],
    ['übersprungene Termine verbrauchen die Anzahl', taeglich, { dauer: 'anzahl', anzahlTermine: 5 }, '2026-10-09', 1,
      { weiter: false }], // wäre Termin 8
    ['übersprungen, aber Anzahl reicht genau', taeglich, { dauer: 'anzahl', anzahlTermine: 8 }, '2026-10-09', 1,
      { weiter: true, wvDatum: '2026-10-16', anzahlBisher: 8 }],

    // Endet am
    ['nächster Termin genau am Enddatum gilt noch', freitags, { dauer: 'bis_datum', endDatum: '2026-10-23' },
      '2026-10-16', 1, { weiter: true, wvDatum: '2026-10-23', anzahlBisher: 2 }],
    ['nächster Termin einen Tag nach dem Enddatum, Serie endet', freitags,
      { dauer: 'bis_datum', endDatum: '2026-10-22' }, '2026-10-16', 1, { weiter: false }],
    ['übersprungen, Termin heute liegt vor dem Enddatum', taeglich, { dauer: 'bis_datum', endDatum: '2026-10-20' },
      '2026-10-09', 1, { weiter: true, wvDatum: '2026-10-16', anzahlBisher: 8 }],
    ['Enddatum ist schon vorbei', taeglich, { dauer: 'bis_datum', endDatum: '2026-10-12' },
      '2026-10-09', 1, { weiter: false }],
  ])('%s', (_name, serie, dauer, wvDatum, anzahlBisher, erwartet) => {
    expect(serieFortsetzen(serie, dauer, { wvDatum, anzahlBisher }, heute)).toEqual(erwartet);
  });

  test.each<[string, Seriendauer, number]>([
    ['Anzahl Termine 0', { dauer: 'anzahl', anzahlTermine: 0 }, 1],
    ['Anzahl Termine 2,5', { dauer: 'anzahl', anzahlTermine: 2.5 }, 1],
    ['anzahlBisher 0', ohneEnde, 0],
    ['ungültiges Enddatum', { dauer: 'bis_datum', endDatum: '2026-02-30' }, 1],
  ])('wirft bei %s', (_name, dauer, anzahlBisher) => {
    expect(() => serieFortsetzen(taeglich, dauer, { wvDatum: '2026-10-16', anzahlBisher }, heute)).toThrow();
  });
});
