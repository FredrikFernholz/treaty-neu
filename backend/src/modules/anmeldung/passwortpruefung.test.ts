import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { istHaeufigesPasswort, liesPasswortliste, pruefeNeuesPasswort } from './passwortpruefung.js';

const ZU_KURZ = 'Das Passwort muss mindestens 12 Zeichen lang sein.';
const HAEUFIG = 'Dieses Passwort ist weit verbreitet und leicht zu erraten. Bitte ein anderes wählen.';

// Beide Listen erzeugt backend/tools/passwortliste-erzeugen.mjs. Die Tests prüfen, dass
// die eingecheckten Dateien zu ihrem Kopf passen und die Filterregel einhalten.

function teileDatei(dateiname: string) {
  const text = readFileSync(new URL(`./daten/${dateiname}`, import.meta.url), 'utf8');
  const kopfEnde = '# Ende des Kopfs\n';
  const grenze = text.indexOf(kopfEnde) + kopfEnde.length;
  return { kopf: text.slice(0, grenze), inhalt: text.slice(grenze) };
}

describe.each(['haeufige-passwoerter-seclists.txt', 'haeufige-passwoerter-eigene.txt'])('%s', (dateiname) => {
  const { kopf, inhalt } = teileDatei(dateiname);
  const eintraege = liesPasswortliste(dateiname);

  test('der Inhalt unter dem Kopf passt zur Prüfsumme im Kopf', () => {
    const vermerkt = /SHA-256 des Inhalts unter dem Kopf: ([0-9a-f]{64})/.exec(kopf)?.[1];
    expect(vermerkt).toBeDefined();
    expect(createHash('sha256').update(inhalt, 'utf8').digest('hex')).toBe(vermerkt);
  });

  test('jeder Eintrag hat mindestens 12 Zeichen', () => {
    for (const eintrag of eintraege) expect([...eintrag].length).toBeGreaterThanOrEqual(12);
  });

  test('keine Doppelten ohne Beachtung der Groß- und Kleinschreibung', () => {
    expect(new Set(eintraege.map((e) => e.toLowerCase())).size).toBe(eintraege.length);
  });

  test('unter dem Kopf gibt es keine Leerzeilen und keine Zeilen mit #', () => {
    expect(eintraege).toHaveLength(inhalt.split('\n').length - 1);
  });
});

describe('Liste aus SecLists', () => {
  const { kopf } = teileDatei('haeufige-passwoerter-seclists.txt');

  test('der Kopf nennt Repository, Pfad, Commit, Prüfsumme der Quelle und Lizenz', () => {
    expect(kopf).toContain('https://github.com/danielmiessler/SecLists');
    expect(kopf).toContain('Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt');
    expect(kopf).toContain('f1196104c5594a19d78b486c52c0794b9d947993');
    expect(kopf).toContain('424a3e03a17df0a2bc2b3ca749d81b04e79d59cb7aeec8876a5a3f308d0caf51');
    expect(kopf).toContain('MIT License');
    expect(kopf).toContain('Copyright (c) 2018 Daniel Miessler');
  });

  test('genau 10.000 Einträge', () => {
    expect(liesPasswortliste('haeufige-passwoerter-seclists.txt')).toHaveLength(10000);
  });
});

describe('eigene Ergänzung', () => {
  const eintraege = liesPasswortliste('haeufige-passwoerter-eigene.txt');

  test('alle Einträge sind klein geschrieben', () => {
    for (const eintrag of eintraege) expect(eintrag).toBe(eintrag.toLowerCase());
  });

  test.each([
    'adh deutschland gmbh',
    'adhdeutschland2030!',
    'passwort2026!',
    'willkommen2020',
    'frühling2030!',
    'fruehling2025',
    'qwertzuiop123',
    '1qay2wsx3edc',
    '123456789012',
    '000000000000',
  ])('enthält %j', (eintrag) => {
    expect(eintraege).toContain(eintrag);
  });

  test.each(['treaty2026', 'hallo2026!', 'adh'])('enthält %j nicht, weil kürzer als 12 Zeichen', (eintrag) => {
    expect(eintraege).not.toContain(eintrag);
  });
});

describe('istHaeufigesPasswort', () => {
  test.each([
    ['qwertyqwerty', true], // SecLists
    ['QwertyQwerty', true], // Groß- und Kleinschreibung spielt keine Rolle
    ['1qaz2wsx3edc', true], // SecLists
    ['ADHDeutschland2026!', true], // eigene Ergänzung, Firmenname mit Jahreszahl
    ['Willkommen2026!', true], // eigene Ergänzung, deutsches Muster
    ['Frühling2030!', true],
    ['Sonnenblume-Kaffeetasse-17', false],
    ['123456', false], // steht in keiner Liste mehr, scheitert aber an der Mindestlänge
    ['', false],
  ])('%j → %s', (passwort, erwartet) => {
    expect(istHaeufigesPasswort(passwort)).toBe(erwartet);
  });
});

describe('pruefeNeuesPasswort', () => {
  test.each<[string, string[]]>([
    ['Sonnenblume-Kaffeetasse-17', []],
    ['kurz', [ZU_KURZ]],
    ['123456', [ZU_KURZ]],
    ['qwertyqwerty', [HAEUFIG]], // lang genug, aber häufig
    ['Passwort2026!', [HAEUFIG]], // eigene Ergänzung
  ])('%j → %j', (passwort, erwartet) => {
    expect(pruefeNeuesPasswort(passwort)).toEqual(erwartet);
  });
});
