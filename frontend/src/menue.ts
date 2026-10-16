import { darf, type Bereich, type Rechteinhaber } from '@shared/rechte/rechtematrix.js';

// Hauptmenü. Ein Punkt erscheint nur, wenn die Rechtematrix den Bereich erlaubt. Die
// Fachmodule kommen mit ihren Ausbaustufen dazu. Der Server sperrt unabhängig davon.

export type Menuepunkt = { route: string; titel: string; bereich?: Bereich };

export const MENUEPUNKTE: Menuepunkt[] = [
  { route: 'start', titel: 'Start' },
  { route: 'benutzer', titel: 'Nutzerverwaltung', bereich: 'nutzerverwaltung' },
];

export function sichtbareMenuepunkte(person: Rechteinhaber | null): Menuepunkt[] {
  if (!person) return [];
  return MENUEPUNKTE.filter((p) => p.bereich === undefined || darf(person, p.bereich));
}
