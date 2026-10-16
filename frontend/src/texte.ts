import type { Berechtigung } from '@shared/rechte/rechtematrix.js';
import type { ZEICHNUNGEN } from '@shared/schemas/benutzer.js';

// Anzeigetexte für Codes, die das Backend liefert. Gespeichert und übertragen werden die
// Codes, die Oberfläche zeigt diese Texte.

export const BERECHTIGUNG_BEZEICHNUNG: Record<Berechtigung, string> = {
  administrator: 'Administrator',
  sachbearbeiter: 'Sachbearbeiter/in',
};

export const ZEICHNUNG_BEZEICHNUNG: Record<(typeof ZEICHNUNGEN)[number], string> = {
  ppa: 'ppa.',
  iv: 'i.V.',
  ia: 'i.A.',
  ohne: 'ohne',
};
