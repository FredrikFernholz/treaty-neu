import { defineConfig } from 'drizzle-kit';

// Einstellungen für drizzle-kit. Genutzt wird nur "generate": Es vergleicht
// src/db/schema.ts mit den bisherigen Migrationen und schreibt eine neue SQL-Datei.
// Dafür ist keine Datenbankverbindung nötig. Ausgeführt werden die Migrationen
// mit unserem eigenen Skript src/db/migrieren.ts.
export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema.ts',
  out: './src/db/migrationen',
});
