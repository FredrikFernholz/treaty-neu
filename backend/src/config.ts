import { z } from 'zod';

// Fehlermeldungen von Zod auf Deutsch (gilt für alle Schemas im Backend).
z.config(z.locales.de());

// Alle Einstellungen, die Treaty aus der Umgebung liest. Die Werte stehen in backend/.env
// (nicht im Repository), eine Vorlage mit Erläuterungen liegt in backend/.env.example.
// Ist ein Wert falsch, bricht der Start mit einer verständlichen Meldung ab, statt dass
// der Fehler erst später mitten im Betrieb auffällt.
const konfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Umgebungsvariablen sind immer Text, deshalb "coerce" (wandelt "3000" in 3000 um).
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Datenbank. Die Werte gibt deploy/mysql/setup.sh einmalig aus.
  // Verbunden wird über den lokalen Unix-Socket, nicht über TCP.
  DB_SOCKET: z.string().min(1).default('/var/run/mysqld/mysqld.sock'),
  DB_NAME: z.string().min(1),
  DB_TEST_NAME: z.string().min(1),
  // Benutzer der laufenden Anwendung: darf nur Daten lesen und schreiben.
  DB_APP_USER: z.string().min(1),
  DB_APP_PASSWORD: z.string().min(1),
  // Benutzer für Migrationen: darf das Schema ändern, wird nur von db:migrieren genutzt.
  DB_MIGRATION_USER: z.string().min(1),
  DB_MIGRATION_PASSWORD: z.string().min(1),
});

export type Konfig = z.infer<typeof konfigSchema>;

/**
 * Parameter für das Hashen von Passwörtern mit argon2id (Entscheidung 16.10.2026).
 * Sie entsprechen der Mindestempfehlung von OWASP (Password Storage Cheat Sheet):
 * argon2id mit 19MiB Speicher, 2 Durchläufen und 1 Thread. Bewusst eine feste Konstante
 * und kein Wert aus .env, damit die Stärke im Repository nachvollziehbar ist und im
 * Betrieb nicht versehentlich abgeschwächt wird.
 *
 * Jeder Hash speichert seine Parameter selbst (z. B. "$argon2id$v=19$m=19456,t=2,p=1$…").
 * Werden die Werte später erhöht, lassen sich alte Hashes also weiter prüfen.
 */
export const ARGON2_PARAMETER = {
  // 2 steht für Argon2id. Das Paket @node-rs/argon2 definiert Algorithm als const enum,
  // das sich mit isolatedModules nicht als Wert verwenden lässt, deshalb die Zahl.
  algorithm: 2,
  memoryCost: 19456, // in KiB, also 19MiB
  timeCost: 2,
  parallelism: 1,
} as const;

function ladeKonfig(): Konfig {
  const ergebnis = konfigSchema.safeParse(process.env);
  if (!ergebnis.success) {
    console.error('Ungültige Konfiguration in backend/.env oder der Umgebung:');
    console.error(z.prettifyError(ergebnis.error));
    process.exit(1);
  }
  return ergebnis.data;
}

export const konfig = ladeKonfig();
