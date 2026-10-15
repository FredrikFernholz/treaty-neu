import type { Connection as RohVerbindung } from 'mysql2';
import mysql from 'mysql2/promise';
import { konfig } from '../config.js';

// Alle Datenbankverbindungen von Treaty entstehen hier, damit die Regeln für
// Zeitzone und Zugang an genau einer Stelle stehen.
//
// Zeitpunkte (DATETIME(3)) werden immer in UTC gespeichert (Konzeption 6.1).
// Dafür sind zwei Einstellungen nötig, die zusammengehören:
//  1. timezone: 'Z' sagt mysql2, dass es JavaScript-Date-Werte beim Schreiben als UTC
//     umwandeln und DATETIME-Werte beim Lesen als UTC verstehen soll. Ohne diese
//     Einstellung nähme mysql2 die Zeitzone des Node-Prozesses.
//  2. SET time_zone = '+00:00' stellt die Sitzung in MySQL auf UTC. Das betrifft alles,
//     was MySQL selbst berechnet, etwa CURRENT_TIMESTAMP(3) als Standardwert und
//     ON UPDATE. Ohne diese Einstellung gälte die Zeitzone des MySQL-Servers.

/** Stellt eine einzelne MySQL-Sitzung auf UTC. */
export function aufUtcStellen(verbindung: RohVerbindung): void {
  // mysql2 arbeitet die Befehle einer Verbindung der Reihe nach ab. Dieser Befehl
  // läuft daher garantiert vor der ersten Abfrage, die die Anwendung schickt.
  verbindung.query("SET time_zone = '+00:00'");
}

type Zugang = { benutzer: string; passwort: string; datenbank: string };

/** Verbindungspool mit fester UTC-Einstellung für jede neue Verbindung. */
export function erstellePool(zugang: Zugang): mysql.Pool {
  const pool = mysql.createPool({
    socketPath: konfig.DB_SOCKET,
    user: zugang.benutzer,
    password: zugang.passwort,
    database: zugang.datenbank,
    timezone: 'Z',
    // DECIMAL-Werte bleiben Text (Standard von mysql2), damit Geldbeträge nie
    // als ungenaue JavaScript-Zahl ankommen. "decimalNumbers" daher nicht setzen.
  });
  // Der Pool öffnet Verbindungen bei Bedarf neu, auch nach einem Abbruch.
  // Jede neue Verbindung wird sofort auf UTC gestellt.
  pool.pool.on('connection', aufUtcStellen);
  return pool;
}
