import { describe, expect, test } from 'vitest';
import { alsDbWert, betrag, rundeKaufmaennisch, summe } from './geld.js';

// Jede Tabellenzeile ist ein eigener Testfall.

describe('betrag', () => {
  test.each(['0', '12', '-3.5', '1234.56', '0.005', '9999999999.99'])('liest "%s" ein', (text) => {
    expect(betrag(text).toString()).toBe(text);
  });

  test.each(['', ' 1', '1,50', '1.234,56', '1e3', '+5', '.5', '5.', 'abc', 'NaN', 'Infinity'])(
    'lehnt "%s" ab',
    (text) => {
      expect(() => betrag(text)).toThrow('Ungültiger Betrag');
    },
  );
});

describe('rundeKaufmaennisch', () => {
  test.each([
    // Grenzfälle, an denen eine normale JavaScript-Zahl falsch rundet
    ['1.005', '1.01'],
    ['1.015', '1.02'],
    ['2.675', '2.68'],
    ['1.0049999', '1'],
    // Negative Beträge: ab ...5 vom Nullpunkt weg
    ['-1.005', '-1.01'],
    ['-1.004', '-1'],
    ['-0.005', '-0.01'],
    // Schon gerundete Werte bleiben unverändert
    ['12.50', '12.5'],
    ['0', '0'],
    // Großer Wert nahe der Obergrenze von DECIMAL(12,2)
    ['9999999999.994', '9999999999.99'],
  ])('%s → %s', (eingabe, erwartet) => {
    expect(rundeKaufmaennisch(betrag(eingabe)).toString()).toBe(erwartet);
  });
});

describe('summe', () => {
  test.each<[string[], string]>([
    [[], '0'],
    [['0.1', '0.2'], '0.3'], // mit number wäre das 0.30000000000000004
    [['100.00', '-30.25', '0.005'], '69.755'], // ohne Rundung
  ])('%j → %s', (eingaben, erwartet) => {
    expect(summe(...eingaben.map(betrag)).toString()).toBe(erwartet);
  });
});

describe('alsDbWert', () => {
  test.each([
    ['1234.5', '1234.50'],
    ['0', '0.00'],
    ['-12.3', '-12.30'],
    ['9999999999.99', '9999999999.99'],
    ['-9999999999.99', '-9999999999.99'],
  ])('%s → "%s"', (eingabe, erwartet) => {
    expect(alsDbWert(betrag(eingabe))).toBe(erwartet);
  });

  test('gerundetes -0,004 wird "0.00", nicht "-0.00"', () => {
    expect(alsDbWert(rundeKaufmaennisch(betrag('-0.004')))).toBe('0.00');
  });

  test('lehnt ungerundeten Betrag ab', () => {
    expect(() => alsDbWert(betrag('1.005'))).toThrow('nicht auf 2 Nachkommastellen gerundet');
  });

  test.each(['10000000000.00', '-10000000000.00'])('lehnt %s als zu groß ab', (eingabe) => {
    expect(() => alsDbWert(betrag(eingabe))).toThrow('zu groß für DECIMAL(12,2)');
  });
});

describe('Beispiel Zeithonorar (Konzeption 7): Minuten / 60 * Stundensatz, gerundet je Teilsumme', () => {
  test('7 Minuten zu 95,00€ ergeben 11,08€', () => {
    const ergebnis = betrag('95.00').mul(7).div(60);
    expect(ergebnis.toFixed(5)).toBe('11.08333'); // Zwischenstand ungerundet
    expect(alsDbWert(rundeKaufmaennisch(ergebnis))).toBe('11.08');
  });

  test('drei Buchungen werden erst als Summe gerundet, nicht einzeln', () => {
    // Je 1 Minute zu 100,00€ = 1,6666…€. Einzeln gerundet wären es 3 × 1,67 = 5,01€,
    // als Summe gerundet 5,00€. Die Regel verlangt Rundung je Teilsumme.
    const buchungen = [1, 1, 1].map((minuten) => betrag('100.00').mul(minuten).div(60));
    expect(alsDbWert(rundeKaufmaennisch(summe(...buchungen)))).toBe('5.00');
  });
});
