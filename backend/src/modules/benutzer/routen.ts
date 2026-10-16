import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/zugriff.js';
import { benutzerAendernSchema, benutzerAnlegenSchema } from '../../shared/schemas/benutzer.js';
import { vergissKontoSperren, type Sperren } from '../anmeldung/routen.js';
import { fehler } from '../anmeldung/zugriffspruefung.js';
import { benutzerAuswahl, ladeBenutzer, listeBenutzer } from './benutzer.js';
import {
  Verwaltungsfehler,
  aendereBenutzer,
  beendeSitzungDurchVerwaltung,
  kuerzelVorschlag,
  legeBenutzerAn,
  setzeAktiv,
  vergibEinmalpasswort,
} from './verwaltung.js';

// Routen der Benutzerverwaltung (Teilschritte 9a und 9b):
//   GET  /api/v1/benutzer                    alle Benutzer               nutzerverwaltung
//   GET  /api/v1/benutzer/auswahl            aktive Benutzer, knapp      alle Angemeldeten
//   GET  /api/v1/benutzer/kuerzel-vorschlag  Vorschlag zum Namen         nutzerverwaltung
//   GET  /api/v1/benutzer/:id                ein Benutzer mit Sitzungen  nutzerverwaltung
//   POST /api/v1/benutzer                    anlegen, mit Einmalpasswort nutzerverwaltung
//   PUT  /api/v1/benutzer/:id                ändern (mit version)        nutzerverwaltung
//   PUT  /api/v1/benutzer/:id/aktiv          deaktivieren/aktivieren     nutzerverwaltung
//   POST /api/v1/benutzer/:id/einmalpasswort neues Einmalpasswort        nutzerverwaltung
//   DELETE /api/v1/benutzer/:id/sitzungen/:sitzungId  Sitzung beenden    nutzerverwaltung
// Antworten mit Einmalpasswort tragen Cache-Control: no-store, damit weder Browser noch
// ein Proxy sie zwischenspeichern.
// Was jemand mit dem Zusatzrecht nutzerverwaltung im Einzelnen darf, prüft verwaltung.ts.
//
// Die Liste ist nicht seitenweise, weil ADH nur wenige Dutzend Benutzer hat.

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const vorschlagSchema = z.object({ name: z.string().max(100).default('') });
const sitzungParameterSchema = z.object({ id: z.coerce.number().int().positive(), sitzungId: z.coerce.number().int().positive() });
const aktivSchema = z.object({ aktiv: z.boolean(), version: z.number().int().positive() });

const herkunft = (anfrage: FastifyRequest) => ({ ip: anfrage.ip, userAgent: anfrage.headers['user-agent'] ?? null });
const KEIN_ZWISCHENSPEICHER = 'no-store';

function eingabefehler(antwort: FastifyReply, fehlerliste: z.ZodError) {
  return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: fehlerliste.issues.map((i) => i.message).join(' ') });
}

/** Wandelt Verwaltungsfehler in die einheitliche Fehlerantwort um, andere Fehler gehen weiter. */
function verwaltungsfehler(antwort: FastifyReply, f: unknown) {
  if (f instanceof Verwaltungsfehler) return fehler(antwort, f.status, { fehler: f.code, meldung: f.message });
  throw f;
}

export function registriereBenutzerrouten(app: FastifyInstance, sperren: Sperren): void {
  app.get('/api/v1/benutzer', { config: { zugriff: 'nutzerverwaltung' } }, async () => listeBenutzer(db));

  // Statische Routen, Fastify bevorzugt sie vor /:id.
  app.get('/api/v1/benutzer/auswahl', { config: { zugriff: 'angemeldet' } }, async () => benutzerAuswahl(db));

  app.get('/api/v1/benutzer/kuerzel-vorschlag', { config: { zugriff: 'nutzerverwaltung' } }, async (anfrage, antwort) => {
    const abfrage = vorschlagSchema.safeParse(anfrage.query);
    if (!abfrage.success) return eingabefehler(antwort, abfrage.error);
    return { vorschlag: await kuerzelVorschlag(db, abfrage.data.name) };
  });

  app.post('/api/v1/benutzer', { config: { zugriff: 'nutzerverwaltung' } }, async (anfrage, antwort) => {
    const eingabe = benutzerAnlegenSchema.safeParse(anfrage.body);
    if (!eingabe.success) return eingabefehler(antwort, eingabe.error);
    try {
      const ergebnis = await legeBenutzerAn(db, anfrage.angemeldet!, eingabe.data, herkunft(anfrage), new Date());
      return antwort.code(201).header('Cache-Control', KEIN_ZWISCHENSPEICHER).send(ergebnis);
    } catch (f) {
      return verwaltungsfehler(antwort, f);
    }
  });

  app.put('/api/v1/benutzer/:id', { config: { zugriff: 'nutzerverwaltung' } }, async (anfrage, antwort) => {
    const parameter = idSchema.safeParse(anfrage.params);
    if (!parameter.success) {
      return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: 'Ungültige Benutzernummer.' });
    }
    if (anfrage.body && typeof anfrage.body === 'object' && 'kuerzel' in anfrage.body) {
      return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: 'Das Kürzel ist nach dem Anlegen nicht mehr änderbar.' });
    }
    const eingabe = benutzerAendernSchema.safeParse(anfrage.body);
    if (!eingabe.success) return eingabefehler(antwort, eingabe.error);
    try {
      return await aendereBenutzer(db, anfrage.angemeldet!, parameter.data.id, eingabe.data);
    } catch (f) {
      return verwaltungsfehler(antwort, f);
    }
  });

  app.put('/api/v1/benutzer/:id/aktiv', { config: { zugriff: 'nutzerverwaltung' } }, async (anfrage, antwort) => {
    const parameter = idSchema.safeParse(anfrage.params);
    if (!parameter.success) return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: 'Ungültige Benutzernummer.' });
    const eingabe = aktivSchema.safeParse(anfrage.body);
    if (!eingabe.success) return eingabefehler(antwort, eingabe.error);
    try {
      return await setzeAktiv(db, anfrage.angemeldet!, parameter.data.id, eingabe.data, new Date());
    } catch (f) {
      return verwaltungsfehler(antwort, f);
    }
  });

  app.post('/api/v1/benutzer/:id/einmalpasswort', { config: { zugriff: 'nutzerverwaltung' } }, async (anfrage, antwort) => {
    const parameter = idSchema.safeParse(anfrage.params);
    if (!parameter.success) return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: 'Ungültige Benutzernummer.' });
    try {
      const { einmalpasswort, kuerzel } = await vergibEinmalpasswort(
        db,
        anfrage.angemeldet!,
        parameter.data.id,
        herkunft(anfrage),
        new Date(),
      );
      // Eine laufende Sperre "Konto und IP" soll die Anmeldung mit dem neuen Passwort
      // nicht verzögern. Die Sperre je IP bleibt.
      vergissKontoSperren(sperren, kuerzel);
      return antwort.header('Cache-Control', KEIN_ZWISCHENSPEICHER).send({ einmalpasswort });
    } catch (f) {
      return verwaltungsfehler(antwort, f);
    }
  });

  app.delete(
    '/api/v1/benutzer/:id/sitzungen/:sitzungId',
    { config: { zugriff: 'nutzerverwaltung' } },
    async (anfrage, antwort) => {
      const parameter = sitzungParameterSchema.safeParse(anfrage.params);
      if (!parameter.success) return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: 'Ungültige Nummer.' });
      try {
        await beendeSitzungDurchVerwaltung(db, anfrage.angemeldet!, parameter.data.id, parameter.data.sitzungId, new Date());
        return antwort.code(204).send();
      } catch (f) {
        return verwaltungsfehler(antwort, f);
      }
    },
  );

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
