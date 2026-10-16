import { eq, inArray, like, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baueApp } from '../../app.js';
import { benutzer, benutzerZusatzrecht, sicherheitsprotokoll, sitzung } from '../../db/schema.js';
import { db, pool } from '../../db/zugriff.js';
import type { Berechtigung, Zusatzrecht } from '../../shared/rechte/rechtematrix.js';
import { hashePasswort } from '../anmeldung/passwort-hash.js';
import { neueSperren } from '../anmeldung/routen.js';
import { erzeugeSitzung } from '../anmeldung/sitzungen.js';
import { SITZUNGSCOOKIE } from '../anmeldung/zugriffspruefung.js';
import { setzeAktiv } from './verwaltung.js';

// Deaktivieren, Einmalpasswort und Sitzung beenden (Teilschritt 9c) über app.inject()
// gegen die Testdatenbank. Testbenutzer haben eine E-Mail auf @tbx.invalid.

const DOMAIN = '@tbx.invalid';
const PASSWORT = 'Sonnenblume-Kaffeetasse-17';
const MIT_HEADER = { 'x-treaty': '1' };

// Alles, was die App ins Log schreibt, landet hier (Stufe trace, also so ausführlich wie möglich).
const logzeilen: string[] = [];
let app: FastifyInstance;
beforeEach(async () => {
  logzeilen.length = 0;
  app = baueApp({
    sperren: neueSperren(),
    logger: { level: 'trace', stream: { write: (zeile: string) => void logzeilen.push(zeile) } },
  });
  await app.ready();
});
afterEach(async () => {
  await app.close();
  const ids = (await db.select({ id: benutzer.id }).from(benutzer).where(like(benutzer.email, `%${DOMAIN}`))).map((b) => b.id);
  if (ids.length === 0) return;
  await db
    .delete(sicherheitsprotokoll)
    .where(or(inArray(sicherheitsprotokoll.benutzerId, ids), inArray(sicherheitsprotokoll.ausgeloestVonId, ids)));
  await db.delete(benutzer).where(inArray(benutzer.id, ids));
});
afterAll(async () => {
  await pool.end();
});

async function neuerBenutzer(kuerzel: string, optionen: { berechtigung?: Berechtigung; zusatzrechte?: Zusatzrecht[] } = {}) {
  const [angelegt] = await db
    .insert(benutzer)
    .values({
      kuerzel,
      name: `Test ${kuerzel}`,
      email: `${kuerzel.toLowerCase()}${DOMAIN}`,
      passwortHash: await hashePasswort(PASSWORT),
      berechtigung: optionen.berechtigung ?? 'sachbearbeiter',
    })
    .$returningId();
  if (!angelegt) throw new Error('Testbenutzer wurde nicht angelegt');
  for (const recht of optionen.zusatzrechte ?? []) {
    await db.insert(benutzerZusatzrecht).values({ benutzerId: angelegt.id, recht });
  }
  const { token } = await erzeugeSitzung(db, angelegt.id, { ip: '192.0.2.10' }, new Date());
  return { id: angelegt.id, kuerzel, cookies: { [SITZUNGSCOOKIE]: token } };
}

const admin = (k = 'TBXADM') => neuerBenutzer(k, { berechtigung: 'administrator' });
const verwalter = () => neuerBenutzer('TBXNV', { zusatzrechte: ['nutzerverwaltung'] });

async function version(id: number) {
  const [b] = await db.select({ version: benutzer.version }).from(benutzer).where(eq(benutzer.id, id));
  return b!.version;
}

async function aktiv(cookies: Record<string, string>, id: number, wert: boolean) {
  return app.inject({
    method: 'PUT',
    url: `/api/v1/benutzer/${id}/aktiv`,
    headers: MIT_HEADER,
    cookies,
    payload: { aktiv: wert, version: await version(id) },
  });
}

const einmalpasswort = (cookies: Record<string, string>, id: number) =>
  app.inject({ method: 'POST', url: `/api/v1/benutzer/${id}/einmalpasswort`, headers: MIT_HEADER, cookies });

const anmelden = (kuerzel: string, passwort: string, ip = '192.0.2.10') =>
  app.inject({ method: 'POST', url: '/api/v1/anmeldung', headers: MIT_HEADER, payload: { kuerzel, passwort }, remoteAddress: ip });

const sitzungenVon = (id: number) => db.select().from(sitzung).where(eq(sitzung.benutzerId, id));

describe('Deaktivieren und Aktivieren', () => {
  test('deaktivieren beendet alle Sitzungen und verhindert die Anmeldung, aktivieren erlaubt sie wieder', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    await erzeugeSitzung(db, s.id, { ip: '198.51.100.7' }, new Date());

    const aus = await aktiv(a.cookies, s.id, false);
    expect(aus.statusCode).toBe(200);
    expect(aus.json()).toMatchObject({ aktiv: false, sitzungen: [] });
    expect(await sitzungenVon(s.id)).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: '/api/v1/ich', cookies: s.cookies })).statusCode).toBe(401);
    expect((await anmelden(s.kuerzel, PASSWORT)).statusCode).toBe(401);

    const beendet = await db.select().from(sicherheitsprotokoll).where(eq(sicherheitsprotokoll.benutzerId, s.id));
    expect(beendet.filter((e) => e.ereignis === 'sitzung_beendet')).toHaveLength(2);
    expect(beendet.every((e) => e.ereignis !== 'sitzung_beendet' || (e.grund === 'konto_deaktiviert' && e.ausgeloestVonId === a.id))).toBe(true);

    expect((await aktiv(a.cookies, s.id, true)).json()).toMatchObject({ aktiv: true });
    expect((await anmelden(s.kuerzel, PASSWORT)).statusCode).toBe(200);
  });

  test('das eigene Konto kann niemand deaktivieren', async () => {
    const a = await admin();
    await admin('TBXAD2'); // ein weiterer Administrator, damit es nicht um den letzten geht
    const antwort = await aktiv(a.cookies, a.id, false);
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'nicht_erlaubt', meldung: 'Das eigene Konto kann nicht deaktiviert werden.' });
  });

  test('einen anderen Administrator deaktivieren geht, solange einer bleibt', async () => {
    const a = await admin();
    const b = await admin('TBXAD2');
    expect((await aktiv(a.cookies, b.id, false)).statusCode).toBe(200);
  });

  test('der letzte aktive Administrator kann nicht deaktiviert werden (Dienst direkt)', async () => {
    // Über die API nicht erreichbar, weil man sich selbst nicht deaktivieren kann.
    const a = await admin();
    await expect(
      setzeAktiv(db, { benutzerId: -1, berechtigung: 'administrator' }, a.id, { aktiv: false, version: await version(a.id) }, new Date()),
    ).rejects.toMatchObject({ code: 'nicht_erlaubt', message: 'Der letzte aktive Administrator kann nicht deaktiviert werden.' });
  });

  test('veraltete version ergibt 409', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    const antwort = await app.inject({
      method: 'PUT',
      url: `/api/v1/benutzer/${s.id}/aktiv`,
      headers: MIT_HEADER,
      cookies: a.cookies,
      payload: { aktiv: false, version: 99 },
    });
    expect(antwort.statusCode).toBe(409);
  });
});

describe('Einmalpasswort durch die Nutzerverwaltung', () => {
  test('neues Einmalpasswort: no-store, altes Passwort ungültig, Pflichtwechsel, alle Sitzungen beendet', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');

    const antwort = await einmalpasswort(a.cookies, s.id);
    expect(antwort.statusCode).toBe(200);
    expect(antwort.headers['cache-control']).toBe('no-store');
    const { einmalpasswort: neu } = antwort.json() as { einmalpasswort: string };
    expect(neu).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);

    expect(await sitzungenVon(s.id)).toHaveLength(0);
    expect((await anmelden(s.kuerzel, PASSWORT)).statusCode).toBe(401);
    expect((await anmelden(s.kuerzel, neu)).json()).toMatchObject({ passwortWechselNoetig: true });

    const eintraege = await db.select().from(sicherheitsprotokoll).where(eq(sicherheitsprotokoll.benutzerId, s.id));
    expect(eintraege.filter((e) => e.ereignis === 'einmalpasswort_vergeben')).toMatchObject([{ ausgeloestVonId: a.id, grund: 'neu vergeben' }]);
    expect(eintraege.filter((e) => e.ereignis === 'sitzung_beendet')).toMatchObject([{ grund: 'einmalpasswort' }]);
  });

  test('ein gesperrtes Konto kann sich mit dem Einmalpasswort sofort anmelden, von jeder IP', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    for (const ip of ['198.51.100.1', '198.51.100.2']) {
      for (let i = 0; i < 5; i++) await anmelden(s.kuerzel, 'falsch-falsch-falsch', ip);
      expect((await anmelden(s.kuerzel, PASSWORT, ip)).statusCode).toBe(429);
    }
    const { einmalpasswort: neu } = (await einmalpasswort(a.cookies, s.id)).json() as { einmalpasswort: string };
    expect((await anmelden(s.kuerzel, neu, '198.51.100.1')).statusCode).toBe(200);
    expect((await anmelden(s.kuerzel, neu, '198.51.100.2')).statusCode).toBe(200);
  });

  test('eine Sperre der IP bleibt nach dem Einmalpasswort bestehen', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    for (let i = 0; i < 20; i++) await anmelden(`TBXIP${i}`, 'falsch-falsch-falsch', '198.51.100.9');
    expect((await anmelden(s.kuerzel, PASSWORT, '198.51.100.9')).statusCode).toBe(429);
    const { einmalpasswort: neu } = (await einmalpasswort(a.cookies, s.id)).json() as { einmalpasswort: string };
    expect((await anmelden(s.kuerzel, neu, '198.51.100.9')).statusCode).toBe(429);
    expect((await anmelden(s.kuerzel, neu, '198.51.100.10')).statusCode).toBe(200);
  });

  test('für das eigene Konto nicht möglich', async () => {
    const a = await admin();
    const antwort = await einmalpasswort(a.cookies, a.id);
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'nicht_erlaubt' });
  });

  test('auch die Antwort beim Anlegen trägt Cache-Control: no-store', async () => {
    const a = await admin();
    const antwort = await app.inject({
      method: 'POST',
      url: '/api/v1/benutzer',
      headers: MIT_HEADER,
      cookies: a.cookies,
      payload: { kuerzel: 'TBXNEU', name: 'Neu', email: `neu${DOMAIN}`, berechtigung: 'sachbearbeiter' },
    });
    expect(antwort.statusCode).toBe(201);
    expect(antwort.headers['cache-control']).toBe('no-store');
  });

  test('Einmalpasswörter erscheinen nicht in der Log-Ausgabe', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    const angelegt = await app.inject({
      method: 'POST',
      url: '/api/v1/benutzer',
      headers: MIT_HEADER,
      cookies: a.cookies,
      payload: { kuerzel: 'TBXNEU', name: 'Neu', email: `neu${DOMAIN}`, berechtigung: 'sachbearbeiter' },
    });
    const vergeben = await einmalpasswort(a.cookies, s.id);
    const passwoerter = [angelegt.json().einmalpasswort as string, vergeben.json().einmalpasswort as string];

    const log = logzeilen.join('');
    expect(logzeilen.length).toBeGreaterThan(0); // das Log wurde wirklich mitgeschrieben
    expect(log).toContain('/api/v1/benutzer'); // und enthält die Anfragen
    for (const p of passwoerter) {
      expect(p).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);
      expect(log).not.toContain(p);
    }
  });
});

describe('Sitzung beenden', () => {
  test('ein Administrator beendet eine einzelne Sitzung', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    const zweite = await erzeugeSitzung(db, s.id, { ip: '198.51.100.7' }, new Date());
    const [ziel] = (await sitzungenVon(s.id)).filter((x) => x.ip === '198.51.100.7');

    const antwort = await app.inject({ method: 'DELETE', url: `/api/v1/benutzer/${s.id}/sitzungen/${ziel!.id}`, headers: MIT_HEADER, cookies: a.cookies });
    expect(antwort.statusCode).toBe(204);
    expect(await sitzungenVon(s.id)).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/v1/ich', cookies: { [SITZUNGSCOOKIE]: zweite.token } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/ich', cookies: s.cookies })).statusCode).toBe(200);
  });

  test('Sitzung eines anderen Benutzers unter falscher Benutzernummer ergibt 404', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    const andere = await neuerBenutzer('TBXAN');
    const [fremd] = await sitzungenVon(andere.id);
    const antwort = await app.inject({ method: 'DELETE', url: `/api/v1/benutzer/${s.id}/sitzungen/${fremd!.id}`, headers: MIT_HEADER, cookies: a.cookies });
    expect(antwort.statusCode).toBe(404);
    expect(await sitzungenVon(andere.id)).toHaveLength(1);
  });
});

describe('diese Sitzung', () => {
  test('beim eigenen Konto ist genau die Sitzung der Anfrage als aktuell markiert', async () => {
    const a = await admin();
    await erzeugeSitzung(db, a.id, { ip: '198.51.100.7' }, new Date()); // zweite Sitzung, etwa ein anderer Browser
    const antwort = await app.inject({ method: 'GET', url: `/api/v1/benutzer/${a.id}`, cookies: a.cookies });
    const sitzungen = antwort.json().sitzungen as { ip: string; aktuell: boolean }[];
    expect(sitzungen).toHaveLength(2);
    expect(sitzungen.filter((s) => s.aktuell)).toMatchObject([{ ip: '192.0.2.10' }]);
  });

  test('bei einem anderen Konto ist keine Sitzung markiert', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBXSB');
    const antwort = await app.inject({ method: 'GET', url: `/api/v1/benutzer/${s.id}`, cookies: a.cookies });
    expect((antwort.json().sitzungen as { aktuell: boolean }[]).map((x) => x.aktuell)).toEqual([false]);
  });

  test('auch die Antwort nach dem Ändern markiert die eigene Sitzung', async () => {
    const a = await admin();
    const [stand] = await db.select().from(benutzer).where(eq(benutzer.id, a.id));
    const antwort = await app.inject({
      method: 'PUT',
      url: `/api/v1/benutzer/${a.id}`,
      headers: MIT_HEADER,
      cookies: a.cookies,
      payload: {
        version: stand!.version,
        name: 'Neuer Name',
        email: stand!.email,
        berechtigung: 'administrator',
        zeichnung: 'ohne',
        bezeichnung: null,
        zusatzrechte: [],
      },
    });
    expect((antwort.json().sitzungen as { aktuell: boolean }[]).map((x) => x.aktuell)).toEqual([true]);
  });
});

describe('A-19: nur mit dem Zusatzrecht nutzerverwaltung', () => {
  test('kann keinen Administrator deaktivieren', async () => {
    const v = await verwalter();
    const a = await admin();
    const antwort = await aktiv(v.cookies, a.id, false);
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'kein_zugriff' });
  });

  test('kann einen Administrator nicht mit einem Einmalpasswort versehen', async () => {
    const v = await verwalter();
    const a = await admin();
    expect((await einmalpasswort(v.cookies, a.id)).statusCode).toBe(403);
    expect((await anmelden(a.kuerzel, PASSWORT)).statusCode).toBe(200); // Passwort unverändert
  });

  test('kann sich selbst weder deaktivieren noch ein Einmalpasswort geben', async () => {
    const v = await verwalter();
    expect((await aktiv(v.cookies, v.id, false)).statusCode).toBe(403);
    expect((await einmalpasswort(v.cookies, v.id)).statusCode).toBe(403);
  });

  test('kann die Sitzung eines Administrators nicht beenden', async () => {
    const v = await verwalter();
    const a = await admin();
    const [s] = await sitzungenVon(a.id);
    const antwort = await app.inject({ method: 'DELETE', url: `/api/v1/benutzer/${a.id}/sitzungen/${s!.id}`, headers: MIT_HEADER, cookies: v.cookies });
    expect(antwort.statusCode).toBe(403);
    expect(await sitzungenVon(a.id)).toHaveLength(1);
  });

  test('kann eine Sachbearbeiterin deaktivieren und ihr ein Einmalpasswort geben', async () => {
    const v = await verwalter();
    const s = await neuerBenutzer('TBXSB');
    expect((await einmalpasswort(v.cookies, s.id)).statusCode).toBe(200);
    expect((await aktiv(v.cookies, s.id, false)).statusCode).toBe(200);
  });
});
