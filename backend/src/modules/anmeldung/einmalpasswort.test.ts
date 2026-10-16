import { describe, expect, test } from 'vitest';
import { erzeugeEinmalpasswort } from './einmalpasswort.js';
import { pruefeNeuesPasswort } from './passwortpruefung.js';

describe('erzeugeEinmalpasswort', () => {
  const beispiele = Array.from({ length: 1000 }, erzeugeEinmalpasswort);

  test('4 Gruppen zu 5 Zeichen mit Bindestrich', () => {
    for (const p of beispiele) expect(p).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);
  });

  test('ohne verwechselbare Zeichen 0 O o 1 I l', () => {
    for (const p of beispiele) expect(p).not.toMatch(/[0Oo1Il]/);
  });

  test('1000 Einmalpasswörter sind alle verschieden', () => {
    expect(new Set(beispiele).size).toBe(1000);
  });

  test('erfüllt die Passwortregeln', () => {
    for (const p of beispiele.slice(0, 50)) expect(pruefeNeuesPasswort(p)).toEqual([]);
  });
});
