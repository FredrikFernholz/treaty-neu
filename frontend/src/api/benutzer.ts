import {
  benutzerAngelegtSchema,
  benutzerDetailSchema,
  benutzerSchema,
  type Benutzer,
  type BenutzerAendern,
  type BenutzerAnlegen,
  type BenutzerDetail,
} from '@shared/schemas/benutzer.js';
import { api } from './client';

// Benutzerverwaltung (backend/src/modules/benutzer/routen.ts).

export function listeBenutzer(): Promise<Benutzer[]> {
  return api('GET', '/api/v1/benutzer', { schema: benutzerSchema.array() });
}

export function ladeBenutzer(id: number): Promise<BenutzerDetail> {
  return api('GET', `/api/v1/benutzer/${id}`, { schema: benutzerDetailSchema });
}

export async function kuerzelVorschlag(name: string): Promise<string | null> {
  const antwort = await api<{ vorschlag: string | null }>(
    'GET',
    `/api/v1/benutzer/kuerzel-vorschlag?name=${encodeURIComponent(name)}`,
  );
  return antwort.vorschlag;
}

/** Legt an. Das Einmalpasswort steht nur in dieser Antwort und wird nirgends gespeichert. */
export function legeBenutzerAn(eingabe: BenutzerAnlegen) {
  return api('POST', '/api/v1/benutzer', { body: eingabe, schema: benutzerAngelegtSchema });
}

export function aendereBenutzer(id: number, eingabe: BenutzerAendern): Promise<BenutzerDetail> {
  return api('PUT', `/api/v1/benutzer/${id}`, { body: eingabe, schema: benutzerDetailSchema });
}

export function setzeAktiv(id: number, aktiv: boolean, version: number): Promise<BenutzerDetail> {
  return api('PUT', `/api/v1/benutzer/${id}/aktiv`, { body: { aktiv, version }, schema: benutzerDetailSchema });
}

/** Neues Einmalpasswort. Steht nur in dieser Antwort, alle Sitzungen des Kontos enden. */
export function vergibEinmalpasswort(id: number): Promise<{ einmalpasswort: string }> {
  return api('POST', `/api/v1/benutzer/${id}/einmalpasswort`);
}

export function beendeSitzung(benutzerId: number, sitzungId: number): Promise<void> {
  return api('DELETE', `/api/v1/benutzer/${benutzerId}/sitzungen/${sitzungId}`);
}
