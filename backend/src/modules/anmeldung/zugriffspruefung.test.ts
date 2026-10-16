import { eq, inArray, like } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { baueApp } from '../../app.js';
import { benutzer, benutzerZusatzrecht, sicherheitsprotokoll } from '../../db/schema.js';
import { db, pool } from '../../db/zugriff.js';
import type { Berechtigung, Zusatzrecht } from '../../shared/rechte/rechtematrix.js';
import { erzeugeSitzung } from './sitzungen.js';
import { SITZUNGSCOOKIE, setzeSitzungscookie } from './zugriffspruefung.js';

// Prüft die Zugriffsprüfung über app.inject() mit eigenen Testrouten. Testbenutzer
// haben Kürzel mit TZP am Anfang und werden nach jedem Test wieder gelöscht.

const app = baueApp();
const ok = async () => ({ ok: true });
app.get('/api/v1/test/oeffentlich', { config: { zugriff: 'oeffentlich' } }, ok);
app.post('/api/v1/test/oeffentlich', { config: { zugriff: 'oeffentlich' } }, ok);
app.get('/api/v1/test/angemeldet', { config: { zugriff: 'angemeldet' } }, async (anfrage) => ({
  kuerzel: anfrage.angemeldet?.kuerzel,
}));
app.post('/api/v1/test/angemeldet', { config: { zugriff: 'angemeldet' } }, ok);
app.get('/api/v1/test/buchhaltung', { config: { zugriff: 'buchhaltung' } }, ok);
app.get('/api/v1/test/vertraege', { config: { zugriff: 'vertraege' } }, ok);
app.post(
  '/api/v1/test/beim-wechsel-erlaubt',
  { config: { zugriff: 'angemeldet', erlaubtBeiPasswortwechsel: true } },
  ok,
);
app.get('/test/setze-cookie', async (_anfrage, antwort) => {
  setzeSitzungscookie(antwort, 'beispieltoken');
  return { ok: true };
});

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

let nummer = 0;
async function angemeldeteSitzung(
  optionen: { berechtigung?: Berechtigung; zusatzrechte?: Zusatzrecht[]; passwortWechselNoetig?: boolean } = {},
) {
  nummer += 1;
  const kuerzel = `TZP${nummer}`;
  const [angelegt] = await db
    .insert(benutzer)
    .values({
      kuerzel,
      name: `Test ${kuerzel}`,
      email: `${kuerzel.toLowerCase()}@test.invalid`,
      passwortHash: 'kein-echter-hash',
      berechtigung: optionen.berechtigung ?? 'sachbearbeiter',
      passwortWechselNoetig: optionen.passwortWechselNoetig ?? false,
    })
    .$returningId();
  if (!angelegt) throw new Error('Testbenutzer wurde nicht angelegt');
  for (const recht of optionen.zusatzrechte ?? []) {
    await db.insert(benutzerZusatzrecht).values({ benutzerId: angelegt.id, recht });
  }
  const { token } = await erzeugeSitzung(db, angelegt.id, { ip: '127.0.0.1' }, new Date());
  return { kuerzel, cookies: { [SITZUNGSCOOKIE]: token } };
}

afterEach(async () => {
  const ids = (await db.select({ id: benutzer.id }).from(benutzer).where(like(benutzer.kuerzel, 'TZP%'))).map(
    (b) => b.id,
  );
  if (ids.length > 0) {
    await db.delete(sicherheitsprotokoll).where(inArray(sicherheitsprotokoll.benutzerId, ids));
    await db.delete(benutzer).where(inArray(benutzer.id, ids));
  }
});

const MIT_HEADER = { 'x-treaty': '1' };

describe('jede Route unter /api/v1 muss ihren Zugriff erklären', () => {
  test('eine Route ohne config.zugriff lässt den Start scheitern', async () => {
    const andere = baueApp();
    await expect(
      (async () => {
        andere.get('/api/v1/test/vergessen', ok);
        await andere.ready();
      })(),
    ).rejects.toThrow('erklärt keinen Zugriff');
    await andere.close();
  });
});

describe('öffentliche Routen', () => {
  test('GET ohne Anmeldung', async () => {
    const antwort = await app.inject({ method: 'GET', url: '/api/v1/test/oeffentlich' });
    expect(antwort.statusCode).toBe(200);
  });
});

describe('Pflicht-Header X-Treaty bei schreibenden Anfragen', () => {
  test('POST ohne Header ergibt 403, auch angemeldet', async () => {
    const { cookies } = await angemeldeteSitzung();
    const antwort = await app.inject({ method: 'POST', url: '/api/v1/test/angemeldet', cookies });
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'pflicht_header_fehlt' });
  });

  test('POST ohne Header ergibt 403 auch bei öffentlichen Routen (z. B. Anmeldung)', async () => {
    const antwort = await app.inject({ method: 'POST', url: '/api/v1/test/oeffentlich' });
    expect(antwort.statusCode).toBe(403);
  });

  test('POST mit X-Treaty: 1 geht durch', async () => {
    const { cookies } = await angemeldeteSitzung();
    const antwort = await app.inject({ method: 'POST', url: '/api/v1/test/angemeldet', cookies, headers: MIT_HEADER });
    expect(antwort.statusCode).toBe(200);
  });

  test('ein anderer Wert als 1 genügt nicht', async () => {
    const antwort = await app.inject({
      method: 'POST',
      url: '/api/v1/test/oeffentlich',
      headers: { 'x-treaty': 'ja' },
    });
    expect(antwort.statusCode).toBe(403);
  });

  test('GET braucht den Header nicht', async () => {
    const { cookies } = await angemeldeteSitzung();
    const antwort = await app.inject({ method: 'GET', url: '/api/v1/test/angemeldet', cookies });
    expect(antwort.statusCode).toBe(200);
  });
});

describe('Anmeldung nötig', () => {
  test('ohne Cookie 401', async () => {
    const antwort = await app.inject({ method: 'GET', url: '/api/v1/test/angemeldet' });
    expect(antwort.statusCode).toBe(401);
    expect(antwort.json()).toEqual({ fehler: 'nicht_angemeldet', meldung: 'Bitte melden Sie sich an.' });
  });

  test('mit ungültigem Token 401, und das Cookie wird gelöscht', async () => {
    const antwort = await app.inject({
      method: 'GET',
      url: '/api/v1/test/angemeldet',
      cookies: { [SITZUNGSCOOKIE]: 'ungueltig' },
    });
    expect(antwort.statusCode).toBe(401);
    expect(String(antwort.headers['set-cookie'])).toMatch(new RegExp(`^${SITZUNGSCOOKIE}=;`));
  });

  test('mit gültiger Sitzung steht die angemeldete Person an der Anfrage', async () => {
    const { kuerzel, cookies } = await angemeldeteSitzung();
    const antwort = await app.inject({ method: 'GET', url: '/api/v1/test/angemeldet', cookies });
    expect(antwort.json()).toEqual({ kuerzel });
  });
});

describe('Bereiche nach der Rechtematrix', () => {
  test.each<[string, Berechtigung, Zusatzrecht[], string, number]>([
    ['Sachbearbeiter/in ohne Zusatzrecht, Buchhaltung', 'sachbearbeiter', [], '/api/v1/test/buchhaltung', 403],
    ['Sachbearbeiter/in mit Zusatzrecht, Buchhaltung', 'sachbearbeiter', ['buchhaltung'], '/api/v1/test/buchhaltung', 200],
    ['Administrator, Buchhaltung', 'administrator', [], '/api/v1/test/buchhaltung', 200],
    ['Sachbearbeiter/in, Vertragsmanagement', 'sachbearbeiter', [], '/api/v1/test/vertraege', 200],
  ])('%s → %i', async (_name, berechtigung, zusatzrechte, url, status) => {
    const { cookies } = await angemeldeteSitzung({ berechtigung, zusatzrechte });
    const antwort = await app.inject({ method: 'GET', url, cookies });
    expect(antwort.statusCode).toBe(status);
    if (status === 403) expect(antwort.json()).toMatchObject({ fehler: 'kein_zugriff' });
  });
});

describe('Pflichtwechsel des Passworts', () => {
  test('blockiert andere Routen mit 403', async () => {
    const { cookies } = await angemeldeteSitzung({ berechtigung: 'administrator', passwortWechselNoetig: true });
    for (const url of ['/api/v1/test/angemeldet', '/api/v1/test/buchhaltung']) {
      const antwort = await app.inject({ method: 'GET', url, cookies });
      expect(antwort.statusCode).toBe(403);
      expect(antwort.json()).toMatchObject({ fehler: 'passwort_wechsel_noetig' });
    }
  });

  test('lässt dafür freigegebene Routen durch', async () => {
    const { cookies } = await angemeldeteSitzung({ passwortWechselNoetig: true });
    const antwort = await app.inject({
      method: 'POST',
      url: '/api/v1/test/beim-wechsel-erlaubt',
      cookies,
      headers: MIT_HEADER,
    });
    expect(antwort.statusCode).toBe(200);
  });

  test('ohne nötigen Wechsel ist dieselbe Route ebenfalls erreichbar', async () => {
    const { cookies } = await angemeldeteSitzung();
    const antwort = await app.inject({
      method: 'POST',
      url: '/api/v1/test/beim-wechsel-erlaubt',
      cookies,
      headers: MIT_HEADER,
    });
    expect(antwort.statusCode).toBe(200);
  });
});

describe('Sitzungscookie', () => {
  test('__Host-, HttpOnly, Secure, SameSite=Strict, Path=/, ohne Ablaufdatum und ohne Domain', async () => {
    const antwort = await app.inject({ method: 'GET', url: '/test/setze-cookie' });
    const kopf = String(antwort.headers['set-cookie']);
    expect(kopf).toMatch(/^__Host-treaty_sitzung=beispieltoken;/);
    expect(kopf).toContain('HttpOnly');
    expect(kopf).toContain('Secure');
    expect(kopf).toContain('SameSite=Strict');
    expect(kopf).toContain('Path=/');
    expect(kopf).not.toMatch(/Expires|Max-Age|Domain/i);
  });
});

describe('deaktiviertes Konto', () => {
  test('ein deaktiviertes Konto wird wie eine fehlende Sitzung behandelt', async () => {
    const { kuerzel, cookies } = await angemeldeteSitzung();
    await db.update(benutzer).set({ aktiv: false }).where(eq(benutzer.kuerzel, kuerzel));
    const antwort = await app.inject({ method: 'GET', url: '/api/v1/test/angemeldet', cookies });
    expect(antwort.statusCode).toBe(401);
  });
});
