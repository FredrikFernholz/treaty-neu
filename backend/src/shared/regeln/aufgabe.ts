import { tageZwischen, type Kalenderdatum } from './datum.js';
import type { Ampel } from './fall.js';

// Regeln für Aufgaben (Konzeption 7, PRD 7, Felddokumentation Blatt Aufgaben).
// Anders als bei Fällen zählen hier Kalendertage bis zum Termin, nicht Arbeitstage seit
// der letzten Statusänderung. Die Zählweise in Kalendertagen und die Grenze "ab 7 Tage
// vor dem Frist-Datum" stammen aus der Entwicklerdoku des Altsystems (Abschnitt 8.2,
// vom Fachteam bestätigt). Neutrale Frist vor dieser Grenze, getrennte Anzeige von
// WV-Ampel und Frist und das Verhalten abgeschlossener Aufgaben folgen der
// Entscheidung vom 16.10.2026 (Abgleich A-11).

/** Ab so vielen Kalendertagen bis zum WV-Datum ist die Ampel einer Aufgabe grün. */
export const AUFGABE_GRUEN_AB_TAGEN = 6;

/**
 * Ampelfarbe des WV-Datums einer Aufgabe. Grün ab 6 Tagen bis zum Termin, gelb von
 * 0 bis 5 Tagen (also auch am Tag des WV-Datums selbst), rot, sobald der Termin
 * verstrichen ist. Eine abgeschlossene Aufgabe ist immer grün.
 */
export function ampelAufgabe(
  aufgabe: { wvDatum: Kalenderdatum; abgeschlossen: boolean },
  heute: Kalenderdatum,
): Ampel {
  if (aufgabe.abgeschlossen) return 'gruen';
  const verbleibend = tageZwischen(heute, aufgabe.wvDatum);
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
 * Ohne Frist-Datum und bei einer abgeschlossenen Aufgabe ist das Ergebnis null, es wird
 * also keine Frist angezeigt. Eine Frist entsteht nie automatisch, sondern nur durch
 * Eintragen von Hand.
 */
export function fristAnzeige(
  aufgabe: { fristDatum: Kalenderdatum | null; abgeschlossen: boolean },
  heute: Kalenderdatum,
): FristAnzeige | null {
  if (aufgabe.abgeschlossen || aufgabe.fristDatum === null) return null;
  const verbleibend = tageZwischen(heute, aufgabe.fristDatum);
  if (verbleibend < 0) return 'rot';
  if (verbleibend <= FRIST_BLINKEND_AB_TAGEN) return 'blinkend';
  return 'neutral';
}
