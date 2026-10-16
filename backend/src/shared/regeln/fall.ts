import {
  arbeitstageZwischen,
  naechsterDonnerstag,
  plusArbeitstage,
  plusTage,
  type Kalenderdatum,
} from './datum.js';

// Regeln für Fälle in Betriebskosten und Mieten (Konzeption 7, PRD 4 und 12).
// Werte nach docs/entscheidungen.md vom 15.10.2026, die Vorrang vor PRD, Konzeption,
// Felddokumentation und Prototyp-Code haben. Abweichend vom Prototyp-Code liegt das
// WV-Datum bei "4. Erinnerung" 10 statt 15 Arbeitstage nach dem Wechsel.
//
// Arbeitstage sind Montag bis Freitag, Feiertage spielen keine Rolle. Der Wechseltag
// selbst zählt nicht mit (Entscheidung 15.10.2026).

/** Bearbeitungsstatus eines Falls. Gespeichert wird der Code, angezeigt die Bezeichnung. */
export const FALLSTATUS = [
  'neu',
  'in_bearbeitung',
  'aw_eingegangen_mdt',
  'aw_eingegangen_vwt',
  'warte_auf_mdt',
  'warte_auf_verwalter',
  'warte_auf_dritten',
  'erinnerung_1',
  'erinnerung_2',
  'erinnerung_3',
  'erinnerung_4',
  'abgeschlossen',
] as const;

export type Fallstatus = (typeof FALLSTATUS)[number];

/** Anzeigetexte der Status, wie in PRD und Konzeption. */
export const FALLSTATUS_BEZEICHNUNG: Record<Fallstatus, string> = {
  neu: 'NEU',
  in_bearbeitung: 'in Bearbeitung',
  aw_eingegangen_mdt: 'AW eingegangen MDT',
  aw_eingegangen_vwt: 'AW eingegangen VWT',
  warte_auf_mdt: 'warte auf MDT',
  warte_auf_verwalter: 'warte auf Verwalter',
  warte_auf_dritten: 'warte auf Dritten',
  erinnerung_1: '1. Erinnerung',
  erinnerung_2: '2. Erinnerung',
  erinnerung_3: '3. Erinnerung',
  erinnerung_4: '4. Erinnerung',
  abgeschlossen: 'abgeschlossen',
};

type OffenerStatus = Exclude<Fallstatus, 'abgeschlossen'>;

// WV-Datum bei echtem Statuswechsel: Anzahl Arbeitstage nach dem Wechseltag und ob
// das Ergebnis anschließend auf den nächsten Donnerstag gelegt wird.
// "abgeschlossen" fehlt bewusst, ein abgeschlossener Fall hat kein WV-Datum.
const WV_REGEL: Record<OffenerStatus, { arbeitstage: number; aufDonnerstag: boolean }> = {
  neu: { arbeitstage: 10, aufDonnerstag: false },
  in_bearbeitung: { arbeitstage: 5, aufDonnerstag: false },
  aw_eingegangen_mdt: { arbeitstage: 5, aufDonnerstag: false },
  aw_eingegangen_vwt: { arbeitstage: 10, aufDonnerstag: false },
  warte_auf_mdt: { arbeitstage: 10, aufDonnerstag: false },
  warte_auf_verwalter: { arbeitstage: 20, aufDonnerstag: true },
  warte_auf_dritten: { arbeitstage: 10, aufDonnerstag: false },
  erinnerung_1: { arbeitstage: 20, aufDonnerstag: true },
  erinnerung_2: { arbeitstage: 10, aufDonnerstag: true },
  erinnerung_3: { arbeitstage: 10, aufDonnerstag: true },
  erinnerung_4: { arbeitstage: 10, aufDonnerstag: true }, // Entscheidung 15.10.2026, nicht 15
};

/**
 * Neues WV-Datum bei einem echten Statuswechsel (der Status ändert sich tatsächlich).
 * Gilt auch dann, wenn im selben Speichervorgang ein WV-Datum von Hand eingetragen
 * wurde (Konzeption 7). Bei "abgeschlossen" gibt es kein WV-Datum, Ergebnis null.
 */
export function wvDatumNachStatuswechsel(
  neuerStatus: Fallstatus,
  wechseltag: Kalenderdatum,
): Kalenderdatum | null {
  if (neuerStatus === 'abgeschlossen') return null;
  const regel = WV_REGEL[neuerStatus];
  const datum = plusArbeitstage(wechseltag, regel.arbeitstage);
  return regel.aufDonnerstag ? naechsterDonnerstag(datum) : datum;
}

/** Abstand zwischen Anlagetag und erstem WV-Datum eines neuen Falls, in Kalendertagen. */
export const WV_KALENDERTAGE_NEUANLAGE = 14;

/**
 * Anfangswerte eines neu angelegten Falls (neue NKA oder DMR, Konzeption 7 und PRD 12).
 * Das WV-Datum liegt genau 14 Kalendertage nach dem Anlagetag. Anders als beim
 * Statuswechsel zählen hier Kalendertage, und es wird weder auf einen Arbeitstag noch
 * auf einen Donnerstag verschoben, auch wenn das Datum auf ein Wochenende fällt.
 * Die Check-Aufgabe zum Fall bekommt dasselbe WV-Datum, sie berechnet kein eigenes.
 */
export function neuerFall(anlagetag: Kalenderdatum): { status: 'neu'; wvDatum: Kalenderdatum } {
  return { status: 'neu', wvDatum: plusTage(anlagetag, WV_KALENDERTAGE_NEUANLAGE) };
}

export type Ampel = 'gruen' | 'gelb' | 'rot';

// Ampel eines Falls: bis einschließlich "gruenBis" Arbeitstage seit der letzten
// Statusänderung grün, bis einschließlich "gelbBis" gelb, danach rot.
const AMPEL_REGEL: Record<OffenerStatus, { gruenBis: number; gelbBis: number }> = {
  neu: { gruenBis: 5, gelbBis: 10 },
  in_bearbeitung: { gruenBis: 1, gelbBis: 5 },
  aw_eingegangen_mdt: { gruenBis: 1, gelbBis: 5 },
  aw_eingegangen_vwt: { gruenBis: 5, gelbBis: 10 },
  warte_auf_mdt: { gruenBis: 10, gelbBis: 13 },
  warte_auf_verwalter: { gruenBis: 10, gelbBis: 13 },
  warte_auf_dritten: { gruenBis: 10, gelbBis: 13 },
  erinnerung_1: { gruenBis: 20, gelbBis: 23 },
  erinnerung_2: { gruenBis: 10, gelbBis: 13 },
  erinnerung_3: { gruenBis: 10, gelbBis: 13 },
  erinnerung_4: { gruenBis: 10, gelbBis: 13 },
};

/**
 * Ampelfarbe eines Falls. Maßgeblich sind die Arbeitstage seit der letzten
 * Statusänderung (nach dem Änderungstag bis einschließlich heute), nicht der Abstand
 * zum WV-Datum. Ein abgeschlossener Fall ist immer grün.
 */
export function ampelFall(
  status: Fallstatus,
  letzteStatusaenderung: Kalenderdatum,
  heute: Kalenderdatum,
): Ampel {
  if (status === 'abgeschlossen') return 'gruen';
  const regel = AMPEL_REGEL[status];
  const vergangen = arbeitstageZwischen(letzteStatusaenderung, heute);
  if (vergangen <= regel.gruenBis) return 'gruen';
  if (vergangen <= regel.gelbBis) return 'gelb';
  return 'rot';
}
