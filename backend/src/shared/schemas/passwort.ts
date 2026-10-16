import { z } from 'zod';

// Regeln für ein neues Passwort, die Backend und Frontend gleichermaßen prüfen
// (Konzeption 9). Die Prüfung gegen die Liste häufiger Passwörter liegt nur im Backend
// (modules/anmeldung/passwortpruefung.ts), weil sie Dateien liest.
//
// Gezählt werden Zeichen, wie sie ein Mensch sieht, nicht UTF-16-Einheiten. Ein Emoji
// zählt also als ein Zeichen und nicht als zwei. Das Passwort wird nie verändert, auch
// Leerzeichen am Anfang oder Ende gehören dazu.
//
// Die Obergrenze von 256 Zeichen ist kein fachlicher Wunsch, sondern ein Schutz, damit
// niemand den Server mit riesigen Eingaben für argon2 beschäftigt. Sie liegt weit über
// dem, was OWASP mindestens zulassen will (64 Zeichen).

export const PASSWORT_MINDESTLAENGE = 12;
export const PASSWORT_HOECHSTLAENGE = 256;

const anzahlZeichen = (text: string) => [...text].length;

export const passwortSchema = z
  .string()
  .refine((p) => anzahlZeichen(p) >= PASSWORT_MINDESTLAENGE, {
    message: `Das Passwort muss mindestens ${PASSWORT_MINDESTLAENGE} Zeichen lang sein.`,
  })
  .refine((p) => anzahlZeichen(p) <= PASSWORT_HOECHSTLAENGE, {
    message: `Das Passwort darf höchstens ${PASSWORT_HOECHSTLAENGE} Zeichen lang sein.`,
  });
