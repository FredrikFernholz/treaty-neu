import { parseArgs } from 'node:util';
import { datenbankName, db, pool } from '../db/zugriff.js';
import { Kommandofehler, legeErstenAdministratorAn } from '../modules/benutzer/erster-administrator.js';

// Legt den ersten Administrator an und gibt sein Einmalpasswort einmalig aus.
//
//   pnpm --dir /home/treaty-neu/backend benutzer:erster-administrator \
//     --kuerzel AB --name "Anna Beispiel" --email anna.beispiel@adh.email
//
// Die Datenbank folgt NODE_ENV wie die Anwendung (development: DB_NAME, test: DB_TEST_NAME).
// Das Einmalpasswort steht danach nirgends mehr, auch nicht im Log. Bei der ersten
// Anmeldung damit muss ein eigenes Passwort festgelegt werden.

const { values } = parseArgs({
  options: { kuerzel: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } },
});

try {
  if (!values.kuerzel || !values.name || !values.email) {
    throw new Kommandofehler('Bitte --kuerzel, --name und --email angeben.');
  }
  const { kuerzel, einmalpasswort } = await legeErstenAdministratorAn(
    db,
    { kuerzel: values.kuerzel, name: values.name, email: values.email },
    new Date(),
  );
  console.log(`Administrator ${kuerzel} in der Datenbank ${datenbankName} angelegt.`);
  console.log('');
  console.log(`  Einmalpasswort: ${einmalpasswort}`);
  console.log('');
  console.log('Das Einmalpasswort wird nur jetzt angezeigt. Bei der ersten Anmeldung muss');
  console.log('ein eigenes Passwort festgelegt werden.');
} catch (fehler) {
  if (!(fehler instanceof Kommandofehler)) throw fehler;
  console.error(fehler.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
