import { describe, expect, test } from 'vitest';
import { benutzernameSchema, emailSchema, kuerzelSchema } from './benutzer.js';

// Jede Tabellenzeile ist ein eigener Testfall.

describe('kuerzelSchema', () => {
  test.each([
    ['DW', 'DW'],
    ['dw', 'DW'], // in Großbuchstaben übernommen
    ['  ab2 ', 'AB2'], // ohne Leerzeichen am Rand
    ['ABCDEFGHIJ', 'ABCDEFGHIJ'], // genau 10 Zeichen
    ['ADH2', 'ADH2'], // nur genau "ADH" ist reserviert
  ])('akzeptiert %j als %j', (eingabe, erwartet) => {
    expect(kuerzelSchema.parse(eingabe)).toBe(erwartet);
  });

  test.each([
    ['A', 'nur 1 Zeichen'],
    ['ABCDEFGHIJK', '11 Zeichen'],
    ['A-B', 'Bindestrich'],
    ['Ä B', 'Umlaut und Leerzeichen'],
    ['', 'leer'],
  ])('lehnt %j ab (%s)', (eingabe) => {
    expect(kuerzelSchema.safeParse(eingabe).error?.issues[0]?.message).toBe(
      'Das Kürzel muss aus 2 bis 10 Buchstaben oder Ziffern bestehen.',
    );
  });

  test.each(['ADH', 'adh', ' Adh '])('lehnt das reservierte Kürzel %j ab', (eingabe) => {
    expect(kuerzelSchema.safeParse(eingabe).error?.issues.map((i) => i.message)).toEqual([
      'Das Kürzel ADH ist für die Zuweisung an das Team reserviert.',
    ]);
  });
});

describe('benutzernameSchema', () => {
  test('übernimmt den Namen ohne Leerzeichen am Rand', () => {
    expect(benutzernameSchema.parse('  Anna Beispiel ')).toBe('Anna Beispiel');
  });

  test.each(['', '   ', 'x'.repeat(101)])('lehnt %j ab', (eingabe) => {
    expect(benutzernameSchema.safeParse(eingabe).success).toBe(false);
  });
});

describe('emailSchema', () => {
  test('übernimmt die Adresse klein geschrieben', () => {
    expect(emailSchema.parse(' Anna.Beispiel@ADH.email ')).toBe('anna.beispiel@adh.email');
  });

  test.each(['keine-adresse', 'a@', '@b.de', ''])('lehnt %j ab', (eingabe) => {
    expect(emailSchema.safeParse(eingabe).success).toBe(false);
  });
});
