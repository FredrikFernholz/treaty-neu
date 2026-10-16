import { readFileSync } from 'node:fs';
import { passwortSchema } from '../../shared/schemas/passwort.js';

// Prüfung eines neuen Passworts (Konzeption 9, Entscheidung 16.10.2026).
//
// Ein neues Passwort muss die gemeinsamen Regeln aus shared/schemas/passwort.ts erfüllen
// (12 bis 256 Zeichen) und darf nicht in der Liste häufiger Passwörter stehen. Die Liste
// besteht aus den 10.000 häufigsten Einträgen mit mindestens 12 Zeichen aus SecLists und
// einer eigenen Ergänzung mit Firmenbegriffen und deutschen Mustern. Beide liegen im
// Ordner daten/ mit Herkunft im Dateikopf und werden mit
// backend/tools/passwortliste-erzeugen.mjs erzeugt. Verglichen wird ohne Beachtung der
// Groß- und Kleinschreibung.
//
// Auf erzwungene Wechsel in festen Abständen und Regeln wie "mindestens eine Ziffer"
// wird bewusst verzichtet (Konzeption 9).

const LISTEN = ['haeufige-passwoerter-seclists.txt', 'haeufige-passwoerter-eigene.txt'];

/** Liest eine Liste ein. Leerzeilen und Kommentarzeilen mit # am Anfang werden übersprungen. */
export function liesPasswortliste(dateiname: string): string[] {
  const text = readFileSync(new URL(`./daten/${dateiname}`, import.meta.url), 'utf8');
  return text.split('\n').filter((zeile) => zeile !== '' && !zeile.startsWith('#'));
}

// Die Listen werden beim ersten Aufruf einmal eingelesen und dann im Speicher gehalten.
let haeufige: Set<string> | undefined;

function haeufigePasswoerter(): Set<string> {
  haeufige ??= new Set(LISTEN.flatMap(liesPasswortliste).map((p) => p.toLowerCase()));
  return haeufige;
}

/** true, wenn das Passwort ohne Beachtung der Groß- und Kleinschreibung in der Liste steht. */
export function istHaeufigesPasswort(passwort: string): boolean {
  return haeufigePasswoerter().has(passwort.toLowerCase());
}

/**
 * Prüft ein neues Passwort und liefert die Fehlermeldungen für die Oberfläche. Eine leere
 * Liste bedeutet, dass das Passwort verwendet werden darf.
 */
export function pruefeNeuesPasswort(passwort: string): string[] {
  const ergebnis = passwortSchema.safeParse(passwort);
  const fehler = ergebnis.success ? [] : ergebnis.error.issues.map((issue) => issue.message);
  if (istHaeufigesPasswort(passwort)) {
    fehler.push('Dieses Passwort ist weit verbreitet und leicht zu erraten. Bitte ein anderes wählen.');
  }
  return fehler;
}
