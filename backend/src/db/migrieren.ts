import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { konfig } from '../config.js';
import { erstellePool } from './verbindung.js';

// Spielt alle noch fehlenden Migrationen aus src/db/migrationen in die Datenbank ein.
//   pnpm db:migrieren         → Hauptdatenbank (DB_NAME)
//   pnpm db:migrieren:test    → Testdatenbank (DB_TEST_NAME)
// Läuft mit dem Migrationsbenutzer, weil nur er Tabellen anlegen und ändern darf.
// Welche Migrationen schon eingespielt sind, merkt sich Drizzle in der Tabelle
// __drizzle_migrations. Ein zweiter Aufruf ändert daher nichts.

const testdatenbank = process.argv.includes('--test');
const datenbank = testdatenbank ? konfig.DB_TEST_NAME : konfig.DB_NAME;
const ordner = fileURLToPath(new URL('./migrationen', import.meta.url));

// Gleicher Pool-Aufbau wie in der Anwendung, also ebenfalls fest auf UTC.
const migrationsPool = erstellePool({
  benutzer: konfig.DB_MIGRATION_USER,
  passwort: konfig.DB_MIGRATION_PASSWORD,
  datenbank,
});

try {
  console.log(`Migriere Datenbank ${datenbank} ...`);
  await migrate(drizzle(migrationsPool), { migrationsFolder: ordner });
  console.log('Fertig, alle Migrationen sind eingespielt.');
} finally {
  await migrationsPool.end();
}
