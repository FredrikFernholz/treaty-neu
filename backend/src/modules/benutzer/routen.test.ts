import { inArray, like } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baueApp } from '../../app.js';
import { benutzer, benutzerZusatzrecht, sicherheitsprotokoll } from '../../db/schema.js';
import { db, pool } from '../../db/zugriff.js';
import type { Berechtigung, Zusatzrecht } from '../../shared/rechte/rechtematrix.js';
import { benutzerDetailSchema, benutzerSchema, benutzerAuswahlSchema } from '../../shared/schemas/benutzer.js';
import { neueSperren } from '../anmeldung/routen.js';
import { erzeugeSitzung } from '../anmeldung/sitzungen.js';
import { SITZUNGSCOOKIE } from '../anmeldung/zugriffspruefung.js';

// Lesende Routen der Benutzerverwaltung (Teilschritt 9a) über app.inject() gegen die
// Testdatenbank. Testbenutzer beginnen mit TBV und werden nach jedem Test gelöscht.

let app: FastifyInstance;
beforeEach(async () => {
  app = baueApp({ sperren: neueSperren() });
  await app.ready();
});
afterEach(async () => {
  await app.close();
  const ids = (await db.select({ id: benutzer.id }).from(benutzer).where(like(benutzer.kuerzel, 'TBV%'))).map((b) => b.id);
  if (ids.length === 0) return;
  await db.delete(sicherheitsprotokoll).where(inArray(sicherheitsprotokoll.benutzerId, ids));
  await db.delete(benutzer).where(inArray(benutzer.id, ids));
});
afterAll(async () => {
  await pool.end();
});

async function neuerBenutzer(
  kuerzel: string,
  optionen: { berechtigung?: Berechtigung; zusatzrechte?: Zusatzrecht[]; aktiv?: boolean; name?: string } = {},
) {
  const [angelegt] = await db
    .insert(benutzer)
    .values({
      kuerzel,
      name: optionen.name ?? `Test ${kuerzel}`,
      email: `${kuerzel.toLowerCase()}@test.invalid`,
      passwortHash: 'GEHEIMER-HASH-DARF-NIE-RAUS',
      totpSecret: 'GEHEIMES-TOTP-DARF-NIE-RAUS',
      berechtigung: optionen.berechtigung ?? 'sachbearbeiter',
      aktiv: optionen.aktiv ?? true,
    })
    .$returningId();
  if (!angelegt) throw new Error('Testbenutzer wurde nicht angelegt');
  for (const recht of optionen.zusatzrechte ?? []) {
    await db.insert(benutzerZusatzrecht).values({ benutzerId: angelegt.id, recht });
  }
  return angelegt.id;
}

async function cookieFuer(benutzerId: number) {
  const { token } = await erzeugeSitzung(db, benutzerId, { ip: '192.0.2.10', userAgent: 'Testbrowser/1.0' }, new Date());
  return { [SITZUNGSCOOKIE]: token };
}

const nurTestbenutzer = <T extends { kuerzel: string }>(liste: T[]) => liste.filter((b) => b.kuerzel.startsWith('TBV'));

describe('Zugriff', () => {
  test.each<[string, Berechtigung, Zusatzrecht[], number]>([
    ['Sachbearbeiter/in ohne Zusatzrecht', 'sachbearbeiter', [], 403],
    ['Sachbearbeiter/in mit Zusatzrecht nutzerverwaltung', 'sachbearbeiter', ['nutzerverwaltung'], 200],
    ['Administrator', 'administrator', [], 200],
  ])('GET /api/v1/benutzer als %s → %i', async (_name, berechtigung, zusatzrechte, status) => {
    const cookies = await cookieFuer(await neuerBenutzer('TBVA', { berechtigung, zusatzrechte }));
    expect((await app.inject({ method: 'GET', url: '/api/v1/benutzer', cookies })).statusCode).toBe(status);
    const id = await neuerBenutzer('TBVZ');
    expect((await app.inject({ method: 'GET', url: `/api/v1/benutzer/${id}`, cookies })).statusCode).toBe(status);
  });

  test('ohne Anmeldung 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/benutzer' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/benutzer/auswahl' })).statusCode).toBe(401);
  });
});

describe('GET /api/v1/benutzer', () => {
  test('liefert alle Benutzer mit Zusatzrechten, Deaktivierte am Ende', async () => {
    const admin = await neuerBenutzer('TBVA', { berechtigung: 'administrator', name: 'Zora Admin' });
    await neuerBenutzer('TBVB', { name: 'Anton Aktiv', zusatzrechte: ['kunden', 'buchhaltung'] });
    await neuerBenutzer('TBVC', { name: 'Aaron Aus', aktiv: false });

    const antwort = await app.inject({ method: 'GET', url: '/api/v1/benutzer', cookies: await cookieFuer(admin) });
    const liste = nurTestbenutzer(benutzerSchema.array().parse(antwort.json()));
    // Aaron stünde nach dem Namen vorn, ist aber deaktiviert und deshalb am Ende.
    expect(liste.map((b) => b.kuerzel)).toEqual(['TBVB', 'TBVA', 'TBVC']);
    expect(liste[0]).toMatchObject({ zusatzrechte: ['buchhaltung', 'kunden'], aktiv: true, version: 1 });
  });

  test('enthält weder Passwort-Hash noch TOTP-Geheimnis', async () => {
    const admin = await neuerBenutzer('TBVA', { berechtigung: 'administrator' });
    const antwort = await app.inject({ method: 'GET', url: '/api/v1/benutzer', cookies: await cookieFuer(admin) });
    expect(antwort.body).not.toMatch(/GEHEIM|passwort_?hash|totp/i);
  });
});

describe('GET /api/v1/benutzer/:id', () => {
  test('liefert den Benutzer mit laufenden Sitzungen, ohne Token', async () => {
    const admin = await neuerBenutzer('TBVA', { berechtigung: 'administrator' });
    const id = await neuerBenutzer('TBVB', { zusatzrechte: ['auswertungen'] });
    const { token } = await erzeugeSitzung(db, id, { ip: '198.51.100.7', userAgent: 'Anderer/2.0' }, new Date());

    const antwort = await app.inject({ method: 'GET', url: `/api/v1/benutzer/${id}`, cookies: await cookieFuer(admin) });
    expect(antwort.statusCode).toBe(200);
    const detail = benutzerDetailSchema.parse(antwort.json());
    expect(detail).toMatchObject({ kuerzel: 'TBVB', zusatzrechte: ['auswertungen'] });
    expect(detail.sitzungen).toMatchObject([{ ip: '198.51.100.7', userAgent: 'Anderer/2.0' }]);
    expect(antwort.body).not.toContain(token);
    expect(antwort.body).not.toMatch(/GEHEIM|token|hash|totp/i);
  });

  test.each([
    ['999999999', 404, 'nicht_gefunden'],
    ['abc', 400, 'ungueltige_eingabe'],
    ['0', 400, 'ungueltige_eingabe'],
  ])('id %s → %i', async (id, status, code) => {
    const admin = await neuerBenutzer('TBVA', { berechtigung: 'administrator' });
    const antwort = await app.inject({ method: 'GET', url: `/api/v1/benutzer/${id}`, cookies: await cookieFuer(admin) });
    expect(antwort.statusCode).toBe(status);
    expect(antwort.json()).toMatchObject({ fehler: code });
  });
});

describe('GET /api/v1/benutzer/auswahl', () => {
  test('für alle Angemeldeten, nur aktive Benutzer, nur id, Kürzel und Name', async () => {
    const sachbearbeiter = await neuerBenutzer('TBVS');
    await neuerBenutzer('TBVB');
    await neuerBenutzer('TBVC', { aktiv: false });

    const antwort = await app.inject({
      method: 'GET',
      url: '/api/v1/benutzer/auswahl',
      cookies: await cookieFuer(sachbearbeiter),
    });
    expect(antwort.statusCode).toBe(200);
    const liste = nurTestbenutzer(benutzerAuswahlSchema.strict().array().parse(antwort.json()));
    expect(liste.map((b) => b.kuerzel)).toEqual(['TBVB', 'TBVS']);
    expect(antwort.body).not.toMatch(/email|berechtigung|GEHEIM/i);
  });
});
