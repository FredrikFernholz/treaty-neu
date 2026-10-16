import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/zugriff.js';
import { fehler } from '../anmeldung/zugriffspruefung.js';
import { benutzerAuswahl, ladeBenutzer, listeBenutzer } from './benutzer.js';

// Routen der Benutzerverwaltung (Teilschritt 9a, nur lesend):
//   GET /api/v1/benutzer           alle Benutzer             Bereich nutzerverwaltung
//   GET /api/v1/benutzer/auswahl   aktive Benutzer, knapp    alle Angemeldeten
//   GET /api/v1/benutzer/:id       ein Benutzer mit Sitzungen  Bereich nutzerverwaltung
//
// Die Liste ist nicht seitenweise, weil ADH nur wenige Dutzend Benutzer hat.

const idSchema = z.object({ id: z.coerce.number().int().positive() });

export function registriereBenutzerrouten(app: FastifyInstance): void {
  app.get('/api/v1/benutzer', { config: { zugriff: 'nutzerverwaltung' } }, async () => listeBenutzer(db));

  // Statische Route, Fastify bevorzugt sie vor /:id.
  app.get('/api/v1/benutzer/auswahl', { config: { zugriff: 'angemeldet' } }, async () => benutzerAuswahl(db));

  app.get('/api/v1/benutzer/:id', { config: { zugriff: 'nutzerverwaltung' } }, async (anfrage, antwort) => {
    const parameter = idSchema.safeParse(anfrage.params);
    if (!parameter.success) {
      return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: 'Ungültige Benutzernummer.' });
    }
    const gefunden = await ladeBenutzer(db, parameter.data.id);
    if (!gefunden) return fehler(antwort, 404, { fehler: 'nicht_gefunden', meldung: 'Diesen Benutzer gibt es nicht.' });
    return gefunden;
  });
}
