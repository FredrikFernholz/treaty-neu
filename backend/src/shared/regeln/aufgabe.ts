import { tageZwischen, type Kalenderdatum } from './datum.js';
import type { Ampel } from './fall.js';

// Regeln für Aufgaben (Konzeption 7, PRD 7, Felddokumentation Blatt Aufgaben).
// Anders als bei Fällen zählen hier Kalendertage bis zum Termin, nicht Arbeitstage seit
// der letzten Statusänderung. Die Zählweise in Kalendertagen und die Grenze "ab 7 Tage
// vor dem Frist-Datum" stammen aus der Entwicklerdoku des Altsystems (Abschnitt 8.2,
// vom Fachteam bestätigt), weil PRD und Konzeption sie nicht eindeutig festlegen
// (Abgleich A-11).

/** Ab so vielen Kalendertagen bis zum WV-Datum ist die Ampel einer Aufgabe grün. */
export const AUFGABE_GRUEN_AB_TAGEN = 6;

/**
 * Ampelfarbe des WV-Datums einer Aufgabe. Grün ab 6 Tagen bis zum Termin, gelb von
 * 0 bis 5 Tagen (also auch am Tag des WV-Datums selbst), rot, sobald der Termin
 * verstrichen ist.
 */
export function ampelAufgabe(wvDatum: Kalenderdatum, heute: Kalenderdatum): Ampel {
  const verbleibend = tageZwischen(heute, wvDatum);
  if (verbleibend < 0) return 'rot';
  if (verbleibend < AUFGABE_GRUEN_AB_TAGEN) return 'gelb';
  return 'gruen';
}

/** Darstellung eines Frist-Datums: neutral, blinkend (gelb/rot) oder durchgehend rot. */
export type FristAnzeige = 'neutral' | 'blinkend' | 'rot';

/** Ab so vielen Kalendertagen vor dem Frist-Datum blinkt die Frist. */
export const FRIST_BLINKEND_AB_TAGEN = 7;

/**
 * Darstellung des Frist-Datums einer Aufgabe. Neutral bis 8 Tage vorher, blinkend ab
 * 7 Tagen vorher bis einschließlich zum Fälligkeitstag, nach Ablauf durchgehend rot.
 * Ohne Frist-Datum ist das Ergebnis null. Eine Frist entsteht nie automatisch, sondern
 * nur durch Eintragen von Hand.
 */
export function fristAnzeige(
  fristDatum: Kalenderdatum | null,
  heute: Kalenderdatum,
): FristAnzeige | null {
  if (fristDatum === null) return null;
  const verbleibend = tageZwischen(heute, fristDatum);
  if (verbleibend < 0) return 'rot';
  if (verbleibend <= FRIST_BLINKEND_AB_TAGEN) return 'blinkend';
  return 'neutral';
}
