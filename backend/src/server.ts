import Fastify from 'fastify';
import { konfig } from './config.js';

// Node lauscht nur lokal. Von außen ist Treaty ausschließlich über Apache erreichbar.
// Deshalb ist die Adresse bewusst fest und nicht über .env änderbar.
const HOST = '127.0.0.1';

const app = Fastify({ logger: { level: konfig.LOG_LEVEL } });

// Lebenszeichen für Überwachung und Prüfschritte. Prüft vorerst nur, ob der Prozess antwortet.
app.get('/api/health', async () => {
  return { status: 'ok' };
});

try {
  await app.listen({ host: HOST, port: konfig.PORT });
} catch (fehler) {
  app.log.error(fehler);
  process.exit(1);
}
