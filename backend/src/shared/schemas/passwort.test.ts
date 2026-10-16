import { describe, expect, test } from 'vitest';
import { passwortSchema } from './passwort.js';

// Jede Tabellenzeile ist ein eigener Testfall.

describe('passwortSchema', () => {
  test.each([
    ['a'.repeat(12), 'genau 12 Zeichen'],
    ['a'.repeat(256), 'genau 256 Zeichen'],
    ['Sonnenblume-Kaffeetasse-17', 'Passphrase'],
    ['😀'.repeat(12), '12 Emoji, zählen als 12 Zeichen'],
    ['  zwölf mit Leerzeichen  ', 'Leerzeichen zählen mit'],
  ])('akzeptiert %j (%s)', (passwort) => {
    expect(passwortSchema.safeParse(passwort).success).toBe(true);
  });

  test.each<[unknown, string]>([
    ['a'.repeat(11), '11 Zeichen'],
    ['😀'.repeat(11), '11 Emoji, obwohl es 22 UTF-16-Einheiten sind'],
    ['a'.repeat(257), '257 Zeichen'],
    ['', 'leer'],
    [123456789012, 'Zahl statt Text'],
    [null, 'null'],
  ])('lehnt %j ab (%s)', (passwort) => {
    expect(passwortSchema.safeParse(passwort).success).toBe(false);
  });

  test('deutsche Meldung bei zu kurzem Passwort', () => {
    const ergebnis = passwortSchema.safeParse('kurz');
    expect(ergebnis.success).toBe(false);
    expect(ergebnis.error?.issues.map((i) => i.message)).toEqual([
      'Das Passwort muss mindestens 12 Zeichen lang sein.',
    ]);
  });
});
