import { SICHERHEITSEREIGNISSE, sicherheitsprotokoll } from '../../db/schema.js';
import type { DbZugriff } from '../../db/zugriff.js';

// Schreibt Einträge in das technische Sicherheitsprotokoll (Entscheidung 16.10.2026).
// Nur anfügen, nie ändern. Änderungen an Rechten gehören nicht hierher (Abgleich A-17).

export type Sicherheitsereignis = (typeof SICHERHEITSEREIGNISSE)[number];

export type Protokolleintrag = {
  ereignis: Sicherheitsereignis;
  zeitpunkt: Date;
  benutzerId?: number | null;
  kuerzelEingabe?: string | null;
  ausgeloestVonId?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  grund?: string | null;
};

/**
 * Kürzt einen Text auf die Spaltenlänge. Freie Eingaben aus der Anfrage (User-Agent,
 * eingegebenes Kürzel) dürfen das Protokollieren nie scheitern lassen.
 */
export function kuerzen(text: string | null | undefined, laenge: number): string | null {
  return text == null ? null : [...text].slice(0, laenge).join('');
}

export async function protokolliere(db: DbZugriff, eintrag: Protokolleintrag): Promise<void> {
  await db.insert(sicherheitsprotokoll).values({
    ereignis: eintrag.ereignis,
    zeitpunkt: eintrag.zeitpunkt,
    benutzerId: eintrag.benutzerId ?? null,
    kuerzelEingabe: kuerzen(eintrag.kuerzelEingabe, 50),
    ausgeloestVonId: eintrag.ausgeloestVonId ?? null,
    ip: kuerzen(eintrag.ip, 45),
    userAgent: kuerzen(eintrag.userAgent, 500),
    grund: kuerzen(eintrag.grund, 100),
  });
}
