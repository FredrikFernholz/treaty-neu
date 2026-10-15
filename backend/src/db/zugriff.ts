import { drizzle } from 'drizzle-orm/mysql2';
import { konfig } from '../config.js';
import * as schema from './schema.js';
import { erstellePool } from './verbindung.js';

// Datenbankzugriff der laufenden Anwendung, mit dem App-Benutzer
// (nur Daten lesen und schreiben, keine Schemaänderung).

// Im Testlauf (NODE_ENV=test) arbeitet die Anwendung mit der Testdatenbank,
// damit Tests die eigentlichen Daten nie berühren.
export const datenbankName = konfig.NODE_ENV === 'test' ? konfig.DB_TEST_NAME : konfig.DB_NAME;

export const pool = erstellePool({
  benutzer: konfig.DB_APP_USER,
  passwort: konfig.DB_APP_PASSWORD,
  datenbank: datenbankName,
});

export const db = drizzle(pool, { schema, mode: 'default' });
