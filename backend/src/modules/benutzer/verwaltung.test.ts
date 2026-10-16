import { eq, inArray, like, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baueApp } from '../../app.js';
import { benutzer, benutzerZusatzrecht, sicherheitsprotokoll } from '../../db/schema.js';
import { db, pool } from '../../db/zugriff.js';
import type { Berechtigung, Zusatzrecht } from '../../shared/rechte/rechtematrix.js';
import { benutzerAngelegtSchema, benutzerDetailSchema } from '../../shared/schemas/benutzer.js';
import { neueSperren } from '../anmeldung/routen.js';
import { erzeugeSitzung } from '../anmeldung/sitzungen.js';
import { SITZUNGSCOOKIE } from '../anmeldung/zugriffspruefung.js';
import { aendereBenutzer } from './verwaltung.js';

// Anlegen und Ändern (Teilschritt 9b) über app.inject() gegen die Testdatenbank.
// Alle Testbenutzer haben eine E-Mail-Adresse auf @tbw.invalid und werden nach jedem
// Test samt Protokoll wieder gelöscht.

const DOMAIN = '@tbw.invalid';
const MIT_HEADER = { 'x-treaty': '1' };

let app: FastifyInstance;
beforeEach(async () => {
  app = baueApp({ sperren: neueSperren() });
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

async function neuerBenutzer(
  kuerzel: string,
  optionen: { berechtigung?: Berechtigung; zusatzrechte?: Zusatzrecht[]; aktiv?: boolean } = {},
) {
  const [angelegt] = await db
    .insert(benutzer)
    .values({
      kuerzel,
      name: `Test ${kuerzel}`,
      email: `${kuerzel.toLowerCase()}${DOMAIN}`,
      passwortHash: 'kein-echter-hash',
      berechtigung: optionen.berechtigung ?? 'sachbearbeiter',
      aktiv: optionen.aktiv ?? true,
    })
    .$returningId();
  if (!angelegt) throw new Error('Testbenutzer wurde nicht angelegt');
  for (const recht of optionen.zusatzrechte ?? []) {
    await db.insert(benutzerZusatzrecht).values({ benutzerId: angelegt.id, recht });
  }
  const { token } = await erzeugeSitzung(db, angelegt.id, { ip: '192.0.2.10' }, new Date());
  return { id: angelegt.id, cookies: { [SITZUNGSCOOKIE]: token } };
}

const admin = () => neuerBenutzer('TBWADM', { berechtigung: 'administrator' });
const verwalter = () => neuerBenutzer('TBWNV', { zusatzrechte: ['nutzerverwaltung'] });

function anlegen(cookies: Record<string, string>, eingabe: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/v1/benutzer', headers: MIT_HEADER, cookies, payload: eingabe });
}

async function laden(id: number, cookies: Record<string, string>) {
  const antwort = await app.inject({ method: 'GET', url: `/api/v1/benutzer/${id}`, cookies });
  return benutzerDetailSchema.parse(antwort.json());
}

/** Ändern auf Grundlage des aktuellen Stands, mit den angegebenen Abweichungen. */
async function aendern(cookies: Record<string, string>, id: number, abweichungen: Record<string, unknown>, mitCookies = cookies) {
  const { name, email, berechtigung, zeichnung, bezeichnung, zusatzrechte, version } = await laden(id, await adminCookies());
  return app.inject({
    method: 'PUT',
    url: `/api/v1/benutzer/${id}`,
    headers: MIT_HEADER,
    cookies: mitCookies,
    payload: { name, email, berechtigung, zeichnung, bezeichnung, zusatzrechte, version, ...abweichungen },
  });
}

// Ein Hilfs-Administrator nur zum Lesen des aktuellen Stands in aendern()
let leseAdmin: Record<string, string> | undefined;
async function adminCookies() {
  leseAdmin ??= (await neuerBenutzer('TBWLESE', { berechtigung: 'administrator' })).cookies;
  return leseAdmin;
}
afterEach(() => {
  leseAdmin = undefined;
});

const NEU = { kuerzel: 'tbwan', name: 'Anna Neu', email: `Anna.Neu${DOMAIN}`, berechtigung: 'sachbearbeiter' };

describe('GET /api/v1/benutzer/kuerzel-vorschlag', () => {
  test('schlägt aus dem Namen vor und überspringt vergebene Kürzel', async () => {
    const { cookies } = await admin();
    const vorschlag = async (name: string) =>
      (await app.inject({ method: 'GET', url: `/api/v1/benutzer/kuerzel-vorschlag?name=${encodeURIComponent(name)}`, cookies })).json();

    expect(await vorschlag('Quentin Xaverius')).toEqual({ vorschlag: 'QX' });
    await neuerBenutzer('QX');
    expect(await vorschlag('Quentin Xaverius')).toEqual({ vorschlag: 'QXA' });
  });

  test('ergibt nie ADH', async () => {
    const { cookies } = await admin();
    await neuerBenutzer('AD');
    const antwort = await app.inject({ method: 'GET', url: '/api/v1/benutzer/kuerzel-vorschlag?name=Anna%20Dhaliwal', cookies });
    expect(antwort.json()).toEqual({ vorschlag: 'AD2' });
  });
});

describe('POST /api/v1/benutzer (als Administrator)', () => {
  test('legt mit Einmalpasswort und Pflichtwechsel an', async () => {
    const a = await admin();
    const antwort = await anlegen(a.cookies, { ...NEU, zusatzrechte: ['kunden'], zeichnung: 'iv', bezeichnung: 'Buchhaltung' });

    expect(antwort.statusCode).toBe(201);
    const { benutzer: angelegt, einmalpasswort } = benutzerAngelegtSchema.parse(antwort.json());
    expect(angelegt).toMatchObject({
      kuerzel: 'TBWAN',
      email: `anna.neu${DOMAIN}`,
      zusatzrechte: ['kunden'],
      zeichnung: 'iv',
      bezeichnung: 'Buchhaltung',
      passwortWechselNoetig: true,
      version: 1,
    });

    const anmeldung = await app.inject({
      method: 'POST',
      url: '/api/v1/anmeldung',
      headers: MIT_HEADER,
      payload: { kuerzel: 'TBWAN', passwort: einmalpasswort },
    });
    expect(anmeldung.json()).toMatchObject({ passwortWechselNoetig: true });

    const eintraege = await db.select().from(sicherheitsprotokoll).where(eq(sicherheitsprotokoll.benutzerId, angelegt.id));
    expect(eintraege.filter((e) => e.ereignis === 'einmalpasswort_vergeben')).toMatchObject([
      { ausgeloestVonId: a.id, grund: 'neu angelegt' },
    ]);
  });

  test.each([
    ['doppeltes Kürzel', { email: `anders${DOMAIN}` }, 409, 'bereits_vergeben', 'Das Kürzel TBWAN ist bereits vergeben.'],
    ['doppelte E-Mail, andere Schreibweise', { kuerzel: 'TBWAX', email: `ANNA.neu${DOMAIN}` }, 409, 'bereits_vergeben', 'E-Mail-Adresse'],
    ['Kürzel ADH', { kuerzel: 'adh', email: `adh${DOMAIN}` }, 400, 'ungueltige_eingabe', 'reserviert'],
    ['Administrator mit Zusatzrecht', { kuerzel: 'TBWAY', email: `ay${DOMAIN}`, berechtigung: 'administrator', zusatzrechte: ['kunden'] }, 400, 'ungueltige_eingabe', 'keine Zusatzrechte'],
    ['Zusatzrecht doppelt', { kuerzel: 'TBWAZ', email: `az${DOMAIN}`, zusatzrechte: ['kunden', 'kunden'] }, 400, 'ungueltige_eingabe', 'nur einmal'],
  ])('%s → %i', async (_name, abweichung, status, code, meldung) => {
    const a = await admin();
    expect((await anlegen(a.cookies, NEU)).statusCode).toBe(201);
    const antwort = await anlegen(a.cookies, { ...NEU, ...abweichung });
    expect(antwort.statusCode).toBe(status);
    expect(antwort.json()).toMatchObject({ fehler: code });
    expect(antwort.json().meldung).toContain(meldung);
  });
});

describe('A-19: nur mit dem Zusatzrecht nutzerverwaltung', () => {
  test('kann eine Sachbearbeiterin ohne Zusatzrechte anlegen', async () => {
    const v = await verwalter();
    expect((await anlegen(v.cookies, NEU)).statusCode).toBe(201);
  });

  test('kann niemanden als Administrator anlegen', async () => {
    const v = await verwalter();
    const antwort = await anlegen(v.cookies, { ...NEU, berechtigung: 'administrator' });
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'kein_zugriff' });
  });

  test('kann beim Anlegen kein Zusatzrecht vergeben', async () => {
    const v = await verwalter();
    expect((await anlegen(v.cookies, { ...NEU, zusatzrechte: ['kunden'] })).statusCode).toBe(403);
  });

  test('kann sich selbst kein Zusatzrecht geben', async () => {
    const v = await verwalter();
    const antwort = await aendern(v.cookies, v.id, { zusatzrechte: ['nutzerverwaltung', 'buchhaltung'] });
    expect(antwort.statusCode).toBe(403);
    expect((await laden(v.id, await adminCookies())).zusatzrechte).toEqual(['nutzerverwaltung']);
  });

  test('kann auch die eigenen Stammdaten nicht ändern', async () => {
    const v = await verwalter();
    expect((await aendern(v.cookies, v.id, { name: 'Neuer Name' })).statusCode).toBe(403);
  });

  test('kann niemanden zum Administrator machen', async () => {
    const v = await verwalter();
    const s = await neuerBenutzer('TBWSB');
    const antwort = await aendern(v.cookies, s.id, { berechtigung: 'administrator' });
    expect(antwort.statusCode).toBe(403);
    expect((await laden(s.id, await adminCookies())).berechtigung).toBe('sachbearbeiter');
  });

  test('kann anderen kein Zusatzrecht geben oder entziehen', async () => {
    const v = await verwalter();
    const s = await neuerBenutzer('TBWSB', { zusatzrechte: ['kunden'] });
    expect((await aendern(v.cookies, s.id, { zusatzrechte: ['kunden', 'auswertungen'] })).statusCode).toBe(403);
    expect((await aendern(v.cookies, s.id, { zusatzrechte: [] })).statusCode).toBe(403);
  });

  test('kann keinen Administrator bearbeiten', async () => {
    const v = await verwalter();
    const a = await admin();
    const antwort = await aendern(v.cookies, a.id, { name: 'Umbenannt' });
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'kein_zugriff' });
  });

  test('kann die Stammdaten einer Sachbearbeiterin ändern, Zusatzrechte bleiben', async () => {
    const v = await verwalter();
    const s = await neuerBenutzer('TBWSB', { zusatzrechte: ['kunden'] });
    const antwort = await aendern(v.cookies, s.id, { name: 'Neuer Name', zeichnung: 'ia' });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toMatchObject({ name: 'Neuer Name', zeichnung: 'ia', zusatzrechte: ['kunden'], version: 2 });
  });

  test('ohne Zusatzrecht nutzerverwaltung kein Zugang', async () => {
    const s = await neuerBenutzer('TBWSB');
    expect((await anlegen(s.cookies, NEU)).statusCode).toBe(403);
  });
});

describe('PUT /api/v1/benutzer/:id (als Administrator)', () => {
  test('Sachbearbeiterin zur Administratorin machen, Zusatzrechte entfallen', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBWSB', { zusatzrechte: ['kunden'] });
    const antwort = await aendern(a.cookies, s.id, { berechtigung: 'administrator', zusatzrechte: [] });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toMatchObject({ berechtigung: 'administrator', zusatzrechte: [] });
  });

  test('Zusatzrechte vergeben und entziehen', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBWSB', { zusatzrechte: ['kunden'] });
    expect((await aendern(a.cookies, s.id, { zusatzrechte: ['auswertungen', 'buchhaltung'] })).json()).toMatchObject({
      zusatzrechte: ['buchhaltung', 'auswertungen'], // Reihenfolge der Rechtematrix
    });
    expect((await aendern(a.cookies, s.id, { zusatzrechte: [] })).json()).toMatchObject({ zusatzrechte: [] });
  });

  test('die neuen Rechte wirken sofort in der laufenden Sitzung', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBWSB');
    expect((await app.inject({ method: 'GET', url: '/api/v1/benutzer', cookies: s.cookies })).statusCode).toBe(403);
    await aendern(a.cookies, s.id, { zusatzrechte: ['nutzerverwaltung'] });
    expect((await app.inject({ method: 'GET', url: '/api/v1/benutzer', cookies: s.cookies })).statusCode).toBe(200);
  });

  test('die eigene Berechtigungsstufe kann nicht herabgesetzt werden', async () => {
    const a = await admin();
    const antwort = await aendern(a.cookies, a.id, { berechtigung: 'sachbearbeiter' });
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'nicht_erlaubt' });
  });

  test('einen anderen Administrator herabstufen geht', async () => {
    const a = await admin();
    const b = await neuerBenutzer('TBWAD2', { berechtigung: 'administrator' });
    expect((await aendern(a.cookies, b.id, { berechtigung: 'sachbearbeiter' })).statusCode).toBe(200);
  });

  test('das Kürzel ist nicht änderbar', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBWSB');
    const antwort = await aendern(a.cookies, s.id, { kuerzel: 'TBWNEU' });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json().meldung).toBe('Das Kürzel ist nach dem Anlegen nicht mehr änderbar.');
  });

  test('veraltete version ergibt 409, nichts wird geändert', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBWSB');
    expect((await aendern(a.cookies, s.id, { name: 'Erster' })).statusCode).toBe(200);
    const antwort = await aendern(a.cookies, s.id, { name: 'Zweiter', version: 1 });
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json()).toMatchObject({ fehler: 'konflikt' });
    expect((await laden(s.id, a.cookies)).name).toBe('Erster');
  });

  test('zwei gleichzeitige Änderungen mit derselben version: genau eine gelingt', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBWSB');
    const stand = await laden(s.id, a.cookies);
    const senden = (name: string) =>
      app.inject({
        method: 'PUT',
        url: `/api/v1/benutzer/${s.id}`,
        headers: MIT_HEADER,
        cookies: a.cookies,
        payload: { ...stand, sitzungen: undefined, id: undefined, kuerzel: undefined, aktiv: undefined, passwortWechselNoetig: undefined, name },
      });
    const [eins, zwei] = await Promise.all([senden('Eins'), senden('Zwei')]);
    expect([eins.statusCode, zwei.statusCode].sort()).toEqual([200, 409]);
  });

  test('E-Mail eines anderen Benutzers ergibt 409', async () => {
    const a = await admin();
    const s = await neuerBenutzer('TBWSB');
    const antwort = await aendern(a.cookies, s.id, { email: `tbwadm${DOMAIN}` });
    expect(antwort.statusCode).toBe(409);
    expect(antwort.json()).toMatchObject({ fehler: 'bereits_vergeben' });
  });

  test('unbekannter Benutzer ergibt 404', async () => {
    const a = await admin();
    const antwort = await app.inject({
      method: 'PUT',
      url: '/api/v1/benutzer/999999999',
      headers: MIT_HEADER,
      cookies: a.cookies,
      payload: { version: 1, name: 'x', email: `x${DOMAIN}`, berechtigung: 'sachbearbeiter', zeichnung: 'ohne', bezeichnung: null, zusatzrechte: [] },
    });
    expect(antwort.statusCode).toBe(404);
  });
});

describe('letzter aktiver Administrator (Dienst direkt)', () => {
  // Über die API nicht erreichbar, weil nur ein aktiver Administrator herabstufen darf und
  // die eigene Herabstufung schon verboten ist. Die Regel schützt trotzdem, etwa für
  // spätere Wege wie die Migration. Geprüft mit einem gedachten Handelnden.
  test('kann nicht herabgestuft werden', async () => {
    const aktiveAdmins = await db.select().from(benutzer).where(eq(benutzer.berechtigung, 'administrator'));
    expect(aktiveAdmins.filter((b) => b.aktiv && !b.email.endsWith(DOMAIN))).toHaveLength(0);

    const a = await admin();
    const stand = await laden(a.id, a.cookies);
    await expect(
      aendereBenutzer(db, { benutzerId: -1, berechtigung: 'administrator' }, a.id, {
        version: stand.version,
        name: stand.name,
        email: stand.email,
        berechtigung: 'sachbearbeiter',
        zeichnung: stand.zeichnung,
        bezeichnung: stand.bezeichnung,
        zusatzrechte: [],
      }),
    ).rejects.toMatchObject({ status: 403, code: 'nicht_erlaubt', message: 'Der letzte aktive Administrator kann nicht herabgestuft werden.' });
  });
});
