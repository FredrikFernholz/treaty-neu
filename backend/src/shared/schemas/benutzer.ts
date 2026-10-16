import { z } from 'zod';

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
