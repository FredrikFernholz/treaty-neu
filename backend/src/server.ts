import Fastify from 'fastify';

// Node lauscht nur lokal. Von außen ist Treaty ausschließlich über Apache erreichbar.
const HOST = '127.0.0.1';
// Standard ist 3000. Solange das Altsystem diesen Port belegt, lässt sich zum Testen
// ein anderer Port setzen, z. B. PORT=3001. Ab Teilschritt 1.3 prüft Zod diesen Wert.
const PORT = Number(process.env.PORT ?? 3000);

const app = Fastify({ logger: true });

// Lebenszeichen für Überwachung und Prüfschritte. Prüft vorerst nur, ob der Prozess antwortet.
app.get('/api/health', async () => {
  return { status: 'ok' };
});

try {
  await app.listen({ host: HOST, port: PORT });
} catch (fehler) {
  app.log.error(fehler);
  process.exit(1);
}
