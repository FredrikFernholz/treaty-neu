import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { eq, inArray, like } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baueApp } from '../../app.js';
import { benutzer, sicherheitsprotokoll } from '../../db/schema.js';
import { konfig } from '../../config.js';
import { db, pool } from '../../db/zugriff.js';
import { pruefePasswort } from '../anmeldung/passwort-hash.js';
import { neueSperren } from '../anmeldung/routen.js';
import { Kommandofehler, legeErstenAdministratorAn } from './erster-administrator.js';

// Läuft gegen die Testdatenbank. Die Regel "noch kein aktiver Administrator" hängt vom
// Gesamtbestand ab. Deshalb laufen die Testdateien nacheinander (vitest.config.ts), und
// vor jedem Test darf es keinen aktiven Administrator geben. Testbenutzer beginnen mit TEA.

const JETZT = new Date('2026-10-16T09:00:00.000Z');

async function aufraeumen() {
  const ids = (await db.select({ id: benutzer.id }).from(benutzer).where(like(benutzer.kuerzel, 'TEA%'))).map((b) => b.id);
  if (ids.length === 0) return;
  await db.delete(sicherheitsprotokoll).where(inArray(sicherheitsprotokoll.benutzerId, ids));
  await db.delete(benutzer).where(inArray(benutzer.id, ids));
}

beforeEach(async () => {
  await aufraeumen();
  const admins = await db.select().from(benutzer).where(eq(benutzer.berechtigung, 'administrator'));
  if (admins.some((a) => a.aktiv)) throw new Error('Die Testdatenbank enthält einen aktiven Administrator');
});
afterEach(aufraeumen);
afterAll(async () => {
  await pool.end();
});

const EINGABE = { kuerzel: 'tea1', name: 'Test Erster Admin', email: 'TEA1@Test.invalid' };

describe('legeErstenAdministratorAn', () => {
  test('legt einen Administrator mit Einmalpasswort und Pflichtwechsel an', async () => {
    const { kuerzel, einmalpasswort } = await legeErstenAdministratorAn(db, EINGABE, JETZT);

    expect(kuerzel).toBe('TEA1'); // in Großbuchstaben übernommen
    expect(einmalpasswort).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);

    const [gespeichert] = await db.select().from(benutzer).where(eq(benutzer.kuerzel, 'TEA1'));
    expect(gespeichert).toMatchObject({
      name: 'Test Erster Admin',
      email: 'tea1@test.invalid', // klein geschrieben
      berechtigung: 'administrator',
      aktiv: true,
      passwortWechselNoetig: true,
    });
    expect(await pruefePasswort(einmalpasswort, gespeichert!.passwortHash)).toBe(true);

    const eintraege = await db.select().from(sicherheitsprotokoll).where(eq(sicherheitsprotokoll.benutzerId, gespeichert!.id));
    expect(eintraege).toMatchObject([
      { ereignis: 'einmalpasswort_vergeben', zeitpunkt: JETZT, ausgeloestVonId: null, grund: 'erster Administrator per Kommandozeile' },
    ]);
    expect(JSON.stringify(eintraege)).not.toContain(einmalpasswort);
  });

  test('mit dem Einmalpasswort anmelden, danach ist nur der Pflichtwechsel möglich', async () => {
    const { kuerzel, einmalpasswort } = await legeErstenAdministratorAn(db, EINGABE, JETZT);
    const app = baueApp({ sperren: neueSperren() });
    await app.ready();
    try {
      const antwort = await app.inject({
        method: 'POST',
        url: '/api/v1/anmeldung',
        headers: { 'x-treaty': '1' },
        payload: { kuerzel, passwort: einmalpasswort },
      });
      expect(antwort.statusCode).toBe(200);
      expect(antwort.json()).toMatchObject({ berechtigung: 'administrator', passwortWechselNoetig: true });
    } finally {
      await app.close();
    }
  });

  test('verweigert, wenn es schon einen aktiven Administrator gibt', async () => {
    await legeErstenAdministratorAn(db, EINGABE, JETZT);
    await expect(
      legeErstenAdministratorAn(db, { kuerzel: 'TEA2', name: 'Zweiter', email: 'tea2@test.invalid' }, JETZT),
    ).rejects.toThrow(new Kommandofehler(
      'Es gibt bereits einen aktiven Administrator. Weitere Benutzer legt ein Administrator in der Benutzerverwaltung an.',
    ));
    expect(await db.select().from(benutzer).where(eq(benutzer.kuerzel, 'TEA2'))).toHaveLength(0);
  });

  test('ein deaktivierter Administrator verhindert die Anlage nicht', async () => {
    await legeErstenAdministratorAn(db, EINGABE, JETZT);
    await db.update(benutzer).set({ aktiv: false }).where(eq(benutzer.kuerzel, 'TEA1'));
    await expect(
      legeErstenAdministratorAn(db, { kuerzel: 'TEA2', name: 'Zweiter', email: 'tea2@test.invalid' }, JETZT),
    ).resolves.toMatchObject({ kuerzel: 'TEA2' });
  });

  test.each([
    [{ ...EINGABE, kuerzel: 'T' }, 'Das Kürzel muss aus 2 bis 10 Buchstaben oder Ziffern bestehen.'],
    [{ ...EINGABE, kuerzel: 'TE-A' }, 'Das Kürzel muss aus 2 bis 10 Buchstaben oder Ziffern bestehen.'],
    [{ ...EINGABE, kuerzel: 'TEA12345678' }, 'Das Kürzel muss aus 2 bis 10 Buchstaben oder Ziffern bestehen.'],
    [{ ...EINGABE, kuerzel: 'adh' }, 'Das Kürzel ADH ist für die Zuweisung an das Team reserviert.'],
    [{ ...EINGABE, name: '   ' }, 'Bitte einen Namen angeben.'],
    [{ ...EINGABE, email: 'keine-adresse' }, 'Bitte eine gültige E-Mail-Adresse angeben.'],
  ])('ungültige Eingabe %j', async (eingabe, meldung) => {
    await expect(legeErstenAdministratorAn(db, eingabe, JETZT)).rejects.toThrow(meldung);
  });

  test.each([
    ['Kürzel', { kuerzel: 'TEA9', email: 'anders@test.invalid' }, 'Das Kürzel TEA9 ist bereits vergeben.'],
    ['E-Mail ohne Beachtung der Groß- und Kleinschreibung', { kuerzel: 'TEA8', email: 'TEA9@TEST.invalid' }, 'Die E-Mail-Adresse tea9@test.invalid ist bereits vergeben.'],
  ])('doppeltes %s', async (_name, doppelt, meldung) => {
    await db.insert(benutzer).values({
      kuerzel: 'TEA9',
      name: 'Vorhanden',
      email: 'tea9@test.invalid',
      passwortHash: 'kein-echter-hash',
      berechtigung: 'sachbearbeiter',
    });
    await expect(legeErstenAdministratorAn(db, { ...doppelt, name: 'Neu' }, JETZT)).rejects.toThrow(meldung);
  });
});

describe('Kommandozeile pnpm benutzer:erster-administrator', () => {
  const backend = fileURLToPath(new URL('../../../', import.meta.url));
  const ausfuehren = promisify(execFile);
  const kommando = (argumente: string[]) =>
    ausfuehren('pnpm', ['--silent', 'benutzer:erster-administrator', ...argumente], {
      cwd: backend,
      env: { ...process.env, NODE_ENV: 'test' },
    });

  test('ohne Angaben: Meldung und Exitcode 1', async () => {
    await expect(kommando([])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Bitte --kuerzel, --name und --email angeben.'),
    });
  });

  test('legt an und zeigt das Einmalpasswort einmalig an', async () => {
    const { stdout } = await kommando(['--kuerzel', 'TEA5', '--name', 'Kommando Test', '--email', 'tea5@test.invalid']);
    // Muss die Testdatenbank sein, nie die Entwicklungsdatenbank
    expect(stdout).toContain(`Administrator TEA5 in der Datenbank ${konfig.DB_TEST_NAME} angelegt.`);
    expect(stdout).toMatch(/Einmalpasswort: [A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}/);
  });
});
