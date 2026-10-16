import Fastify, { type FastifyServerOptions } from 'fastify';
import { pool } from './db/zugriff.js';
import type { Health } from './shared/schemas/health.js';

// Baut die Fastify-Anwendung mit allen Einstellungen und Routen, ohne sie zu starten.
// server.ts startet sie auf 127.0.0.1, Tests rufen sie mit app.inject() auf, ganz ohne
// Netzwerk und ohne belegten Port.

// Treaty läuft hinter Apache. Für Node kommt deshalb jede Anfrage von 127.0.0.1, die
// echte Adresse der Nutzer steht im Header X-Forwarded-For, den Apache setzt. Fastify
// übernimmt sie nur, wenn die Anfrage tatsächlich von 127.0.0.1 kommt. Von jeder
// anderen Adresse wird der Header ignoriert, sonst könnte man sich mit einem selbst
// gesetzten X-Forwarded-For eine fremde IP geben und die Fehlversuchssperre umgehen.
// Apache verbindet sich über IPv4 (127.0.0.1), ::1 wird deshalb nicht vertraut.
export const VERTRAUTER_PROXY = '127.0.0.1';

export function baueApp(optionen: { logger?: FastifyServerOptions['logger'] } = {}) {
  const app = Fastify({ logger: optionen.logger ?? false, trustProxy: VERTRAUTER_PROXY });

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

  return app;
}
