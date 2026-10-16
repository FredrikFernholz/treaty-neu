import { z } from 'zod';
import { BERECHTIGUNGEN, ZUSATZRECHTE } from '../rechte/rechtematrix.js';
import { PASSWORT_HOECHSTLAENGE, passwortSchema } from './passwort.js';

// Ein- und Ausgaben der Anmelderouten (Teilschritt 7c), gemeinsam für Backend und Frontend.

/** POST /api/v1/anmeldung */
export const anmeldungSchema = z.object({
  // Beim Anmelden wird nur auf sinnvolle Länge geprüft, nicht auf die Passwortregeln.
  // Sonst könnte sich niemand mehr anmelden, dessen Passwort älter als eine Regeländerung ist.
  kuerzel: z.string().trim().min(1).max(50),
  passwort: z.string().min(1).max(PASSWORT_HOECHSTLAENGE * 4), // höchstens 4 Bytes je Zeichen
});

/** POST /api/v1/ich/passwort */
export const passwortAendernSchema = z.object({
  altesPasswort: z.string().min(1).max(PASSWORT_HOECHSTLAENGE * 4),
  neuesPasswort: passwortSchema,
});

/** Antwort von GET /api/v1/ich und nach erfolgreicher Anmeldung. */
export const ichSchema = z.object({
  kuerzel: z.string(),
  name: z.string(),
  berechtigung: z.enum(BERECHTIGUNGEN),
  zusatzrechte: z.array(z.enum(ZUSATZRECHTE)),
  passwortWechselNoetig: z.boolean(),
});

export type Anmeldung = z.infer<typeof anmeldungSchema>;
export type PasswortAendern = z.infer<typeof passwortAendernSchema>;
export type Ich = z.infer<typeof ichSchema>;
