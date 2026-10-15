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
});

export type Konfig = z.infer<typeof konfigSchema>;

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
