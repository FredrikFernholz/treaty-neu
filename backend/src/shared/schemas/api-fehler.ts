import { z } from 'zod';

// Einheitliche Form aller Fehlerantworten der API. "fehler" ist ein fester Code, den
// das Frontend auswerten kann, "meldung" ein deutscher Text für die Anzeige.

export const API_FEHLERCODES = [
  'nicht_angemeldet', // 401: keine oder keine gültige Sitzung
  'kein_zugriff', // 403: Bereich nach der Rechtematrix nicht erlaubt
  'pflicht_header_fehlt', // 403: schreibende Anfrage ohne X-Treaty: 1
  'passwort_wechsel_noetig', // 403: erst ein eigenes Passwort setzen
  'anmeldung_fehlgeschlagen', // 401: Kürzel oder Passwort falsch
  'passwort_falsch', // 403: beim Passwortwechsel stimmt das bisherige Passwort nicht
  'zu_viele_versuche', // 429: Fehlversuchssperre, siehe Header Retry-After
  'ungueltige_eingabe', // 400: Eingabe passt nicht zum Schema
] as const;

export const apiFehlerSchema = z.object({
  fehler: z.enum(API_FEHLERCODES),
  meldung: z.string(),
});

export type ApiFehler = z.infer<typeof apiFehlerSchema>;
