import type { Ich } from '@shared/schemas/anmeldung.js';
import { describe, expect, test } from 'vitest';
import { entscheideNavigation, sichererZielpfad } from './navigation';

const sachbearbeiter: Ich = {
  kuerzel: 'DW',
  name: 'Dirk Wiethölter',
  berechtigung: 'sachbearbeiter',
  zusatzrechte: [],
  passwortWechselNoetig: false,
};
const admin: Ich = { ...sachbearbeiter, kuerzel: 'AB', berechtigung: 'administrator' };
const mitWechsel: Ich = { ...admin, passwortWechselNoetig: true };

const seite = (name: string, fullPath: string, meta = {}) => ({ name, fullPath, meta });
const START = seite('start', '/');
const ANMELDEN = seite('anmelden', '/anmelden', { oeffentlich: true });
const PASSWORT = seite('passwort-aendern', '/passwort-aendern', { erlaubtBeiPasswortwechsel: true });
const BENUTZER = seite('benutzer', '/benutzer?seite=2', { bereich: 'nutzerverwaltung' });

describe('entscheideNavigation', () => {
  test.each<[string, ReturnType<typeof seite>, Ich | null, unknown]>([
    ['nicht angemeldet, Startseite', START, null, { name: 'anmelden' }],
    ['nicht angemeldet, Unterseite merkt sich das Ziel', BENUTZER, null, { name: 'anmelden', query: { ziel: '/benutzer?seite=2' } }],
    ['nicht angemeldet, Anmeldeseite', ANMELDEN, null, true],
    ['angemeldet, Anmeldeseite führt zur Startseite', ANMELDEN, sachbearbeiter, { name: 'start' }],
    ['angemeldet, Startseite', START, sachbearbeiter, true],
    ['Pflichtwechsel, Startseite', START, mitWechsel, { name: 'passwort-aendern' }],
    ['Pflichtwechsel, Nutzerverwaltung', BENUTZER, mitWechsel, { name: 'passwort-aendern' }],
    ['Pflichtwechsel, Passwortseite', PASSWORT, mitWechsel, true],
    ['Sachbearbeiter/in ohne Zusatzrecht, Nutzerverwaltung', BENUTZER, sachbearbeiter, { name: 'kein-zugriff' }],
    ['Sachbearbeiter/in mit Zusatzrecht, Nutzerverwaltung', BENUTZER, { ...sachbearbeiter, zusatzrechte: ['nutzerverwaltung'] }, true],
    ['Administrator, Nutzerverwaltung', BENUTZER, admin, true],
  ])('%s', (_name, ziel, ich, erwartet) => {
    expect(entscheideNavigation(ziel, ich)).toEqual(erwartet);
  });
});

describe('sichererZielpfad', () => {
  test.each([
    ['/benutzer?seite=2', '/benutzer?seite=2'],
    ['/', '/'],
    ['//boese.example', '/'], // würde als Adresse einer fremden Seite gelten
    ['https://boese.example', '/'],
    ['/\\boese.example', '/'],
    ['benutzer', '/'],
    [undefined, '/'],
    [['/a', '/b'], '/'], // ?ziel=…&ziel=… ergibt eine Liste
  ])('%j → %j', (eingabe, erwartet) => {
    expect(sichererZielpfad(eingabe)).toBe(erwartet);
  });
});
