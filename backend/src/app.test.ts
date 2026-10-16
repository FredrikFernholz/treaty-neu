import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { baueApp } from './app.js';
import { pool } from './db/zugriff.js';

// Tests über app.inject(): Fastify verarbeitet die Anfrage wie eine echte, ohne Netzwerk.
// remoteAddress ist die Adresse, von der die Anfrage bei Node ankommt.

const app = baueApp();
// Nur im Test: eine Route, die zeigt, welche IP Fastify der Anfrage zuordnet.
app.get('/test/ip', async (anfrage) => ({ ip: anfrage.ip }));

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('Client-IP hinter Apache (trustProxy nur für 127.0.0.1)', () => {
  // [von, X-Forwarded-For, erwartete IP]
  test.each<[string, string | undefined, string]>([
    ['127.0.0.1', '203.0.113.5', '203.0.113.5'], // über Apache: echte Adresse übernehmen
    ['127.0.0.1', '198.51.100.1, 203.0.113.5', '203.0.113.5'], // Kette: Apache hängt die echte Adresse hinten an, nur ihr wird geglaubt
    ['127.0.0.1', '2001:db8::7', '2001:db8::7'], // IPv6-Adresse des Nutzers
    ['127.0.0.1', undefined, '127.0.0.1'], // ohne Header bleibt es 127.0.0.1
    ['198.51.100.9', '203.0.113.5', '198.51.100.9'], // nicht über Apache: Header wird ignoriert
    ['::1', '203.0.113.5', '::1'], // IPv6-Loopback gilt nicht als vertrauter Proxy
  ])('Anfrage von %s mit X-Forwarded-For %j → %s', async (von, weitergeleitetFuer, erwartet) => {
    const antwort = await app.inject({
      method: 'GET',
      url: '/test/ip',
      remoteAddress: von,
      headers: weitergeleitetFuer ? { 'x-forwarded-for': weitergeleitetFuer } : {},
    });
    expect(antwort.json()).toEqual({ ip: erwartet });
  });
});

describe('GET /api/health', () => {
  test('meldet Prozess und Datenbank als erreichbar', async () => {
    const antwort = await app.inject({ method: 'GET', url: '/api/health' });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual({ status: 'ok', datenbank: 'ok' });
  });
});
