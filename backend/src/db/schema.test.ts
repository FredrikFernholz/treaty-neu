import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { konfig } from '../config.js';
import { BERECHTIGUNGEN, ZUSATZRECHTE } from '../shared/rechte/rechtematrix.js';
import { SICHERHEITSEREIGNISSE } from './schema.js';
import { erstellePool } from './verbindung.js';

// Prüft die Regeln der Tabellen aus Migration 0001_anmeldung direkt in der Testdatenbank
// (vorher "pnpm db:migrieren:test"). Läuft mit dem App-Benutzer. Jeder Test arbeitet in
// einer eigenen Transaktion, die am Ende zurückgerollt wird, es bleibt nichts stehen.

let pool: Pool;
let verbindung: PoolConnection;

beforeAll(() => {
  pool = erstellePool({
    benutzer: konfig.DB_APP_USER,
    passwort: konfig.DB_APP_PASSWORD,
    datenbank: konfig.DB_TEST_NAME,
  });
});
afterAll(async () => {
  await pool.end();
});
beforeEach(async () => {
  verbindung = await pool.getConnection();
  await verbindung.beginTransaction();
});
afterEach(async () => {
  await verbindung.rollback();
  verbindung.release();
});

async function zeilen(sql: string, werte: unknown[] = []) {
  const [ergebnis] = await verbindung.query<RowDataPacket[]>(sql, werte);
  return ergebnis;
}

/** Legt einen Benutzer an und gibt seine id zurück. */
async function neuerBenutzer(kuerzel: string): Promise<number> {
  const [ergebnis] = await verbindung.query<ResultSetHeader>(
    `INSERT INTO benutzer (kuerzel, name, email, passwort_hash, berechtigung)
     VALUES (?, ?, ?, 'kein-echter-hash', 'sachbearbeiter')`,
    [kuerzel, `Test ${kuerzel}`, `${kuerzel.toLowerCase()}@test.invalid`],
  );
  return ergebnis.insertId;
}

async function neueSitzung(benutzerId: number, tokenHash: string) {
  await verbindung.query(
    `INSERT INTO sitzung (token_hash, benutzer_id, laeuft_ab_am, letzte_aktivitaet_am, ip)
     VALUES (?, ?, NOW(3) + INTERVAL 12 HOUR, NOW(3), '127.0.0.1')`,
    [tokenHash, benutzerId],
  );
}

/** Liest die erlaubten Werte einer ENUM-Spalte aus dem Datenbankkatalog. */
async function enumWerte(tabelle: string, spalte: string): Promise<string[]> {
  const [zeile] = await zeilen(
    `SELECT COLUMN_TYPE AS typ FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabelle, spalte],
  );
  return [...String(zeile?.typ).matchAll(/'([^']*)'/g)].map((t) => t[1] as string);
}

describe('Werte der ENUM-Spalten passen zum Code', () => {
  // Fällt auf, wenn sich die Rechtematrix ändert, aber keine neue Migration erzeugt wurde.
  test.each([
    ['benutzer', 'berechtigung', BERECHTIGUNGEN],
    ['benutzer_zusatzrecht', 'recht', ZUSATZRECHTE],
    ['sicherheitsprotokoll', 'ereignis', SICHERHEITSEREIGNISSE],
  ])('%s.%s', async (tabelle, spalte, erwartet) => {
    expect(await enumWerte(tabelle, spalte)).toEqual([...erwartet]);
  });
});

describe('benutzer.passwort_wechsel_noetig', () => {
  test('ist bei einem neuen Benutzer aus', async () => {
    const id = await neuerBenutzer('TPW');
    const [zeile] = await zeilen('SELECT passwort_wechsel_noetig AS wert FROM benutzer WHERE id = ?', [id]);
    expect(zeile?.wert).toBe(0);
  });
});

describe('benutzer_zusatzrecht', () => {
  test('ein Recht lässt sich vergeben und nicht doppelt vergeben', async () => {
    const id = await neuerBenutzer('TZR');
    await verbindung.query("INSERT INTO benutzer_zusatzrecht VALUES (?, 'buchhaltung')", [id]);
    await expect(
      verbindung.query("INSERT INTO benutzer_zusatzrecht VALUES (?, 'buchhaltung')", [id]),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  test('ein unbekanntes Recht wird abgelehnt', async () => {
    const id = await neuerBenutzer('TZU');
    await expect(
      verbindung.query("INSERT INTO benutzer_zusatzrecht VALUES (?, 'kundenverwaltung')", [id]),
    ).rejects.toMatchObject({ code: 'WARN_DATA_TRUNCATED' });
  });

  test('ein Recht für einen nicht vorhandenen Benutzer wird abgelehnt', async () => {
    // MySQL meldet ER_NO_REFERENCED_ROW_2 nur, wenn der Benutzer die Definition der
    // Elterntabelle sehen darf. Der App-Benutzer hat nur Datenrechte und bekommt die
    // knappe Variante ER_NO_REFERENCED_ROW. Beides bedeutet: Fremdschlüssel verletzt.
    await expect(
      verbindung.query("INSERT INTO benutzer_zusatzrecht VALUES (4294967295, 'kunden')"),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^ER_NO_REFERENCED_ROW(_2)?$/) });
  });
});

describe('sitzung', () => {
  const HASH = 'a'.repeat(64);

  test('ein Token-Hash darf nur einmal vorkommen', async () => {
    const id = await neuerBenutzer('TSI');
    await neueSitzung(id, HASH);
    await expect(neueSitzung(id, HASH)).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });
});

describe('Löschen eines Benutzers', () => {
  // Fachlich werden Benutzer nicht gelöscht, sondern deaktiviert. Für den Fall, dass es
  // doch geschieht (etwa beim Aufräumen von Testdaten), bleibt nichts Verwaistes zurück.
  test('entfernt Zusatzrechte und Sitzungen, das Protokoll bleibt ohne Bezug erhalten', async () => {
    const id = await neuerBenutzer('TLO');
    await verbindung.query("INSERT INTO benutzer_zusatzrecht VALUES (?, 'kunden')", [id]);
    await neueSitzung(id, 'b'.repeat(64));
    const [eintrag] = await verbindung.query<ResultSetHeader>(
      "INSERT INTO sicherheitsprotokoll (ereignis, benutzer_id, kuerzel_eingabe) VALUES ('anmeldung_erfolgreich', ?, 'TLO')",
      [id],
    );

    await verbindung.query('DELETE FROM benutzer WHERE id = ?', [id]);

    expect(await zeilen('SELECT * FROM benutzer_zusatzrecht WHERE benutzer_id = ?', [id])).toHaveLength(0);
    expect(await zeilen('SELECT * FROM sitzung WHERE benutzer_id = ?', [id])).toHaveLength(0);
    const [protokoll] = await zeilen('SELECT benutzer_id, kuerzel_eingabe FROM sicherheitsprotokoll WHERE id = ?', [
      eintrag.insertId,
    ]);
    expect(protokoll).toMatchObject({ benutzer_id: null, kuerzel_eingabe: 'TLO' });
  });
});

describe('sicherheitsprotokoll', () => {
  test('eine fehlgeschlagene Anmeldung mit unbekanntem Kürzel lässt sich ohne Benutzer eintragen', async () => {
    const [eintrag] = await verbindung.query<ResultSetHeader>(
      "INSERT INTO sicherheitsprotokoll (ereignis, kuerzel_eingabe, ip) VALUES ('anmeldung_fehlgeschlagen', 'XYZ', '127.0.0.1')",
    );
    const [zeile] = await zeilen('SELECT zeitpunkt, benutzer_id FROM sicherheitsprotokoll WHERE id = ?', [
      eintrag.insertId,
    ]);
    expect(zeile?.benutzer_id).toBeNull();
    expect(zeile?.zeitpunkt).toBeInstanceOf(Date);
  });

  test('ein unbekanntes Ereignis wird abgelehnt', async () => {
    await expect(
      verbindung.query("INSERT INTO sicherheitsprotokoll (ereignis) VALUES ('rechte_geaendert')"),
    ).rejects.toMatchObject({ code: 'WARN_DATA_TRUNCATED' });
  });
});
