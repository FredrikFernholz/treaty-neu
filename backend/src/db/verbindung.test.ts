import { createConnection } from 'mysql2';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { konfig } from '../config.js';
import { aufUtcStellen, erstellePool } from './verbindung.js';

// Prüft, dass Treaty Zeitpunkte unabhängig von den Zeitzonen des MySQL-Servers und des
// Node-Prozesses immer in UTC schreibt und liest (Konzeption 6.1).
// Läuft gegen die Testdatenbank mit dem App-Benutzer. Schreibende Tests rollen ihre
// Änderungen per Transaktion zurück, es bleibt nichts in der Datenbank.

const zugang = {
  benutzer: konfig.DB_APP_USER,
  passwort: konfig.DB_APP_PASSWORD,
  datenbank: konfig.DB_TEST_NAME,
};

let pool: Pool;
beforeAll(() => {
  pool = erstellePool(zugang);
});
afterAll(async () => {
  await pool.end();
});

// Ein Test stellt die Zeitzone des Node-Prozesses um. Nach jedem Test wird sie auf den
// Ausgangswert zurückgesetzt, auch wenn der Test fehlschlägt, damit kein anderer Test
// mit einer fremden Zeitzone läuft.
const tzAmAnfang = process.env.TZ;
afterEach(() => {
  if (tzAmAnfang === undefined) delete process.env.TZ;
  else process.env.TZ = tzAmAnfang;
});

/** Liest Zeitzone der Sitzung und Abstand von NOW() zu UTC in Sekunden. */
async function zeitzoneDerSitzung(abfrage: (sql: string) => Promise<[RowDataPacket[], unknown]>) {
  const [zeilen] = await abfrage(
    'SELECT @@session.time_zone AS zone, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) AS abstand',
  );
  return zeilen[0] as { zone: string; abstand: number };
}

describe('Datenbankverbindung in UTC', () => {
  test('aufUtcStellen überschreibt eine abweichende Server-Zeitzone', async () => {
    // Eine Verbindung ohne unseren Pool, also ohne UTC-Einstellung.
    const roh = createConnection({
      socketPath: konfig.DB_SOCKET,
      user: zugang.benutzer,
      password: zugang.passwort,
      database: zugang.datenbank,
    });
    const verbindung = roh.promise();
    try {
      // Eine neue Sitzung übernimmt die Zeitzone des Servers. Ein Server in einer
      // anderen Zeitzone wird hier nachgestellt, indem die Sitzung auf +05:30 steht.
      await verbindung.query("SET time_zone = '+05:30'");
      expect(await zeitzoneDerSitzung((sql) => verbindung.query<RowDataPacket[]>(sql))).toEqual({
        zone: '+05:30',
        abstand: 5.5 * 3600,
      });

      aufUtcStellen(roh);

      expect(await zeitzoneDerSitzung((sql) => verbindung.query<RowDataPacket[]>(sql))).toEqual({
        zone: '+00:00',
        abstand: 0,
      });
    } finally {
      await verbindung.end();
    }
  });

  test('jede neue Verbindung des Pools steht auf UTC', async () => {
    // Drei Verbindungen gleichzeitig ausleihen, damit der Pool wirklich drei
    // getrennte Verbindungen öffnet und nicht eine wiederverwendet.
    const verbindungen = await Promise.all([1, 2, 3].map(() => pool.getConnection()));
    try {
      const ids = new Set(verbindungen.map((v) => v.threadId));
      expect(ids.size).toBe(3);
      for (const v of verbindungen) {
        expect(await zeitzoneDerSitzung((sql) => v.query<RowDataPacket[]>(sql))).toEqual({
          zone: '+00:00',
          abstand: 0,
        });
      }
    } finally {
      verbindungen.forEach((v) => v.release());
    }
  });

  test('Date-Werte werden auch bei anderer Prozess-Zeitzone als UTC gespeichert und gelesen', async () => {
    // Node übernimmt eine Änderung von TZ sofort. Tokio liegt 9 Stunden vor UTC.
    process.env.TZ = 'Asia/Tokyo';
    const verbindung = await pool.getConnection();
    try {
      const zeitpunkt = new Date('2026-01-15T12:00:00.123Z');
      // Sicherstellen, dass die Prozess-Zeitzone wirklich umgestellt ist.
      expect(zeitpunkt.getHours()).toBe(21);

      await verbindung.beginTransaction();
      await verbindung.query(
        `INSERT INTO benutzer (kuerzel, name, email, passwort_hash, berechtigung, erstellt_am)
         VALUES ('ZZTEST', 'Zeitzonentest', 'zeitzone@test.invalid', 'x', 'sachbearbeiter', ?)`,
        [zeitpunkt],
      );
      // Ohne Angabe setzt MySQL geaendert_am selbst (CURRENT_TIMESTAMP(3)).
      const [zeilen] = await verbindung.query<RowDataPacket[]>(
        `SELECT erstellt_am,
                CAST(erstellt_am AS CHAR) AS erstellt_text,
                TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), geaendert_am) AS abstand_geaendert
         FROM benutzer WHERE kuerzel = 'ZZTEST'`,
      );
      const zeile = zeilen[0]!;

      // So steht der Wert in der Datenbank: UTC, nicht 21:00 Uhr Tokioter Zeit.
      expect(zeile.erstellt_text).toBe('2026-01-15 12:00:00.123');
      // Beim Lesen kommt derselbe Zeitpunkt zurück.
      expect((zeile.erstellt_am as Date).toISOString()).toBe('2026-01-15T12:00:00.123Z');
      // Der von MySQL gesetzte Zeitpunkt liegt ebenfalls in UTC (Toleranz 1s).
      expect(Math.abs(zeile.abstand_geaendert as number)).toBeLessThanOrEqual(1);
    } finally {
      await verbindung.rollback();
      verbindung.release();
    }
  });
});
