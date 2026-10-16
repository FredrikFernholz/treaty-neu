import { baueApp } from './app.js';
import { konfig } from './config.js';
import { pool } from './db/zugriff.js';

// Startet Treaty. Einstellungen und Routen stehen in app.ts.

// Node lauscht nur lokal. Von außen ist Treaty ausschließlich über Apache erreichbar.
// Deshalb ist die Adresse bewusst fest und nicht über .env änderbar.
const HOST = '127.0.0.1';

const app = baueApp({ logger: { level: konfig.LOG_LEVEL } });

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
