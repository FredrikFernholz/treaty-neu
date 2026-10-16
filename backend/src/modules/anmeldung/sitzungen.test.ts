import { eq, inArray, like } from 'drizzle-orm';
import { afterAll, afterEach, describe, expect, test } from 'vitest';
import { benutzer, benutzerZusatzrecht, sicherheitsprotokoll, sitzung } from '../../db/schema.js';
import { db, pool } from '../../db/zugriff.js';
import {
  AKTIVITAET_FORTSCHREIBEN_AB_MS,
  INAKTIV_HOECHSTENS_MS,
  SITZUNG_HOECHSTENS_MS,
  beendeAlleSitzungen,
  beendeSitzung,
  beendeSitzungNachId,
  erzeugeSitzung,
  hashToken,
  pruefeSitzung,
  raeumeAbgelaufeneAuf,
} from './sitzungen.js';

// Läuft gegen die Testdatenbank (NODE_ENV=test). Die Testbenutzer haben Kürzel mit
// TS6 am Anfang und werden nach jedem Test samt Protokolleinträgen wieder gelöscht.

const START = new Date('2026-10-16T08:00:00.000Z');
const nach = (ms: number) => new Date(START.getTime() + ms);
const MIN = 60 * 1000;
const STD = 60 * MIN;
const HERKUNFT = { ip: '192.0.2.10', userAgent: 'Testbrowser/1.0' };

let laufendeNummer = 0;
async function neuerBenutzer(optionen: { aktiv?: boolean; berechtigung?: 'administrator' | 'sachbearbeiter' } = {}) {
  laufendeNummer += 1;
  const kuerzel = `TS6${laufendeNummer}`;
  const [angelegt] = await db
    .insert(benutzer)
    .values({
      kuerzel,
      name: `Test ${kuerzel}`,
      email: `${kuerzel.toLowerCase()}@test.invalid`,
      passwortHash: 'kein-echter-hash',
      berechtigung: optionen.berechtigung ?? 'sachbearbeiter',
      aktiv: optionen.aktiv ?? true,
    })
    .$returningId();
  if (!angelegt) throw new Error('Testbenutzer wurde nicht angelegt');
  return { id: angelegt.id, kuerzel };
}

async function sitzungenVon(benutzerId: number) {
  return db.select().from(sitzung).where(eq(sitzung.benutzerId, benutzerId));
}

async function protokollVon(benutzerId: number) {
  return db.select().from(sicherheitsprotokoll).where(eq(sicherheitsprotokoll.benutzerId, benutzerId));
}

afterEach(async () => {
  const testbenutzer = await db.select({ id: benutzer.id }).from(benutzer).where(like(benutzer.kuerzel, 'TS6%'));
  const ids = testbenutzer.map((b) => b.id);
  if (ids.length > 0) {
    await db.delete(sicherheitsprotokoll).where(inArray(sicherheitsprotokoll.benutzerId, ids));
    await db.delete(sicherheitsprotokoll).where(inArray(sicherheitsprotokoll.ausgeloestVonId, ids));
    await db.delete(benutzer).where(inArray(benutzer.id, ids)); // Sitzungen und Rechte per CASCADE
  }
});
afterAll(async () => {
  await pool.end();
});

describe('erzeugeSitzung', () => {
  test('liefert ein zufälliges Token und speichert nur dessen Hash', async () => {
    const b = await neuerBenutzer();
    const { token, laeuftAbAm } = await erzeugeSitzung(db, b.id, HERKUNFT, START);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 Bytes base64url
    expect(laeuftAbAm).toEqual(nach(SITZUNG_HOECHSTENS_MS));
    const [gespeichert] = await sitzungenVon(b.id);
    expect(gespeichert).toMatchObject({
      tokenHash: hashToken(token),
      erstelltAm: START,
      laeuftAbAm: nach(12 * STD),
      letzteAktivitaetAm: START,
      ip: '192.0.2.10',
      userAgent: 'Testbrowser/1.0',
    });
    expect(gespeichert?.tokenHash).not.toContain(token);
  });

  test('zwei Sitzungen bekommen verschiedene Tokens', async () => {
    const b = await neuerBenutzer();
    const eins = await erzeugeSitzung(db, b.id, HERKUNFT, START);
    const zwei = await erzeugeSitzung(db, b.id, HERKUNFT, START);
    expect(eins.token).not.toBe(zwei.token);
  });

  test('ein sehr langer User-Agent wird gekürzt statt die Anmeldung scheitern zu lassen', async () => {
    const b = await neuerBenutzer();
    await erzeugeSitzung(db, b.id, { ip: '192.0.2.10', userAgent: 'x'.repeat(2000) }, START);
    const [gespeichert] = await sitzungenVon(b.id);
    expect(gespeichert?.userAgent).toHaveLength(500);
  });
});

describe('pruefeSitzung', () => {
  test('ein gültiges Token liefert die angemeldete Person mit Zusatzrechten', async () => {
    const b = await neuerBenutzer();
    await db.insert(benutzerZusatzrecht).values([
      { benutzerId: b.id, recht: 'buchhaltung' },
      { benutzerId: b.id, recht: 'zeiterfassung_alle' },
    ]);
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);

    const angemeldet = await pruefeSitzung(db, token, nach(1 * MIN));
    expect(angemeldet).toMatchObject({
      benutzerId: b.id,
      kuerzel: b.kuerzel,
      berechtigung: 'sachbearbeiter',
      passwortWechselNoetig: false,
    });
    expect([...(angemeldet?.zusatzrechte ?? [])].sort()).toEqual(['buchhaltung', 'zeiterfassung_alle']);
  });

  test('ein unbekanntes Token liefert null', async () => {
    expect(await pruefeSitzung(db, 'gibt-es-nicht', START)).toBeNull();
  });

  test('1 ms vor 8 Stunden Inaktivität gültig, bei 8 Stunden beendet', async () => {
    const b = await neuerBenutzer();
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);
    // Zweite Sitzung desselben Benutzers für die Grenze genau bei 8 Stunden
    const { token: token2 } = await erzeugeSitzung(db, b.id, HERKUNFT, START);

    expect(await pruefeSitzung(db, token, nach(INAKTIV_HOECHSTENS_MS - 1))).not.toBeNull();
    expect(await pruefeSitzung(db, token2, nach(INAKTIV_HOECHSTENS_MS))).toBeNull();

    const protokoll = await protokollVon(b.id);
    expect(protokoll).toHaveLength(1);
    expect(protokoll[0]).toMatchObject({ ereignis: 'sitzung_beendet', grund: 'inaktiv', ip: '192.0.2.10' });
    expect(await sitzungenVon(b.id)).toHaveLength(1); // nur die erste ist noch da
  });

  test('Aktivität verlängert, aber höchstens bis 12 Stunden nach der Anmeldung', async () => {
    const b = await neuerBenutzer();
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);

    expect(await pruefeSitzung(db, token, nach(7 * STD))).not.toBeNull(); // schreibt Aktivität fort
    expect(await pruefeSitzung(db, token, nach(12 * STD - 1))).not.toBeNull(); // ohne Fortschreiben wäre sie hier schon inaktiv
    expect(await pruefeSitzung(db, token, nach(12 * STD))).toBeNull();

    const [eintrag] = await protokollVon(b.id);
    expect(eintrag?.grund).toBe('hoechstdauer');
  });

  test('die Aktivität wird höchstens einmal pro Minute fortgeschrieben', async () => {
    const b = await neuerBenutzer();
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);

    await pruefeSitzung(db, token, nach(AKTIVITAET_FORTSCHREIBEN_AB_MS - 1));
    expect((await sitzungenVon(b.id))[0]?.letzteAktivitaetAm).toEqual(START);

    await pruefeSitzung(db, token, nach(AKTIVITAET_FORTSCHREIBEN_AB_MS));
    expect((await sitzungenVon(b.id))[0]?.letzteAktivitaetAm).toEqual(nach(AKTIVITAET_FORTSCHREIBEN_AB_MS));
  });

  test('die Sitzung eines deaktivierten Kontos gilt nicht und wird beendet', async () => {
    const b = await neuerBenutzer();
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);
    await db.update(benutzer).set({ aktiv: false }).where(eq(benutzer.id, b.id));

    expect(await pruefeSitzung(db, token, nach(1 * MIN))).toBeNull();
    expect(await sitzungenVon(b.id)).toHaveLength(0);
    expect((await protokollVon(b.id))[0]?.grund).toBe('konto_deaktiviert');
  });
});

describe('Sitzungen beenden', () => {
  test('beendeSitzung beim Abmelden', async () => {
    const b = await neuerBenutzer();
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);

    await beendeSitzung(db, token, nach(5 * MIN));
    expect(await pruefeSitzung(db, token, nach(6 * MIN))).toBeNull();
    expect(await protokollVon(b.id)).toMatchObject([
      { ereignis: 'sitzung_beendet', grund: 'abgemeldet', zeitpunkt: nach(5 * MIN), ausgeloestVonId: null },
    ]);
  });

  test('ein unbekanntes Token beim Abmelden ändert nichts', async () => {
    await expect(beendeSitzung(db, 'gibt-es-nicht', START)).resolves.toBeUndefined();
  });

  test('beendeSitzungNachId durch einen Administrator', async () => {
    const admin = await neuerBenutzer({ berechtigung: 'administrator' });
    const b = await neuerBenutzer();
    await erzeugeSitzung(db, b.id, HERKUNFT, START);
    const [s] = await sitzungenVon(b.id);

    await beendeSitzungNachId(db, s!.id, admin.id, nach(1 * MIN));
    expect(await sitzungenVon(b.id)).toHaveLength(0);
    expect(await protokollVon(b.id)).toMatchObject([{ grund: 'durch_administrator', ausgeloestVonId: admin.id }]);
  });

  test('beendeAlleSitzungen beendet alle Sitzungen nur dieses Benutzers', async () => {
    const admin = await neuerBenutzer({ berechtigung: 'administrator' });
    const b = await neuerBenutzer();
    const andere = await neuerBenutzer();
    await erzeugeSitzung(db, b.id, HERKUNFT, START);
    await erzeugeSitzung(db, b.id, { ip: '198.51.100.7' }, START);
    await erzeugeSitzung(db, andere.id, HERKUNFT, START);

    await beendeAlleSitzungen(db, b.id, 'konto_deaktiviert', nach(1 * MIN), { ausgeloestVonId: admin.id });
    expect(await sitzungenVon(b.id)).toHaveLength(0);
    expect(await sitzungenVon(andere.id)).toHaveLength(1);
    const protokoll = await protokollVon(b.id);
    expect(protokoll).toHaveLength(2);
    expect(protokoll.map((p) => p.ip).sort()).toEqual(['192.0.2.10', '198.51.100.7']);
  });
});

describe('beendeAlleSitzungen außer der aktuellen', () => {
  test('nach eigenem Passwortwechsel bleibt nur die aktuelle Sitzung', async () => {
    const b = await neuerBenutzer();
    const aktuell = await erzeugeSitzung(db, b.id, HERKUNFT, START);
    const anderer = await erzeugeSitzung(db, b.id, { ip: '198.51.100.7' }, START);
    const angemeldet = await pruefeSitzung(db, aktuell.token, nach(1 * MIN));

    await beendeAlleSitzungen(db, b.id, 'passwort_geaendert', nach(2 * MIN), {
      ausserSitzungId: angemeldet!.sitzungId,
    });
    expect(await pruefeSitzung(db, aktuell.token, nach(3 * MIN))).not.toBeNull();
    expect(await pruefeSitzung(db, anderer.token, nach(3 * MIN))).toBeNull();
    expect(await protokollVon(b.id)).toMatchObject([
      { grund: 'passwort_geaendert', ip: '198.51.100.7', ausgeloestVonId: null },
    ]);
  });
});

describe('gleichzeitige Prüfungen', () => {
  test('zwei Prüfungen derselben abgelaufenen Sitzung ergeben genau einen Protokolleintrag', async () => {
    const b = await neuerBenutzer();
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);
    // Beide Prüfungen laufen gleichzeitig über eigene Verbindungen aus dem Pool.
    const ergebnisse = await Promise.all([
      pruefeSitzung(db, token, nach(9 * STD)),
      pruefeSitzung(db, token, nach(9 * STD)),
    ]);
    expect(ergebnisse).toEqual([null, null]);
    expect(await sitzungenVon(b.id)).toHaveLength(0);
    expect(await protokollVon(b.id)).toHaveLength(1);
  });

  test('zehn gleichzeitige Abmeldungen derselben Sitzung ergeben genau einen Eintrag', async () => {
    const b = await neuerBenutzer();
    const { token } = await erzeugeSitzung(db, b.id, HERKUNFT, START);
    await Promise.all(Array.from({ length: 10 }, () => beendeSitzung(db, token, nach(1 * MIN))));
    expect(await protokollVon(b.id)).toHaveLength(1);
  });
});

describe('raeumeAbgelaufeneAuf', () => {
  test('löscht abgelaufene Sitzungen und lässt gültige stehen', async () => {
    const b = await neuerBenutzer();
    await erzeugeSitzung(db, b.id, HERKUNFT, START); // nach 8 Stunden inaktiv
    await erzeugeSitzung(db, b.id, HERKUNFT, nach(4 * STD)); // noch gültig

    const anzahl = await raeumeAbgelaufeneAuf(db, nach(8 * STD));
    expect(anzahl).toBeGreaterThanOrEqual(1); // andere Testdateien könnten weitere hinterlassen haben
    expect(await sitzungenVon(b.id)).toHaveLength(1);
    expect(await protokollVon(b.id)).toMatchObject([{ grund: 'inaktiv' }]);
  });
});
