import { ichSchema, type Ich } from '@shared/schemas/anmeldung.js';
import { api } from './client';

// Anmelderouten des Backends (backend/src/modules/anmeldung/routen.ts).

export function ladeIch(): Promise<Ich> {
  return api('GET', '/api/v1/ich', { schema: ichSchema });
}

export function anmelden(kuerzel: string, passwort: string): Promise<Ich> {
  return api('POST', '/api/v1/anmeldung', { body: { kuerzel, passwort }, schema: ichSchema });
}

export function abmelden(): Promise<void> {
  return api('POST', '/api/v1/abmeldung');
}

export function passwortAendern(altesPasswort: string, neuesPasswort: string): Promise<Ich> {
  return api('POST', '/api/v1/ich/passwort', { body: { altesPasswort, neuesPasswort }, schema: ichSchema });
}
