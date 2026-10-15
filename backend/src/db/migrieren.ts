import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';
import { konfig } from '../config.js';

// Spielt alle noch fehlenden Migrationen aus src/db/migrationen in die Datenbank ein.
//   pnpm db:migrieren         → Hauptdatenbank (DB_NAME)
//   pnpm db:migrieren:test    → Testdatenbank (DB_TEST_NAME)
// Läuft mit dem Migrationsbenutzer, weil nur er Tabellen anlegen und ändern darf.
// Welche Migrationen schon eingespielt sind, merkt sich Drizzle in der Tabelle
// __drizzle_migrations. Ein zweiter Aufruf ändert daher nichts.

const testdatenbank = process.argv.includes('--test');
const datenbank = testdatenbank ? konfig.DB_TEST_NAME : konfig.DB_NAME;
const ordner = fileURLToPath(new URL('./migrationen', import.meta.url));

const verbindung = await mysql.createConnection({
  socketPath: konfig.DB_SOCKET,
  user: konfig.DB_MIGRATION_USER,
  password: konfig.DB_MIGRATION_PASSWORD,
  database: datenbank,
  timezone: 'Z',
});

try {
  // Zeitpunkte werden in UTC gespeichert (Konzeption 6.1).
  await verbindung.query("SET time_zone = '+00:00'");
  console.log(`Migriere Datenbank ${datenbank} ...`);
  await migrate(drizzle(verbindung), { migrationsFolder: ordner });
  console.log('Fertig, alle Migrationen sind eingespielt.');
} finally {
  await verbindung.end();
}
