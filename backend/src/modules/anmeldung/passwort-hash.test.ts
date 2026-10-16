import { describe, expect, test } from 'vitest';
import { hashePasswort, pruefePasswort } from './passwort-hash.js';

const PASSWORT = 'Sonnenblume-Kaffeetasse-17';

describe('hashePasswort', () => {
  // Das Format zeigt auch, dass die Zahl 2 in ARGON2_PARAMETER wirklich Argon2id ist.
  test('erzeugt einen argon2id-Hash mit den OWASP-Parametern', async () => {
    const ergebnis = await hashePasswort(PASSWORT);
    expect(ergebnis).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  });

  test('dasselbe Passwort ergibt wegen des zufälligen Salzes jedes Mal einen anderen Hash', async () => {
    expect(await hashePasswort(PASSWORT)).not.toBe(await hashePasswort(PASSWORT));
  });

  test('der Hash enthält das Passwort nicht', async () => {
    expect(await hashePasswort(PASSWORT)).not.toContain(PASSWORT);
  });
});

describe('pruefePasswort', () => {
  test.each([
    [PASSWORT, true],
    ['sonnenblume-kaffeetasse-17', false], // Groß- und Kleinschreibung zählt beim Passwort
    [`${PASSWORT} `, false], // ein Leerzeichen mehr
    ['', false],
  ])('%j → %s', async (eingabe, erwartet) => {
    const gespeichert = await hashePasswort(PASSWORT);
    expect(await pruefePasswort(eingabe, gespeichert)).toBe(erwartet);
  });

  test('Umlaute und Emoji werden korrekt geprüft', async () => {
    const passwort = 'Grüße aus Köln 🌧️ 2026';
    const gespeichert = await hashePasswort(passwort);
    expect(await pruefePasswort(passwort, gespeichert)).toBe(true);
    expect(await pruefePasswort('Grusse aus Koln 🌧️ 2026', gespeichert)).toBe(false);
  });

  test('ein Hash mit schwächeren Parametern lässt sich weiter prüfen', async () => {
    // Fester Hash von "Sonnenblume-Kaffeetasse-17" mit m=4096, t=3, p=1, einmalig mit
    // @node-rs/argon2 erzeugt. Zeigt, dass ein Hash mit anderen Parametern gültig bleibt,
    // die Parameter also aus dem Hash gelesen werden und nicht aus ARGON2_PARAMETER.
    const alt = '$argon2id$v=19$m=4096,t=3,p=1$kRk40B8QdKAq9olrbCxQ4Q$tqShUSy6kVDLtlhOZ/PmFiY+/RFoybLAuVA+Ix2PPE0';
    expect(await pruefePasswort(PASSWORT, alt)).toBe(true);
    expect(await pruefePasswort('falsch-falsch-falsch', alt)).toBe(false);
  });

  test('ein beschädigter Hash wirft eine Ausnahme statt false zu liefern', async () => {
    await expect(pruefePasswort(PASSWORT, 'kein-hash')).rejects.toThrow();
  });
});
