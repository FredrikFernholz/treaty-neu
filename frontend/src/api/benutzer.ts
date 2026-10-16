import { benutzerSchema, type Benutzer } from '@shared/schemas/benutzer.js';
import { api } from './client';

// Benutzerverwaltung (backend/src/modules/benutzer/routen.ts).

export function listeBenutzer(): Promise<Benutzer[]> {
  return api('GET', '/api/v1/benutzer', { schema: benutzerSchema.array() });
}
