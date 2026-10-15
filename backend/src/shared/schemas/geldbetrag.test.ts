import { describe, expect, test } from 'vitest';
import { alsDbWert, betrag, rundeKaufmaennisch } from '../regeln/geld.js';
import { geldbetragSchema } from './geldbetrag.js';

// Jede Tabellenzeile ist ein eigener Testfall.

describe('geldbetragSchema', () => {
  test.each(['0', '0.5', '0.05', '12', '12.5', '12.50', '-30.25', '-0.01', '9999999999.99', '-9999999999.99'])(
    'akzeptiert "%s"',
    (eingabe) => {
      expect(geldbetragSchema.safeParse(eingabe).success).toBe(true);
    },
  );

  test.each<[unknown, string]>([
    ['1.005', 'drei Nachkommastellen'],
    ['1,50', 'Komma statt Punkt'],
    ['1.234,56', 'deutsche Schreibweise'],
    ['007', 'führende Nullen'],
    ['10000000000', 'mehr als 10 Stellen vor dem Punkt'],
    ['1e3', 'Exponentschreibweise'],
    ['+5', 'Pluszeichen'],
    ['.5', 'ohne Ziffer vor dem Punkt'],
    ['5.', 'Punkt ohne Nachkommastelle'],
    [' 5', 'Leerzeichen'],
    ['', 'leerer Text'],
    [12.5, 'Zahl statt Text'],
    [null, 'null'],
  ])('lehnt %j ab (%s)', (eingabe) => {
    expect(geldbetragSchema.safeParse(eingabe).success).toBe(false);
  });

  test('jeder von alsDbWert erzeugte Text besteht das Schema', () => {
    // Was Treaty selbst aus der Datenbank liest und in der API ausgibt, muss das Schema
    // immer bestehen.
    for (const eingabe of ['0', '-0.004', '1.005', '-1.005', '12.5', '9999999999.994']) {
      const text = alsDbWert(rundeKaufmaennisch(betrag(eingabe)));
      expect(geldbetragSchema.safeParse(text).success, text).toBe(true);
    }
  });
});
