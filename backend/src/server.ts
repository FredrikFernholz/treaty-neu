import Fastify from 'fastify';
import { konfig } from './config.js';
import { pool } from './db/zugriff.js';
import type { Health } from './shared/schemas/health.js';

// Node lauscht nur lokal. Von außen ist Treaty ausschließlich über Apache erreichbar.
// Deshalb ist die Adresse bewusst fest und nicht über .env änderbar.
const HOST = '127.0.0.1';

const app = Fastify({ logger: { level: konfig.LOG_LEVEL } });

// Lebenszeichen für Überwachung und Prüfschritte. Prüft, ob der Prozess antwortet
// und die Datenbank erreichbar ist. Dateiablage und Worker kommen später dazu.
// Die Form der Antwort legt das gemeinsame Schema fest (shared/schemas/health.ts).
// Weicht die Antwort davon ab, meldet die Typprüfung einen Fehler.
app.get('/api/health', async (_anfrage, antwort) => {
  try {
    await pool.query('SELECT 1');
    const ergebnis: Health = { status: 'ok', datenbank: 'ok' };
    return ergebnis;
  } catch (fehler) {
    // Einzelheiten nur ins Log, nicht nach außen (könnten Interna verraten).
    app.log.error({ err: fehler }, 'Datenbank nicht erreichbar');
    const ergebnis: Health = { status: 'fehler', datenbank: 'nicht erreichbar' };
    return antwort.code(503).send(ergebnis);
  }
});

// Beim Beenden (Strg+C, systemd stop) die Datenbankverbindungen sauber schließen.
app.addHook('onClose', async () => {
  await pool.end();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close());
}

try {
  await app.listen({ host: HOST, port: konfig.PORT });
} catch (fehler) {
  app.log.error(fehler);
  process.exit(1);
}
