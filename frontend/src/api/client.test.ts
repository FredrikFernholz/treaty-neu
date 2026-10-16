import { healthSchema } from '@shared/schemas/health.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiFehlerAntwort, api, globaleFehlerbehandlung } from './client';

// fetch wird im Test durch eine Attrappe ersetzt, die festgelegte Antworten liefert.

function antwortMit(status: number, inhalt: unknown, kopf: Record<string, string> = {}) {
  return new Response(inhalt === undefined ? null : JSON.stringify(inhalt), {
    status,
    headers: { 'Content-Type': 'application/json', ...kopf },
  });
}

const fetchAttrappe = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchAttrappe.mockReset();
  vi.stubGlobal('fetch', fetchAttrappe);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  globaleFehlerbehandlung.nichtAngemeldet = vi.fn();
  globaleFehlerbehandlung.passwortWechselNoetig = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function gesendeteKopfzeilen(): Record<string, string> {
  return fetchAttrappe.mock.calls[0]![1]!.headers as Record<string, string>;
}

describe('Pflicht-Header', () => {
  test.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('%s bekommt X-Treaty: 1', async (methode) => {
    fetchAttrappe.mockResolvedValue(new Response(null, { status: 204 }));
    await api(methode, '/api/v1/test');
    expect(gesendeteKopfzeilen()['X-Treaty']).toBe('1');
  });

  test('GET bekommt keinen', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(200, {}));
    await api('GET', '/api/v1/test');
    expect(gesendeteKopfzeilen()['X-Treaty']).toBeUndefined();
  });

  test('mit Inhalt als JSON und same-origin', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(200, {}));
    await api('POST', '/api/v1/test', { body: { a: 1 } });
    const [, init] = fetchAttrappe.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST', body: '{"a":1}', credentials: 'same-origin' });
    expect(gesendeteKopfzeilen()['Content-Type']).toBe('application/json');
  });
});

describe('Antworten', () => {
  test('wird mit dem Schema geprüft', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(200, { status: 'ok', datenbank: 'ok' }));
    expect(await api('GET', '/api/health', { schema: healthSchema })).toEqual({ status: 'ok', datenbank: 'ok' });
  });

  test('passt sie nicht zum Schema, gibt es einen Fehler statt falscher Daten', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(200, { status: 'vielleicht' }));
    await expect(api('GET', '/api/health', { schema: healthSchema })).rejects.toMatchObject({ code: 'antwort_ungueltig' });
  });

  test('204 ergibt undefined', async () => {
    fetchAttrappe.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api('POST', '/api/v1/abmeldung')).toBeUndefined();
  });
});

describe('Fehler', () => {
  test('Fehlerantwort des Servers wird zu ApiFehlerAntwort mit Code und Meldung', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(409, { fehler: 'konflikt', meldung: 'Inzwischen geändert.' }));
    const fehler = await api('PUT', '/api/v1/benutzer/1').catch((f: unknown) => f);
    expect(fehler).toBeInstanceOf(ApiFehlerAntwort);
    expect(fehler).toMatchObject({ status: 409, code: 'konflikt', message: 'Inzwischen geändert.' });
  });

  test('429 liefert die Wartezeit aus Retry-After', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(429, { fehler: 'zu_viele_versuche', meldung: 'Zu viele.' }, { 'Retry-After': '27' }));
    await expect(api('POST', '/api/v1/anmeldung')).rejects.toMatchObject({ status: 429, wiederholenNachSekunden: 27 });
  });

  test('401 nicht_angemeldet ruft die globale Behandlung auf', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(401, { fehler: 'nicht_angemeldet', meldung: 'Bitte melden Sie sich an.' }));
    await expect(api('GET', '/api/v1/ich')).rejects.toMatchObject({ code: 'nicht_angemeldet' });
    expect(globaleFehlerbehandlung.nichtAngemeldet).toHaveBeenCalledOnce();
  });

  test('401 anmeldung_fehlgeschlagen ruft sie nicht auf', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(401, { fehler: 'anmeldung_fehlgeschlagen', meldung: 'Falsch.' }));
    await expect(api('POST', '/api/v1/anmeldung')).rejects.toMatchObject({ code: 'anmeldung_fehlgeschlagen' });
    expect(globaleFehlerbehandlung.nichtAngemeldet).not.toHaveBeenCalled();
  });

  test('403 passwort_wechsel_noetig ruft die globale Behandlung auf', async () => {
    fetchAttrappe.mockResolvedValue(antwortMit(403, { fehler: 'passwort_wechsel_noetig', meldung: 'Erst wechseln.' }));
    await expect(api('GET', '/api/v1/benutzer')).rejects.toMatchObject({ code: 'passwort_wechsel_noetig' });
    expect(globaleFehlerbehandlung.passwortWechselNoetig).toHaveBeenCalledOnce();
  });

  test('Fehler ohne JSON (etwa eine Fehlerseite) wird zu serverfehler', async () => {
    fetchAttrappe.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    await expect(api('GET', '/api/v1/ich')).rejects.toMatchObject({ status: 502, code: 'serverfehler' });
  });

  test('Server nicht erreichbar wird zu netzwerk mit Status 0', async () => {
    fetchAttrappe.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('GET', '/api/v1/ich')).rejects.toMatchObject({ status: 0, code: 'netzwerk' });
  });
});
