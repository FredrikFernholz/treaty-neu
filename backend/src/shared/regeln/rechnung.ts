import { naechsterDonnerstag, plusTage, type Kalenderdatum } from './datum.js';

// Regeln für Rechnungen (Konzeption 7, Office).

/** Kalendertage zwischen Rechnungsdatum und Zahlungsziel, vor dem Legen auf Donnerstag. */
export const ZAHLUNGSZIEL_KALENDERTAGE = 30;

/**
 * Zahlungsziel einer Rechnung (Entscheidung 16.10.2026, Abgleich A-14).
 *
 * Berechnet wird beim Festschreiben, und zwar ab dem Rechnungsdatum, also dem
 * Festschreibetag, nicht ab dem Tag, an dem der Entwurf angelegt wurde. Ein Entwurf
 * kann länger liegen, der Mandant soll trotzdem die volle Frist ab der versendeten
 * Rechnung haben. Das Zahlungsziel liegt 30 Kalendertage nach dem Rechnungsdatum und
 * wird dann auf den nächsten Donnerstag gelegt. Ist der 30. Tag ein Donnerstag, bleibt er.
 */
export function zahlungsziel(rechnungsdatum: Kalenderdatum): Kalenderdatum {
  return naechsterDonnerstag(plusTage(rechnungsdatum, ZAHLUNGSZIEL_KALENDERTAGE));
}
