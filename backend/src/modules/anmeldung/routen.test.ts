import { eq, inArray, like, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baueApp } from '../../app.js';
import { benutzer, sicherheitsprotokoll, sitzung } from '../../db/schema.js';
import { db, pool } from '../../db/zugriff.js';
import { hashePasswort } from './passwort-hash.js';
import { neueSperren } from './routen.js';
import { erzeugeSitzung } from './sitzungen.js';
import { SITZUNGSCOOKIE } from './zugriffspruefung.js';

// Prüft die Anmelderouten über app.inject() gegen die Testdatenbank. Jeder Test bekommt
// eine eigene App mit frischen Zählern der Fehlversuchssperre. Testbenutzer und alle
// eingegebenen Kürzel beginnen mit TAR und werden nach jedem Test wieder entfernt.

const PASSWORT = 'Sonnenblume-Kaffeetasse-17';
const NEUES_PASSWORT = 'Leuchtturm-Regenschirm-42';
const MIT_HEADER = { 'x-treaty': '1' };

let app: FastifyInstance;
beforeEach(async () => {
  app = baueApp({ sperren: neueSperren() });
  await app.ready();
});
afterEach(async () => {
  await app.close();
  const ids = (await db.select({ id: benutzer.id }).from(benutzer).where(like(benutzer.kuerzel, 'TAR%'))).map((b) => b.id);
  await db
    .delete(sicherheitsprotokoll)
    .where(
      ids.length > 0
        ? or(like(sicherheitsprotokoll.kuerzelEingabe, 'TAR%'), inArray(sicherheitsprotokoll.benutzerId, ids))
        : like(sicherheitsprotokoll.kuerzelEingabe, 'TAR%'),
    );
  if (ids.length > 0) await db.delete(benutzer).where(inArray(benutzer.id, ids));
});
afterAll(async () => {
  await pool.end();
});

let nummer = 0;
async function neuerBenutzer(optionen: { aktiv?: boolean; passwortWechselNoetig?: boolean } = {}) {
  nummer += 1;
  const kuerzel = `TAR${nummer}`;
  const [angelegt] = await db
    .insert(benutzer)
    .values({
      kuerzel,
      name: `Test ${kuerzel}`,
      email: `${kuerzel.toLowerCase()}@test.invalid`,
      passwortHash: await hashePasswort(PASSWORT),
      berechtigung: 'sachbearbeiter',
      aktiv: optionen.aktiv ?? true,
      passwortWechselNoetig: optionen.passwortWechselNoetig ?? false,
    })
    .$returningId();
  if (!angelegt) throw new Error('Testbenutzer wurde nicht angelegt');
  return { id: angelegt.id, kuerzel };
}

function anmelden(kuerzel: string, passwort: string, weiteres: { ip?: string; cookies?: Record<string, string> } = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/anmeldung',
    headers: MIT_HEADER,
    payload: { kuerzel, passwort },
    remoteAddress: weiteres.ip ?? '192.0.2.10',
    cookies: weiteres.cookies,
  });
}

/** Sitzungstoken aus der Set-Cookie-Antwort. */
function tokenAus(antwort: Awaited<ReturnType<typeof anmelden>>): string {
  const cookie = antwort.cookies.find((c) => c.name === SITZUNGSCOOKIE);
  if (!cookie) throw new Error('kein Sitzungscookie gesetzt');
  return cookie.value;
}

async function protokoll(kuerzelEingabe: string) {
  return db.select().from(sicherheitsprotokoll).where(eq(sicherheitsprotokoll.kuerzelEingabe, kuerzelEingabe));
}

describe('POST /api/v1/anmeldung', () => {
  test('erfolgreich: 200, Angaben zur Person, Sitzungscookie, Protokolleintrag', async () => {
    const b = await neuerBenutzer();
    const antwort = await anmelden(b.kuerzel, PASSWORT);

    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual({
      kuerzel: b.kuerzel,
      name: `Test ${b.kuerzel}`,
      berechtigung: 'sachbearbeiter',
      zusatzrechte: [],
      passwortWechselNoetig: false,
    });
    expect(tokenAus(antwort)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await protokoll(b.kuerzel)).toMatchObject([{ ereignis: 'anmeldung_erfolgreich', benutzerId: b.id, ip: '192.0.2.10' }]);

    const ich = await app.inject({ method: 'GET', url: '/api/v1/ich', cookies: { [SITZUNGSCOOKIE]: tokenAus(antwort) } });
    expect(ich.json()).toEqual(antwort.json());
  });

  test('gleiche Antwort bei unbekanntem Kürzel, falschem Passwort und deaktiviertem Konto', async () => {
    const aktiv = await neuerBenutzer();
    const deaktiviert = await neuerBenutzer({ aktiv: false });

    const antworten = [
      await anmelden('TARUNBEKANNT', PASSWORT),
      await anmelden(aktiv.kuerzel, 'falsches-Passwort-123'),
      await anmelden(deaktiviert.kuerzel, PASSWORT), // Passwort richtig, Konto aus
    ];
    for (const antwort of antworten) {
      expect(antwort.statusCode).toBe(401);
      expect(antwort.json()).toEqual({ fehler: 'anmeldung_fehlgeschlagen', meldung: 'Kürzel oder Passwort ist nicht korrekt.' });
      expect(antwort.headers['set-cookie']).toBeUndefined();
    }

    // Im Protokoll steht der echte Grund.
    expect(await protokoll('TARUNBEKANNT')).toMatchObject([{ grund: 'unbekanntes_kuerzel', benutzerId: null }]);
    expect(await protokoll(aktiv.kuerzel)).toMatchObject([{ grund: 'falsches_passwort', benutzerId: aktiv.id }]);
    expect(await protokoll(deaktiviert.kuerzel)).toMatchObject([{ grund: 'konto_deaktiviert', benutzerId: deaktiviert.id }]);
  });

  test('unbekanntes Kürzel dauert ungefähr so lange wie ein falsches Passwort', async () => {
    const b = await neuerBenutzer();
    const dauer = async (kuerzel: string) => {
      const zeiten: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await anmelden(kuerzel, 'falsches-Passwort-123', { ip: `198.51.100.${i}` });
        zeiten.push(performance.now() - start);
      }
      return zeiten.sort((x, y) => x - y)[1] ?? 0; // Median aus drei
    };
    const unbekannt = await dauer('TARUNBEKANNT');
    const falsch = await dauer(b.kuerzel);
    // Ohne Platzhalter-Hash wäre "unbekannt" nur einen Bruchteil so lang wie argon2.
    expect(unbekannt / falsch).toBeGreaterThan(0.5);
    expect(unbekannt / falsch).toBeLessThan(2);
  });

  test('ungültige Eingabe ergibt 400', async () => {
    const antwort = await app.inject({ method: 'POST', url: '/api/v1/anmeldung', headers: MIT_HEADER, payload: { kuerzel: '' } });
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json()).toMatchObject({ fehler: 'ungueltige_eingabe' });
  });

  test('eine alte Sitzung aus demselben Browser wird bei neuer Anmeldung beendet', async () => {
    const b = await neuerBenutzer();
    const alt = await erzeugeSitzung(db, b.id, { ip: '192.0.2.10' }, new Date());
    const antwort = await anmelden(b.kuerzel, PASSWORT, { cookies: { [SITZUNGSCOOKIE]: alt.token } });
    expect(tokenAus(antwort)).not.toBe(alt.token);
    expect(await db.select().from(sitzung).where(eq(sitzung.benutzerId, b.id))).toHaveLength(1);
  });
});

describe('Fehlversuchssperre bei der Anmeldung', () => {
  test('nach 5 Fehlversuchen 429 mit Retry-After, auch mit richtigem Passwort', async () => {
    const b = await neuerBenutzer();
    for (let i = 0; i < 5; i++) expect((await anmelden(b.kuerzel, 'falsch-falsch-falsch')).statusCode).toBe(401);

    const gesperrt = await anmelden(b.kuerzel, PASSWORT);
    expect(gesperrt.statusCode).toBe(429);
    expect(gesperrt.json()).toMatchObject({ fehler: 'zu_viele_versuche' });
    const sekunden = Number(gesperrt.headers['retry-after']);
    expect(sekunden).toBeGreaterThanOrEqual(1);
    expect(sekunden).toBeLessThanOrEqual(30);

    const eintraege = await protokoll(b.kuerzel);
    expect(eintraege.filter((e) => e.ereignis === 'sperre')).toMatchObject([{ grund: 'Konto und IP, 30s' }]);
    expect(eintraege.filter((e) => e.grund === 'gesperrt')).toHaveLength(1);
  });

  test('50 Versuche während einer Sperre ergeben genau einen Eintrag "gesperrt"', async () => {
    const b = await neuerBenutzer();
    for (let i = 0; i < 5; i++) await anmelden(b.kuerzel, 'falsch-falsch-falsch');
    for (let i = 0; i < 50; i++) expect((await anmelden(b.kuerzel, 'falsch-falsch-falsch')).statusCode).toBe(429);
    const eintraege = await protokoll(b.kuerzel);
    expect(eintraege.filter((e) => e.grund === 'gesperrt')).toHaveLength(1);
    expect(eintraege.filter((e) => e.ereignis === 'anmeldung_fehlgeschlagen')).toHaveLength(6); // 5 + 1
  });

  test('die Sperre gilt nur für dieses Konto von dieser IP', async () => {
    const b = await neuerBenutzer();
    const andere = await neuerBenutzer();
    for (let i = 0; i < 5; i++) await anmelden(b.kuerzel, 'falsch-falsch-falsch');
    expect((await anmelden(b.kuerzel, PASSWORT, { ip: '203.0.113.99' })).statusCode).toBe(200);
    expect((await anmelden(andere.kuerzel, PASSWORT)).statusCode).toBe(200);
  });

  test('das Kürzel zählt ohne Beachtung der Groß- und Kleinschreibung', async () => {
    const b = await neuerBenutzer();
    for (let i = 0; i < 5; i++) await anmelden(i % 2 === 0 ? b.kuerzel : b.kuerzel.toLowerCase(), 'falsch-falsch-falsch');
    expect((await anmelden(b.kuerzel, PASSWORT)).statusCode).toBe(429);
  });

  test('nach 20 Fehlversuchen von einer IP mit verschiedenen Kürzeln ist die IP gesperrt', async () => {
    for (let i = 0; i < 20; i++) await anmelden(`TARIP${i}`, 'falsch-falsch-falsch', { ip: '198.51.100.77' });
    const b = await neuerBenutzer();
    expect((await anmelden(b.kuerzel, PASSWORT, { ip: '198.51.100.77' })).statusCode).toBe(429);
    expect((await anmelden(b.kuerzel, PASSWORT, { ip: '198.51.100.78' })).statusCode).toBe(200);
  });

  test('eine erfolgreiche Anmeldung setzt den Zähler für Konto und IP zurück', async () => {
    const b = await neuerBenutzer();
    for (let i = 0; i < 4; i++) await anmelden(b.kuerzel, 'falsch-falsch-falsch');
    expect((await anmelden(b.kuerzel, PASSWORT)).statusCode).toBe(200);
    for (let i = 0; i < 4; i++) await anmelden(b.kuerzel, 'falsch-falsch-falsch');
    expect((await anmelden(b.kuerzel, PASSWORT)).statusCode).toBe(200);
  });
});

describe('POST /api/v1/abmeldung', () => {
  test('beendet die Sitzung und löscht das Cookie', async () => {
    const b = await neuerBenutzer();
    const cookies = { [SITZUNGSCOOKIE]: tokenAus(await anmelden(b.kuerzel, PASSWORT)) };

    const antwort = await app.inject({ method: 'POST', url: '/api/v1/abmeldung', headers: MIT_HEADER, cookies });
    expect(antwort.statusCode).toBe(204);
    expect(String(antwort.headers['set-cookie'])).toMatch(new RegExp(`^${SITZUNGSCOOKIE}=;`));
    expect((await app.inject({ method: 'GET', url: '/api/v1/ich', cookies })).statusCode).toBe(401);
  });
});

describe('POST /api/v1/ich/passwort', () => {
  async function angemeldet(optionen: { passwortWechselNoetig?: boolean } = {}) {
    const b = await neuerBenutzer(optionen);
    const cookies = { [SITZUNGSCOOKIE]: tokenAus(await anmelden(b.kuerzel, PASSWORT)) };
    const aendern = (altesPasswort: string, neuesPasswort: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/ich/passwort',
        headers: MIT_HEADER,
        cookies,
        remoteAddress: '192.0.2.10',
        payload: { altesPasswort, neuesPasswort },
      });
    return { ...b, cookies, aendern };
  }

  test('Pflichtwechsel: danach frei, andere Sitzungen beendet, aktuelle bleibt', async () => {
    const b = await angemeldet({ passwortWechselNoetig: true });
    const andere = await erzeugeSitzung(db, b.id, { ip: '203.0.113.5' }, new Date());

    const vorher = await app.inject({ method: 'GET', url: '/api/v1/ich', cookies: b.cookies });
    expect(vorher.json()).toMatchObject({ passwortWechselNoetig: true });

    const antwort = await b.aendern(PASSWORT, NEUES_PASSWORT);
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toMatchObject({ passwortWechselNoetig: false });

    const [gespeichert] = await db.select().from(benutzer).where(eq(benutzer.id, b.id));
    expect(gespeichert).toMatchObject({ passwortWechselNoetig: false, version: 2 });
    expect((await app.inject({ method: 'GET', url: '/api/v1/ich', cookies: b.cookies })).statusCode).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/ich', cookies: { [SITZUNGSCOOKIE]: andere.token } })).statusCode,
    ).toBe(401);

    const eintraege = await db.select().from(sicherheitsprotokoll).where(eq(sicherheitsprotokoll.benutzerId, b.id));
    expect(eintraege.filter((e) => e.ereignis === 'passwort_geaendert')).toMatchObject([{ grund: 'pflichtwechsel' }]);
    expect(eintraege.filter((e) => e.ereignis === 'sitzung_beendet')).toMatchObject([
      { grund: 'passwort_geaendert', ip: '203.0.113.5' },
    ]);

    expect((await anmelden(b.kuerzel, NEUES_PASSWORT, { ip: '192.0.2.20' })).statusCode).toBe(200);
    expect((await anmelden(b.kuerzel, PASSWORT, { ip: '192.0.2.21' })).statusCode).toBe(401);
  });

  test('falsches bisheriges Passwort: 403 und zählt als Fehlversuch', async () => {
    const b = await angemeldet();
    for (let i = 0; i < 4; i++) {
      const antwort = await b.aendern('falsch-falsch-falsch', NEUES_PASSWORT);
      expect(antwort.statusCode).toBe(403);
      expect(antwort.json()).toMatchObject({ fehler: 'passwort_falsch' });
    }
    expect((await b.aendern('falsch-falsch-falsch', NEUES_PASSWORT)).statusCode).toBe(403); // 5. löst die Sperre aus
    expect((await b.aendern(PASSWORT, NEUES_PASSWORT)).statusCode).toBe(429);
  });

  test.each([
    ['zu kurz', 'kurz', 'mindestens 12 Zeichen'],
    ['häufiges Passwort', 'qwertyqwerty', 'weit verbreitet'],
    ['gleich dem bisherigen', PASSWORT, 'vom bisherigen unterscheiden'],
  ])('neues Passwort %s: 400 mit Meldung', async (_name, neues, meldung) => {
    const b = await angemeldet();
    const antwort = await b.aendern(PASSWORT, neues);
    expect(antwort.statusCode).toBe(400);
    expect(antwort.json().meldung).toContain(meldung);
  });

  test('ohne Pflicht-Header 403', async () => {
    const b = await angemeldet();
    const antwort = await app.inject({
      method: 'POST',
      url: '/api/v1/ich/passwort',
      cookies: b.cookies,
      payload: { altesPasswort: PASSWORT, neuesPasswort: NEUES_PASSWORT },
    });
    expect(antwort.statusCode).toBe(403);
    expect(antwort.json()).toMatchObject({ fehler: 'pflicht_header_fehlt' });
  });
});

describe('GET /api/v1/ich', () => {
  test('ohne Anmeldung 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/ich' })).statusCode).toBe(401);
  });
});
