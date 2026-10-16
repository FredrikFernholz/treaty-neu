import { z } from 'zod';
import { BERECHTIGUNGEN, ZUSATZRECHTE } from '../rechte/rechtematrix.js';

// Angaben zu einem Benutzer, gemeinsam für Backend und Frontend (Konzeption 6.2).

// Kürzel wie "DW" oder "AB2". 2 bis 10 Zeichen, nur Großbuchstaben und Ziffern. Die
// Eingabe wird ohne Leerzeichen am Rand und in Großbuchstaben übernommen, aus "dw" wird
// also "DW". Das Kürzel ist das Anmeldemerkmal und nach der Anlage nicht mehr änderbar
// (Entscheidung 15.10.2026, Format Entscheidung 16.10.2026).
//
// "ADH" ist gesperrt. Es ist der reservierte Sammelwert für die Zuweisung an das Team
// (etwa "ADH (nicht zugewiesen)" bei Aufgaben) und darf keiner einzelnen Person gehören.
export const RESERVIERTE_KUERZEL = ['ADH'] as const;

export const kuerzelSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,10}$/, 'Das Kürzel muss aus 2 bis 10 Buchstaben oder Ziffern bestehen.')
  .refine((k) => !(RESERVIERTE_KUERZEL as readonly string[]).includes(k), {
    message: 'Das Kürzel ADH ist für die Zuweisung an das Team reserviert.',
  });

export const benutzernameSchema = z
  .string()
  .trim()
  .min(1, 'Bitte einen Namen angeben.')
  .max(100, 'Der Name darf höchstens 100 Zeichen lang sein.');

// Die E-Mail-Adresse ist Pflicht und eindeutig (Entscheidung 15.10.2026). Gespeichert
// wird sie klein geschrieben, damit "A@x.de" und "a@x.de" nicht als zwei Adressen gelten.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, 'Die E-Mail-Adresse darf höchstens 255 Zeichen lang sein.')
  .pipe(z.email('Bitte eine gültige E-Mail-Adresse angeben.'));

// Antworten der Benutzerverwaltung (Teilschritt 9). Passwort-Hash und TOTP-Geheimnis
// kommen in keiner Antwort vor.

export const ZEICHNUNGEN = ['ppa', 'iv', 'ia', 'ohne'] as const;

/** Ein Eintrag in GET /api/v1/benutzer (nur Nutzerverwaltung). */
export const benutzerSchema = z.object({
  id: z.number().int(),
  kuerzel: z.string(),
  name: z.string(),
  email: z.string(),
  berechtigung: z.enum(BERECHTIGUNGEN),
  zeichnung: z.enum(ZEICHNUNGEN),
  bezeichnung: z.string().nullable(),
  aktiv: z.boolean(),
  passwortWechselNoetig: z.boolean(),
  zusatzrechte: z.array(z.enum(ZUSATZRECHTE)),
  version: z.number().int(),
});

/** Eine laufende Sitzung in GET /api/v1/benutzer/:id. Ohne Token und ohne Token-Hash. */
export const sitzungsinfoSchema = z.object({
  id: z.number().int(),
  erstelltAm: z.string(), // ISO-Zeitpunkt in UTC
  letzteAktivitaetAm: z.string(),
  laeuftAbAm: z.string(),
  ip: z.string(),
  userAgent: z.string().nullable(),
});

/** Antwort von GET /api/v1/benutzer/:id */
export const benutzerDetailSchema = benutzerSchema.extend({ sitzungen: z.array(sitzungsinfoSchema) });

/** Ein Eintrag in GET /api/v1/benutzer/auswahl (für alle Angemeldeten). */
export const benutzerAuswahlSchema = z.object({ id: z.number().int(), kuerzel: z.string(), name: z.string() });

export type Benutzer = z.infer<typeof benutzerSchema>;
export type Sitzungsinfo = z.infer<typeof sitzungsinfoSchema>;
export type BenutzerDetail = z.infer<typeof benutzerDetailSchema>;
export type BenutzerAuswahl = z.infer<typeof benutzerAuswahlSchema>;

// Eingaben der Benutzerverwaltung (Teilschritt 9b).

// Bezeichnung bzw. Abteilung für den Signaturblock. Ein leerer Text bedeutet "keine".
const bezeichnungSchema = z
  .string()
  .trim()
  .max(100, 'Die Bezeichnung darf höchstens 100 Zeichen lang sein.')
  .nullable()
  .default(null)
  .transform((b) => (b === '' ? null : b));

const zusatzrechteSchema = z
  .array(z.enum(ZUSATZRECHTE))
  .default([])
  .refine((r) => new Set(r).size === r.length, 'Jedes Zusatzrecht darf nur einmal vorkommen.');

/** POST /api/v1/benutzer */
export const benutzerAnlegenSchema = z.object({
  kuerzel: kuerzelSchema,
  name: benutzernameSchema,
  email: emailSchema,
  berechtigung: z.enum(BERECHTIGUNGEN),
  zeichnung: z.enum(ZEICHNUNGEN).default('ohne'),
  bezeichnung: bezeichnungSchema,
  zusatzrechte: zusatzrechteSchema,
});

/** PUT /api/v1/benutzer/:id. Das Kürzel fehlt bewusst, es ist nach dem Anlegen unveränderlich. */
export const benutzerAendernSchema = z.object({
  version: z.number().int().positive(),
  name: benutzernameSchema,
  email: emailSchema,
  berechtigung: z.enum(BERECHTIGUNGEN),
  zeichnung: z.enum(ZEICHNUNGEN),
  bezeichnung: bezeichnungSchema,
  zusatzrechte: zusatzrechteSchema,
});

/** Antwort von POST /api/v1/benutzer. Das Einmalpasswort steht nur in dieser einen Antwort. */
export const benutzerAngelegtSchema = z.object({ benutzer: benutzerDetailSchema, einmalpasswort: z.string() });

export type BenutzerAnlegen = z.input<typeof benutzerAnlegenSchema>;
export type BenutzerAendern = z.input<typeof benutzerAendernSchema>;
