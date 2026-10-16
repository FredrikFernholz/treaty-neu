import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../../db/zugriff.js';
import { darf, type Bereich } from '../../shared/rechte/rechtematrix.js';
import type { ApiFehler } from '../../shared/schemas/api-fehler.js';
import { pruefeSitzung, type Angemeldet } from './sitzungen.js';

// Zugriffsprüfung für alle Routen unter /api/v1 (Konzeption 8 und 9,
// Entscheidung 16.10.2026).
//
// Jede Route erklärt in ihrer config, welchen Zugriff sie verlangt:
//   config: { zugriff: 'oeffentlich' }      ohne Anmeldung, etwa die Anmeldung selbst
//   config: { zugriff: 'angemeldet' }       jede angemeldete Person
//   config: { zugriff: 'buchhaltung' }      ein Bereich aus der Rechtematrix
// Eine Route ohne diese Angabe lässt den Start scheitern, statt still offen zu sein.
// Solange ein Passwortwechsel nötig ist, sind nur Routen mit
// erlaubtBeiPasswortwechsel: true erreichbar.
//
// Ablauf je Anfrage:
//  1. Schreibende Anfrage ohne X-Treaty: 1 → 403. Ein Browser setzt diesen Header bei
//     Anfragen von fremden Seiten nicht von sich aus, das schützt zusätzlich zu
//     SameSite=Strict gegen untergeschobene Anfragen.
//  2. öffentliche Route → weiter
//  3. Sitzung aus dem Cookie prüfen, ohne gültige Sitzung → 401
//  4. Passwortwechsel nötig und Route nicht dafür freigegeben → 403
//  5. Bereich nach der Rechtematrix nicht erlaubt → 403

export const SITZUNGSCOOKIE = '__Host-treaty_sitzung';
export const PFLICHT_HEADER = 'x-treaty';
const SCHREIBENDE_METHODEN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export type Zugriff = 'oeffentlich' | 'angemeldet' | Bereich;

declare module 'fastify' {
  interface FastifyContextConfig {
    zugriff?: Zugriff;
    erlaubtBeiPasswortwechsel?: boolean;
  }
  interface FastifyRequest {
    /** Die angemeldete Person, null bei öffentlichen Routen ohne Sitzung. */
    angemeldet: Angemeldet | null;
  }
}

/** Sendet eine Fehlerantwort in der einheitlichen Form. */
export function fehler(antwort: FastifyReply, status: number, inhalt: ApiFehler): FastifyReply {
  return antwort.code(status).send(inhalt);
}

/** Setzt das Sitzungscookie. Ohne Ablaufdatum, die Gültigkeit erzwingt der Server. */
export function setzeSitzungscookie(antwort: FastifyReply, token: string): void {
  // __Host- verlangt Secure, Path=/ und keine Domain. Browser akzeptieren Secure-Cookies
  // auch über http://localhost.
  antwort.setCookie(SITZUNGSCOOKIE, token, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
}

export function loescheSitzungscookie(antwort: FastifyReply): void {
  antwort.clearCookie(SITZUNGSCOOKIE, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
}

/** Token aus dem Sitzungscookie, oder null. */
export function sitzungstoken(anfrage: FastifyRequest): string | null {
  return anfrage.cookies[SITZUNGSCOOKIE] ?? null;
}

/** Richtet die Prüfung für alle Routen ein. Muss vor dem Anlegen der Routen aufgerufen werden. */
export function richteZugriffspruefungEin(app: FastifyInstance): void {
  app.decorateRequest('angemeldet', null);

  app.addHook('onRoute', (route) => {
    if (route.url.startsWith('/api/v1/') && route.config?.zugriff === undefined) {
      throw new Error(`Route ${String(route.method)} ${route.url} erklärt keinen Zugriff (config.zugriff)`);
    }
  });

  app.addHook('onRequest', async (anfrage, antwort) => {
    const config = anfrage.routeOptions.config;
    if (!anfrage.routeOptions.url?.startsWith('/api/v1/') || config.zugriff === undefined) return;

    if (SCHREIBENDE_METHODEN.has(anfrage.method) && anfrage.headers[PFLICHT_HEADER] !== '1') {
      return fehler(antwort, 403, {
        fehler: 'pflicht_header_fehlt',
        meldung: 'Die Anfrage wurde abgelehnt, weil der Header X-Treaty fehlt.',
      });
    }

    if (config.zugriff === 'oeffentlich') return;

    const token = sitzungstoken(anfrage);
    const angemeldet = token === null ? null : await pruefeSitzung(db, token, new Date());
    if (angemeldet === null) {
      if (token !== null) loescheSitzungscookie(antwort);
      return fehler(antwort, 401, { fehler: 'nicht_angemeldet', meldung: 'Bitte melden Sie sich an.' });
    }
    anfrage.angemeldet = angemeldet;

    if (angemeldet.passwortWechselNoetig && config.erlaubtBeiPasswortwechsel !== true) {
      return fehler(antwort, 403, {
        fehler: 'passwort_wechsel_noetig',
        meldung: 'Bitte legen Sie zuerst ein eigenes Passwort fest.',
      });
    }

    if (config.zugriff !== 'angemeldet' && !darf(angemeldet, config.zugriff)) {
      return fehler(antwort, 403, { fehler: 'kein_zugriff', meldung: 'Für diesen Bereich fehlt die Berechtigung.' });
    }
  });
}
