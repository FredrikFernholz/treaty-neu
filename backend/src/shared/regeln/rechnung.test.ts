import { describe, expect, test } from 'vitest';
import { zahlungsziel } from './rechnung.js';

// Jede Tabellenzeile ist ein eigener Testfall. Die erwarteten Werte wurden vorab
// unabhängig mit JavaScript-Date in UTC berechnet, nicht mit den Funktionen aus datum.ts.
// Im Kommentar stehen der 30. Tag und sein Wochentag.

describe('zahlungsziel (30 Kalendertage ab Rechnungsdatum, dann Donnerstag)', () => {
  // [Rechnungsdatum (Festschreibetag), erwartetes Zahlungsziel]
  test.each([
    ['2026-10-13', '2026-11-12'], // 12.11. ist Do, bleibt
    ['2028-02-01', '2028-03-02'], // 02.03. ist Do, bleibt, über den 29.02.
    ['2026-11-30', '2026-12-31'], // Mi 30.12. → Do, ein Tag
    ['2026-10-14', '2026-11-19'], // Fr 13.11. → Do, sechs Tage
    ['2026-10-15', '2026-11-19'], // Sa 14.11. → Do
    ['2026-10-16', '2026-11-19'], // So 15.11. → Do
    ['2026-10-17', '2026-11-19'], // Mo 16.11. → Do
    ['2026-12-03', '2027-01-07'], // Sa 02.01. → Do, über den Jahreswechsel
    ['2027-01-29', '2027-03-04'], // So 28.02. → Do, Februar mit 28 Tagen
    ['2028-01-30', '2028-03-02'], // Di 29.02. → Do, Schaltjahr
  ])('Rechnungsdatum %s → Zahlungsziel %s', (rechnungsdatum, erwartet) => {
    expect(zahlungsziel(rechnungsdatum)).toBe(erwartet);
  });

  test('ungültiges Rechnungsdatum wirft', () => {
    expect(() => zahlungsziel('2026-02-30')).toThrow();
  });
});
