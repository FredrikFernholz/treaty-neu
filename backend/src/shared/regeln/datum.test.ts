import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  arbeitstageZwischen,
  datumImMonat,
  datumsteile,
  istArbeitstag,
  istKalenderdatum,
  naechsterArbeitstag,
  naechsterDonnerstag,
  plusArbeitstage,
  plusTage,
  tageZwischen,
  wochentag,
} from './datum.js';

// Jede Tabellenzeile ist ein eigener Testfall. Die erwarteten Werte wurden vorab
// unabhängig ermittelt (Kalender bzw. JavaScript-Date in UTC). Wochentage stehen als
// Kommentar dahinter.

describe('istKalenderdatum', () => {
  test.each([
    ['2026-10-15', true],
    ['2028-02-29', true], // Schaltjahr
    ['2000-02-29', true], // durch 400 teilbar, Schaltjahr
    ['2027-02-29', false], // kein Schaltjahr
    ['1900-02-29', false], // volles Jahrhundert, kein Schaltjahr
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['2026-00-10', false],
    ['2026-10-00', false],
    ['2026-1-5', false],
    ['15.10.2026', false],
    ['2026-10-15T00:00', false],
    ['', false],
  ])('%s → %s', (text, erwartet) => {
    expect(istKalenderdatum(text)).toBe(erwartet);
  });
});

describe('wochentag (1 = Montag … 7 = Sonntag)', () => {
  test.each([
    ['2026-10-15', 4],
    ['2026-03-28', 6],
    ['2026-03-29', 7], // Beginn Sommerzeit
    ['2026-10-25', 7], // Ende Sommerzeit
    ['2026-12-31', 4],
    ['2027-01-01', 5],
    ['2028-02-28', 1],
    ['2028-02-29', 2],
    ['2028-03-01', 3],
  ])('%s → %i', (datum, erwartet) => {
    expect(wochentag(datum)).toBe(erwartet);
  });
});

describe('plusTage', () => {
  test.each([
    ['2026-10-15', 0, '2026-10-15'],
    ['2026-10-15', 14, '2026-10-29'], // Neuanlage Fall: WV-Datum = Anlagetag + 14
    ['2026-10-15', 30, '2026-11-14'], // Zahlungsziel vor Donnerstag-Regel
    ['2026-03-28', 1, '2026-03-29'], // über Beginn Sommerzeit
    ['2026-10-24', 2, '2026-10-26'], // über Ende Sommerzeit
    ['2026-01-31', 1, '2026-02-01'], // Monatswechsel
    ['2026-04-30', 1, '2026-05-01'], // Monat mit 30 Tagen
    ['2026-12-31', 1, '2027-01-01'], // Jahreswechsel
    ['2026-12-20', 14, '2027-01-03'],
    ['2028-02-28', 1, '2028-02-29'], // Schaltjahr
    ['2028-02-29', 1, '2028-03-01'],
    ['2027-02-28', 1, '2027-03-01'], // kein Schaltjahr
    ['2028-02-20', 14, '2028-03-05'],
    ['2026-10-15', 365, '2027-10-15'],
    ['2028-01-01', 366, '2029-01-01'],
    ['2100-02-28', 1, '2100-03-01'], // volles Jahrhundert, kein Schaltjahr
  ])('%s + %i → %s', (datum, anzahl, erwartet) => {
    expect(plusTage(datum, anzahl)).toBe(erwartet);
  });

  test.each([-1, 1.5, Number.NaN])('lehnt Anzahl %s ab', (anzahl) => {
    expect(() => plusTage('2026-10-15', anzahl)).toThrow('ganze Zahl ab 0');
  });

  test('lehnt ungültiges Datum auch bei Anzahl 0 ab', () => {
    expect(() => plusTage('2027-02-29', 0)).toThrow('Ungültiges Kalenderdatum');
  });
});

describe('tageZwischen', () => {
  test.each([
    ['2026-10-15', '2026-10-15', 0],
    ['2026-10-15', '2026-10-29', 14],
    ['2026-10-29', '2026-10-15', -14],
    ['2026-03-28', '2026-03-30', 2], // über Beginn Sommerzeit
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2], // mit 29. Februar
    ['2027-02-28', '2027-03-01', 1], // ohne 29. Februar
  ])('%s bis %s → %i', (von, bis, erwartet) => {
    expect(tageZwischen(von, bis)).toBe(erwartet);
  });
});

describe('istArbeitstag', () => {
  test.each([
    ['2026-10-15', undefined, true], // Do
    ['2026-10-17', undefined, false], // Sa
    ['2026-10-18', undefined, false], // So
    ['2027-01-01', undefined, true], // Fr, Neujahr zählt ohne Feiertagsliste als Arbeitstag
    ['2027-01-01', new Set(['2027-01-01']), false], // mit Feiertagsliste nicht
  ])('%s (Feiertage %o) → %s', (datum, feiertage, erwartet) => {
    expect(istArbeitstag(datum, feiertage)).toBe(erwartet);
  });
});

describe('plusArbeitstage (Ausgangstag zählt nicht mit)', () => {
  test.each<[string, number, Set<string> | undefined, string]>([
    ['2026-10-15', 0, undefined, '2026-10-15'], // Do
    ['2026-10-15', 1, undefined, '2026-10-16'], // Do → Fr
    ['2026-10-15', 2, undefined, '2026-10-19'], // Do → Mo, Wochenende übersprungen
    ['2026-10-15', 5, undefined, '2026-10-22'], // → Do
    ['2026-10-15', 10, undefined, '2026-10-29'], // → Do
    ['2026-10-15', 20, undefined, '2026-11-12'], // → Do, über Monatswechsel
    ['2026-10-17', 1, undefined, '2026-10-19'], // Sa → Mo
    ['2026-03-28', 1, undefined, '2026-03-30'], // Sa → Mo, über Beginn Sommerzeit
    ['2026-10-25', 1, undefined, '2026-10-26'], // So → Mo, Ende Sommerzeit
    ['2026-01-30', 1, undefined, '2026-02-02'], // Fr → Mo, Monatswechsel
    ['2026-12-30', 3, undefined, '2027-01-04'], // Mi → Mo, Jahreswechsel
    ['2026-12-30', 3, new Set(['2027-01-01']), '2027-01-05'], // mit Neujahr als Feiertag
    ['2026-10-15', 1, new Set(['2026-10-16']), '2026-10-19'], // Feiertag am Freitag
    ['2028-02-24', 3, undefined, '2028-02-29'], // Do → Di 29.02.
    ['2027-02-26', 1, undefined, '2027-03-01'], // Fr → Mo, kein 29.02.
  ])('%s + %i (Feiertage %o) → %s', (datum, anzahl, feiertage, erwartet) => {
    expect(plusArbeitstage(datum, anzahl, feiertage)).toBe(erwartet);
  });

  test('lehnt negative Anzahl ab', () => {
    expect(() => plusArbeitstage('2026-10-15', -1)).toThrow('ganze Zahl ab 0');
  });
});

describe('arbeitstageZwischen (nach "von" bis einschließlich "bis")', () => {
  test.each<[string, string, Set<string> | undefined, number]>([
    ['2026-10-15', '2026-10-15', undefined, 0], // gleicher Tag
    ['2026-10-15', '2026-10-16', undefined, 1], // Do → Fr
    ['2026-10-16', '2026-10-19', undefined, 1], // Fr → Mo
    ['2026-10-17', '2026-10-18', undefined, 0], // Sa → So
    ['2026-10-15', '2026-10-29', undefined, 10],
    ['2026-10-29', '2026-10-15', undefined, -10], // rückwärts
    ['2026-03-27', '2026-03-30', undefined, 1], // über Beginn Sommerzeit
    ['2026-12-30', '2027-01-04', undefined, 3], // Jahreswechsel
    ['2026-12-30', '2027-01-04', new Set(['2027-01-01']), 2],
    ['2028-02-28', '2028-03-01', undefined, 2], // über 29.02.
  ])('%s bis %s (Feiertage %o) → %i', (von, bis, feiertage, erwartet) => {
    expect(arbeitstageZwischen(von, bis, feiertage)).toBe(erwartet);
  });

  test('ist das Gegenstück zu plusArbeitstage', () => {
    const feiertage = new Set(['2026-12-25', '2027-01-01']);
    for (let start = 0; start < 14; start++) {
      const datum = plusTage('2026-12-17', start);
      for (let n = 0; n <= 25; n++) {
        expect(arbeitstageZwischen(datum, plusArbeitstage(datum, n, feiertage), feiertage)).toBe(n);
      }
    }
  });
});

describe('naechsterArbeitstag (Sa und So → Montag)', () => {
  test.each([
    ['2026-10-16', '2026-10-16'], // Fr bleibt
    ['2026-10-19', '2026-10-19'], // Mo bleibt
    ['2026-10-17', '2026-10-19'], // Sa
    ['2026-10-18', '2026-10-19'], // So
    ['2026-10-31', '2026-11-02'], // Sa, über das Monatsende
    ['2027-01-02', '2027-01-04'], // Sa, nach dem Jahreswechsel
    ['2028-02-26', '2028-02-28'], // Sa, vor dem 29.02.
  ])('%s → %s', (datum, erwartet) => {
    expect(naechsterArbeitstag(datum)).toBe(erwartet);
  });
});

describe('naechsterDonnerstag', () => {
  test.each([
    ['2026-10-15', '2026-10-15'], // Do bleibt
    ['2026-10-14', '2026-10-15'], // Mi
    ['2026-10-16', '2026-10-22'], // Fr
    ['2026-10-25', '2026-10-29'], // So, Ende Sommerzeit
    ['2026-12-30', '2026-12-31'], // Mi
    ['2027-01-01', '2027-01-07'], // Fr, über Jahreswechsel hinaus
    ['2028-02-28', '2028-03-02'], // Mo, über 29.02.
    ['2028-02-29', '2028-03-02'], // Di
    ['2027-02-26', '2027-03-04'], // Fr, kein 29.02.
  ])('%s → %s', (datum, erwartet) => {
    expect(naechsterDonnerstag(datum)).toBe(erwartet);
  });
});

describe('datumsteile', () => {
  test('zerlegt ein Datum in Zahlen', () => {
    expect(datumsteile('2028-02-29')).toEqual({ jahr: 2028, monat: 2, tag: 29 });
  });

  test('wirft bei ungültigem Datum', () => {
    expect(() => datumsteile('2027-02-29')).toThrow();
  });
});

describe('datumImMonat (Tag auf Monatslänge begrenzt)', () => {
  // [Jahr, Monat, gewünschter Tag, Ergebnis]
  test.each([
    [2026, 10, 15, '2026-10-15'],
    [2026, 10, 31, '2026-10-31'],
    [2026, 4, 31, '2026-04-30'],
    [2027, 2, 31, '2027-02-28'],
    [2027, 2, 29, '2027-02-28'], // kein Schaltjahr
    [2028, 2, 29, '2028-02-29'], // Schaltjahr
    [2100, 2, 29, '2100-02-28'], // volles Jahrhundert, kein Schaltjahr
    [2000, 2, 30, '2000-02-29'], // durch 400 teilbar, Schaltjahr
  ])('%i, Monat %i, Tag %i → %s', (jahr, monat, tag, erwartet) => {
    expect(datumImMonat(jahr, monat, tag)).toBe(erwartet);
  });

  test.each([
    [2026, 0, 1],
    [2026, 13, 1],
    [2026, 1, 0],
    [2026, 1, 32],
    [2026, 1, 1.5],
    [0, 1, 1],
  ])('wirft bei Jahr %i, Monat %i, Tag %s', (jahr, monat, tag) => {
    expect(() => datumImMonat(jahr, monat, tag)).toThrow();
  });
});

describe('Abgleich mit JavaScript-Date für jeden Tag von 1999 bis 2030', () => {
  // Unabhängige Gegenprobe: Date rechnet in UTC ohne Zeitzone. Hier im Test ist das
  // erlaubt, in den Regeln selbst nicht.
  test('Wochentag und Folgetag stimmen überein', () => {
    const tagMs = 24 * 60 * 60 * 1000;
    let datum = '1999-12-25';
    for (let ms = Date.UTC(1999, 11, 25); ms <= Date.UTC(2030, 0, 10); ms += tagMs) {
      const referenz = new Date(ms);
      expect(datum).toBe(referenz.toISOString().slice(0, 10));
      expect(wochentag(datum)).toBe(referenz.getUTCDay() === 0 ? 7 : referenz.getUTCDay());
      datum = plusTage(datum, 1);
    }
  });
});

describe('Wächter: Regeln verwenden kein Date', () => {
  // Nur heute.ts darf die Uhr lesen. Alle anderen Regeldateien rechnen mit
  // Kalenderdaten als Text, damit Zeitzonen sie nicht beeinflussen können.
  const ordner = new URL('./', import.meta.url);
  const dateien = readdirSync(ordner).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'heute.ts',
  );

  test.each(dateien)('%s enthält kein Date', (name) => {
    const quelltext = readFileSync(new URL(name, ordner), 'utf8')
      .replace(/\/\/.*$/gm, '') // Kommentare zählen nicht
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(quelltext).not.toMatch(/\bDate\b/);
  });
});
