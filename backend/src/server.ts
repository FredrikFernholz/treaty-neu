import Fastify from 'fastify';
import { konfig } from './config.js';
import { pool } from './db/zugriff.js';

// Node lauscht nur lokal. Von außen ist Treaty ausschließlich über Apache erreichbar.
// Deshalb ist die Adresse bewusst fest und nicht über .env änderbar.
const HOST = '127.0.0.1';

const app = Fastify({ logger: { level: konfig.LOG_LEVEL } });

// Lebenszeichen für Überwachung und Prüfschritte. Prüft, ob der Prozess antwortet
// und die Datenbank erreichbar ist. Dateiablage und Worker kommen später dazu.
app.get('/api/health', async (_anfrage, antwort) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', datenbank: 'ok' };
  } catch (fehler) {
    // Einzelheiten nur ins Log, nicht nach außen (könnten Interna verraten).
    app.log.error({ err: fehler }, 'Datenbank nicht erreichbar');
    return antwort.code(503).send({ status: 'fehler', datenbank: 'nicht erreichbar' });
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
