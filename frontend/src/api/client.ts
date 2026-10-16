import { apiFehlerSchema, type ApiFehlercode } from '@shared/schemas/api-fehler.js';

// Zugriff auf die API von Treaty. Alle Anfragen laufen über api(), damit Pflicht-Header,
// Fehlerbehandlung und Prüfung der Antworten an genau einer Stelle stehen.
//
//  - Schreibende Anfragen (POST, PUT, PATCH, DELETE) bekommen X-Treaty: 1. Ohne diesen
//    Header lehnt der Server sie ab (Entscheidung 16.10.2026).
//  - Das Sitzungscookie schickt der Browser selbst mit (same-origin). Es ist HttpOnly,
//    der Code hier sieht es nie.
//  - Antworten werden mit dem gemeinsamen Zod-Schema aus @shared geprüft, wenn eines
//    angegeben ist. So fällt sofort auf, wenn Server und Oberfläche auseinanderlaufen.
//  - Jeder Fehler wird zu einer ApiFehlerAntwort mit Status, Code und deutscher Meldung.

const SCHREIBENDE_METHODEN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Ein Schema, mit dem eine Antwort geprüft wird. Jedes Zod-Schema aus @shared passt
 * darauf. Bewusst ohne Import von zod: Das Frontend führt zod nicht als eigenes Paket
 * (Merkposten „Zod im Frontend“), es nutzt nur die Schemas aus @shared.
 */
export type Antwortschema<T> = {
  safeParse(daten: unknown): { success: true; data: T } | { success: false; error: unknown };
};

/** Codes des Servers und zusätzlich die Fälle, die im Browser selbst entstehen. */
export type Fehlercode = ApiFehlercode | 'netzwerk' | 'serverfehler' | 'antwort_ungueltig';

export class ApiFehlerAntwort extends Error {
  constructor(
    /** HTTP-Status, 0 wenn der Server gar nicht erreichbar war. */
    readonly status: number,
    readonly code: Fehlercode,
    meldung: string,
    /** Bei 429: so viele Sekunden warten (Header Retry-After). */
    readonly wiederholenNachSekunden: number | null = null,
  ) {
    super(meldung);
  }
}

/**
 * Was bei bestimmten Fehlern überall gleich passieren soll, etwa die Weiterleitung zur
 * Anmeldung bei abgelaufener Sitzung. main.ts trägt die Funktionen ein.
 */
export const globaleFehlerbehandlung: {
  nichtAngemeldet?: () => void;
  passwortWechselNoetig?: () => void;
} = {};

const SERVERFEHLER = 'Der Server ist nicht erreichbar oder hat einen Fehler gemeldet. Bitte später erneut versuchen.';

export async function api<T = unknown>(
  methode: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  pfad: string,
  optionen: { body?: unknown; schema?: Antwortschema<T> } = {},
): Promise<T> {
  const kopf: Record<string, string> = { Accept: 'application/json' };
  if (SCHREIBENDE_METHODEN.has(methode)) kopf['X-Treaty'] = '1';
  if (optionen.body !== undefined) kopf['Content-Type'] = 'application/json';

  let antwort: Response;
  try {
    antwort = await fetch(pfad, {
      method: methode,
      headers: kopf,
      body: optionen.body === undefined ? undefined : JSON.stringify(optionen.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiFehlerAntwort(0, 'netzwerk', SERVERFEHLER);
  }

  if (!antwort.ok) throw await alsFehler(antwort);
  if (antwort.status === 204) return undefined as T;

  let daten: unknown;
  try {
    daten = await antwort.json();
  } catch {
    throw new ApiFehlerAntwort(antwort.status, 'antwort_ungueltig', SERVERFEHLER);
  }
  if (!optionen.schema) return daten as T;
  const geprueft = optionen.schema.safeParse(daten);
  if (!geprueft.success) {
    console.error('Antwort passt nicht zum Schema', pfad, geprueft.error);
    throw new ApiFehlerAntwort(antwort.status, 'antwort_ungueltig', SERVERFEHLER);
  }
  return geprueft.data;
}

async function alsFehler(antwort: Response): Promise<ApiFehlerAntwort> {
  let inhalt: unknown = null;
  try {
    inhalt = await antwort.json();
  } catch {
    // kein JSON, etwa eine Fehlerseite von Apache
  }
  const fehler = apiFehlerSchema.safeParse(inhalt);
  if (!fehler.success) return new ApiFehlerAntwort(antwort.status, 'serverfehler', SERVERFEHLER);

  const sekunden = Number(antwort.headers.get('Retry-After'));
  const ergebnis = new ApiFehlerAntwort(
    antwort.status,
    fehler.data.fehler,
    fehler.data.meldung,
    Number.isFinite(sekunden) && sekunden > 0 ? sekunden : null,
  );

  if (ergebnis.code === 'nicht_angemeldet') globaleFehlerbehandlung.nichtAngemeldet?.();
  if (ergebnis.code === 'passwort_wechsel_noetig') globaleFehlerbehandlung.passwortWechselNoetig?.();
  if (ergebnis.code === 'pflicht_header_fehlt') console.error('Programmierfehler: Pflicht-Header fehlt', antwort.url);
  return ergebnis;
}
