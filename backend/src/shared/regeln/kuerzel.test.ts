import { describe, expect, test } from 'vitest';
import { RESERVIERTE_KUERZEL, kuerzelSchema } from '../schemas/benutzer.js';
import { schlageKuerzelVor } from './kuerzel.js';

const reserviert = new Set<string>(RESERVIERTE_KUERZEL);
const mit = (...vergeben: string[]) => new Set([...reserviert, ...vergeben]);

describe('schlageKuerzelVor', () => {
  // [Name, vergebene Kürzel, erwarteter Vorschlag]
  test.each<[string, string[], string | null]>([
    ['Anna Beispiel', [], 'AB'],
    ['Anna Beispiel', ['AB'], 'ABE'], // bei Kollision der zweite Buchstabe des Nachnamens
    ['Anna Beispiel', ['AB', 'ABE'], 'AB2'], // danach eine Ziffer
    ['Anna Beispiel', ['AB', 'ABE', 'AB2', 'AB3'], 'AB4'],
    ['anna beispiel', [], 'AB'], // klein geschrieben
    ['  Anna   Beispiel  ', [], 'AB'], // überflüssige Leerzeichen
    ['Anna Maria Beispiel', [], 'AB'], // Mittelname zählt nicht
    ['Anna Müller-Lüdenscheid', [], 'AL'], // Doppelname: letzter Teil
    ['Jürgen Öztürk', [], 'JO'], // Umlaute auf den Grundbuchstaben
    ['Ömer Çelik', ['OC'], 'OCE'], // Ç → C
    ['René Straß', ['RS'], 'RST'],
    ['Dirk Wiethölter', [], 'DW'], // Beispiel aus PRD 13
    ['Anna', [], 'AN'], // nur ein Namensteil
    ['Anna', ['AN'], 'ANN'],
    ['Anna', ['AN', 'ANN'], 'AN2'],
    ['Bo', ['BO'], 'BO2'], // kein dritter Buchstabe vorhanden
    ['', [], null],
    ['123 !!!', [], null], // keine Buchstaben
    ['A', [], null], // zu kurz für ein Kürzel
  ])('%j, vergeben %j → %j', (name, vergeben, erwartet) => {
    expect(schlageKuerzelVor(name, mit(...vergeben))).toBe(erwartet);
  });

  test('ergibt nie ADH, auch wenn ADH an der Reihe wäre', () => {
    // Anna Dhaliwal: AD ist vergeben, als Nächstes käme ADH, das ist reserviert
    expect(schlageKuerzelVor('Anna Dhaliwal', mit('AD'))).toBe('AD2');
  });

  test('null, wenn alle 100 Möglichkeiten vergeben sind', () => {
    const alle = ['AB', 'ABE', ...Array.from({ length: 98 }, (_, i) => `AB${i + 2}`)];
    expect(schlageKuerzelVor('Anna Beispiel', mit(...alle))).toBeNull();
  });

  test('jeder Vorschlag erfüllt die Kürzelregeln', () => {
    const namen = ['Anna Beispiel', 'Jürgen Öztürk', 'Anna', 'Anna Dhaliwal', 'Ömer Çelik', 'René Straß'];
    for (const name of namen) {
      const vorschlag = schlageKuerzelVor(name, mit('AD'));
      expect(vorschlag).not.toBeNull();
      expect(kuerzelSchema.parse(vorschlag)).toBe(vorschlag);
    }
  });
});
