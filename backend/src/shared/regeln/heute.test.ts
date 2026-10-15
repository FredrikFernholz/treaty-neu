import { afterEach, describe, expect, test } from 'vitest';
import { heuteInBerlin } from './heute.js';

// Jede Zeile: ein Zeitpunkt in UTC und der Kalendertag, der in Berlin gilt.
// Die Berliner Uhrzeit steht als Kommentar dahinter (MEZ = UTC+1, MESZ = UTC+2).

describe('heuteInBerlin', () => {
  // Ein Test stellt die Zeitzone des Node-Prozesses um. Nach jedem Test wird sie auf
  // den Ausgangswert zurückgesetzt, auch wenn der Test fehlschlägt.
  const tzAmAnfang = process.env.TZ;
  afterEach(() => {
    if (tzAmAnfang === undefined) delete process.env.TZ;
    else process.env.TZ = tzAmAnfang;
  });

  test.each([
    // Zeit zwischen 0 und 2 Uhr Berliner Zeit: in UTC ist noch der Vortag
    ['2026-01-14T22:59:59Z', '2026-01-14'], // 23:59:59 MEZ
    ['2026-01-14T23:00:00Z', '2026-01-15'], // 00:00:00 MEZ
    ['2026-01-14T23:59:59Z', '2026-01-15'], // 00:59:59 MEZ
    ['2026-07-14T21:59:59Z', '2026-07-14'], // 23:59:59 MESZ
    ['2026-07-14T22:00:00Z', '2026-07-15'], // 00:00:00 MESZ
    ['2026-07-14T23:59:59Z', '2026-07-15'], // 01:59:59 MESZ
    ['2026-07-15T00:00:00Z', '2026-07-15'], // 02:00:00 MESZ

    // Beginn Sommerzeit am 29.03.2026 (02:00 MEZ → 03:00 MESZ)
    ['2026-03-28T22:59:59Z', '2026-03-28'], // 23:59:59 MEZ
    ['2026-03-28T23:30:00Z', '2026-03-29'], // 00:30:00 MEZ
    ['2026-03-29T00:59:59Z', '2026-03-29'], // 01:59:59 MEZ
    ['2026-03-29T01:00:00Z', '2026-03-29'], // 03:00:00 MESZ
    ['2026-03-29T21:59:59Z', '2026-03-29'], // 23:59:59 MESZ
    ['2026-03-29T22:00:00Z', '2026-03-30'], // 00:00:00 MESZ, erster Tageswechsel mit +2

    // Ende Sommerzeit am 25.10.2026 (03:00 MESZ → 02:00 MEZ)
    ['2026-10-24T21:59:59Z', '2026-10-24'], // 23:59:59 MESZ
    ['2026-10-24T22:30:00Z', '2026-10-25'], // 00:30:00 MESZ
    ['2026-10-25T00:59:59Z', '2026-10-25'], // 02:59:59 MESZ
    ['2026-10-25T01:00:00Z', '2026-10-25'], // 02:00:00 MEZ (Stunde doppelt)
    ['2026-10-25T22:59:59Z', '2026-10-25'], // 23:59:59 MEZ
    ['2026-10-25T23:00:00Z', '2026-10-26'], // 00:00:00 MEZ, erster Tageswechsel mit +1

    // Monats- und Jahreswechsel
    ['2026-01-31T23:00:00Z', '2026-02-01'], // 00:00:00 MEZ
    ['2026-12-31T22:59:59Z', '2026-12-31'], // 23:59:59 MEZ
    ['2026-12-31T23:00:00Z', '2027-01-01'], // 00:00:00 MEZ, in UTC noch 2026

    // 29. Februar
    ['2028-02-28T23:00:00Z', '2028-02-29'], // 00:00:00 MEZ
    ['2028-02-29T23:00:00Z', '2028-03-01'], // 00:00:00 MEZ
    ['2027-02-28T23:00:00Z', '2027-03-01'], // 00:00:00 MEZ, kein Schaltjahr
  ])('%s → %s', (zeitpunkt, erwartet) => {
    expect(heuteInBerlin(new Date(zeitpunkt))).toBe(erwartet);
  });

  test('hängt nicht von der Zeitzone des Node-Prozesses ab', () => {
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Berlin']) {
      process.env.TZ = tz;
      expect(heuteInBerlin(new Date('2026-07-14T23:30:00Z')), tz).toBe('2026-07-15');
    }
  });

  test('ohne Parameter liefert es ein gültiges Datum', () => {
    expect(heuteInBerlin()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
