import { describe, expect, test } from 'vitest';
import { naechsterSerientermin, type Serienmuster } from './serie.js';

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
