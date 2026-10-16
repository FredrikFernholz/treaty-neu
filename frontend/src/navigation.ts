import { darf, type Bereich } from '@shared/rechte/rechtematrix.js';
import type { Ich } from '@shared/schemas/anmeldung.js';
import type { RouteLocationRaw } from 'vue-router';

// Router-Schutz: entscheidet vor jedem Seitenwechsel, ob die Seite gezeigt wird oder wohin
// stattdessen weitergeleitet wird. Als reine Funktion, damit sie sich ohne Browser testen
// lässt. Die eigentliche Sperre sitzt im Backend, hier geht es um eine sinnvolle Führung.

declare module 'vue-router' {
  interface RouteMeta {
    /** Ohne Anmeldung erreichbar, etwa die Anmeldeseite. */
    oeffentlich?: boolean;
    /** Bereich aus der Rechtematrix, der für die Seite nötig ist. */
    bereich?: Bereich;
    /** Auch erreichbar, solange ein Passwortwechsel nötig ist. */
    erlaubtBeiPasswortwechsel?: boolean;
  }
}

type Ziel = { name?: unknown; fullPath: string; meta: { oeffentlich?: boolean; bereich?: Bereich; erlaubtBeiPasswortwechsel?: boolean } };

export function entscheideNavigation(ziel: Ziel, ich: Ich | null): true | RouteLocationRaw {
  if (ziel.meta.oeffentlich) {
    // Wer schon angemeldet ist, braucht die Anmeldeseite nicht.
    if (ich && ziel.name === 'anmelden') return { name: 'start' };
    return true;
  }
  if (!ich) {
    return ziel.fullPath === '/' ? { name: 'anmelden' } : { name: 'anmelden', query: { ziel: ziel.fullPath } };
  }
  if (ich.passwortWechselNoetig && !ziel.meta.erlaubtBeiPasswortwechsel) return { name: 'passwort-aendern' };
  if (ziel.meta.bereich && !darf(ich, ziel.meta.bereich)) return { name: 'kein-zugriff' };
  return true;
}

/**
 * Prüft das Ziel aus ?ziel=… nach der Anmeldung. Nur Pfade innerhalb von Treaty sind
 * erlaubt. "//andere.de" oder "https://…" würden sonst auf fremde Seiten führen.
 */
export function sichererZielpfad(ziel: unknown): string {
  if (typeof ziel !== 'string' || !ziel.startsWith('/') || ziel.startsWith('//') || ziel.includes('\\')) return '/';
  return ziel;
}
