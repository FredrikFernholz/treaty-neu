import { createHash, randomBytes } from 'node:crypto';
import { and, eq, lte, ne, or } from 'drizzle-orm';
import { benutzer, benutzerZusatzrecht, sitzung } from '../../db/schema.js';
import type { DbZugriff } from '../../db/zugriff.js';
import type { Berechtigung, Zusatzrecht } from '../../shared/rechte/rechtematrix.js';
import { kuerzen, protokolliere } from './sicherheitsprotokoll.js';

// Serverseitige Sitzungen (Konzeption 9).
//
// Bei der Anmeldung entsteht ein zufälliges Token aus 32 Bytes. Der Browser bekommt es
// im Sitzungscookie, die Datenbank speichert nur seinen SHA-256-Hash. Wer die Tabelle
// sitzung liest, kann damit keine Sitzung übernehmen.
//
// Eine Sitzung endet
//  - 8 Stunden nach der letzten Aktivität,
//  - spätestens 12 Stunden nach der Anmeldung, auch bei Aktivität,
//  - beim Abmelden, wenn ein Administrator sie beendet oder das Konto deaktiviert wird.
// Eine beendete Sitzung wird gelöscht. Das Sicherheitsprotokoll hält das Ende mit Grund
// fest.
//
// "jetzt" wird überall übergeben, damit Tests die Zeit vorgeben können.

export const INAKTIV_HOECHSTENS_MS = 8 * 60 * 60 * 1000;
export const SITZUNG_HOECHSTENS_MS = 12 * 60 * 60 * 1000;
// Die letzte Aktivität wird höchstens einmal pro Minute fortgeschrieben, damit nicht
// jede Anfrage einen Schreibzugriff auf die Datenbank auslöst. Die 8 Stunden können
// sich dadurch um bis zu eine Minute verkürzen.
export const AKTIVITAET_FORTSCHREIBEN_AB_MS = 60 * 1000;

/** Gründe für das Ende einer Sitzung, wie sie im Sicherheitsprotokoll stehen. */
export type Sitzungsende = 'abgemeldet' | 'inaktiv' | 'hoechstdauer' | 'durch_administrator' | 'konto_deaktiviert' | 'passwort_geaendert';

/** Was nach einer gültigen Sitzung über die angemeldete Person bekannt ist. */
export type Angemeldet = {
  sitzungId: number;
  benutzerId: number;
  kuerzel: string;
  name: string;
  berechtigung: Berechtigung;
  zusatzrechte: Zusatzrecht[];
  passwortWechselNoetig: boolean;
};

type Herkunft = { ip: string; userAgent?: string | null };

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Legt eine neue Sitzung an und gibt das Token zurück. Das Token gibt es nur hier, es
 * wird nirgends gespeichert und muss sofort ins Cookie.
 */
export async function erzeugeSitzung(
  db: DbZugriff,
  benutzerId: number,
  herkunft: Herkunft,
  jetzt: Date,
): Promise<{ token: string; laeuftAbAm: Date }> {
  const token = randomBytes(32).toString('base64url');
  const laeuftAbAm = new Date(jetzt.getTime() + SITZUNG_HOECHSTENS_MS);
  await db.insert(sitzung).values({
    tokenHash: hashToken(token),
    benutzerId,
    erstelltAm: jetzt,
    laeuftAbAm,
    letzteAktivitaetAm: jetzt,
    ip: kuerzen(herkunft.ip, 45) ?? '',
    userAgent: kuerzen(herkunft.userAgent, 500),
  });
  return { token, laeuftAbAm };
}

/** Warum eine Sitzung zu "jetzt" nicht mehr gilt, oder null, wenn sie noch gilt. */
function ablaufgrund(
  s: { laeuftAbAm: Date; letzteAktivitaetAm: Date },
  jetzt: Date,
): 'inaktiv' | 'hoechstdauer' | null {
  if (jetzt.getTime() >= s.laeuftAbAm.getTime()) return 'hoechstdauer';
  if (jetzt.getTime() - s.letzteAktivitaetAm.getTime() >= INAKTIV_HOECHSTENS_MS) return 'inaktiv';
  return null;
}

/**
 * Prüft das Token aus dem Cookie. Gilt die Sitzung, wird die Aktivität fortgeschrieben
 * und die angemeldete Person zurückgegeben. Sonst null. Eine abgelaufene Sitzung und
 * die Sitzung eines deaktivierten Kontos werden dabei gleich gelöscht.
 */
export async function pruefeSitzung(
  db: DbZugriff,
  token: string,
  jetzt: Date,
): Promise<Angemeldet | null> {
  const [treffer] = await db
    .select({
      sitzungId: sitzung.id,
      laeuftAbAm: sitzung.laeuftAbAm,
      letzteAktivitaetAm: sitzung.letzteAktivitaetAm,
      ip: sitzung.ip,
      userAgent: sitzung.userAgent,
      benutzerId: benutzer.id,
      kuerzel: benutzer.kuerzel,
      name: benutzer.name,
      berechtigung: benutzer.berechtigung,
      aktiv: benutzer.aktiv,
      passwortWechselNoetig: benutzer.passwortWechselNoetig,
    })
    .from(sitzung)
    .innerJoin(benutzer, eq(sitzung.benutzerId, benutzer.id))
    .where(eq(sitzung.tokenHash, hashToken(token)))
    .limit(1);
  if (!treffer) return null;

  const grund = treffer.aktiv ? ablaufgrund(treffer, jetzt) : 'konto_deaktiviert';
  if (grund !== null) {
    await loescheUndProtokolliere(db, [treffer], grund, jetzt, null);
    return null;
  }

  if (jetzt.getTime() - treffer.letzteAktivitaetAm.getTime() >= AKTIVITAET_FORTSCHREIBEN_AB_MS) {
    await db.update(sitzung).set({ letzteAktivitaetAm: jetzt }).where(eq(sitzung.id, treffer.sitzungId));
  }

  const rechte = await db
    .select({ recht: benutzerZusatzrecht.recht })
    .from(benutzerZusatzrecht)
    .where(eq(benutzerZusatzrecht.benutzerId, treffer.benutzerId));

  return {
    sitzungId: treffer.sitzungId,
    benutzerId: treffer.benutzerId,
    kuerzel: treffer.kuerzel,
    name: treffer.name,
    berechtigung: treffer.berechtigung,
    zusatzrechte: rechte.map((r) => r.recht),
    passwortWechselNoetig: treffer.passwortWechselNoetig,
  };
}

type ZuBeenden = { sitzungId: number; benutzerId: number; ip: string; userAgent: string | null };

/**
 * Beendet die Sitzungen einzeln. Löschen und Protokolleintrag laufen je Sitzung in einer
 * gemeinsamen Transaktion. Protokolliert wird nur, wenn das Löschen die Zeile wirklich
 * entfernt hat. Prüfen zwei Anfragen gleichzeitig dieselbe abgelaufene Sitzung, wartet
 * die zweite auf die Zeilensperre der ersten, löscht danach nichts mehr und schreibt
 * deshalb keinen zweiten Eintrag. Ist db schon eine Transaktion, wird daraus ein
 * Sicherungspunkt innerhalb dieser Transaktion.
 */
async function loescheUndProtokolliere(
  db: DbZugriff,
  sitzungen: ZuBeenden[],
  grund: Sitzungsende,
  jetzt: Date,
  ausgeloestVonId: number | null,
): Promise<void> {
  for (const s of sitzungen) {
    await db.transaction(async (tx) => {
      const [ergebnis] = await tx.delete(sitzung).where(eq(sitzung.id, s.sitzungId));
      if (ergebnis.affectedRows === 0) return; // schon von einer anderen Anfrage beendet
      await protokolliere(tx, {
        ereignis: 'sitzung_beendet',
        zeitpunkt: jetzt,
        benutzerId: s.benutzerId,
        ausgeloestVonId,
        ip: s.ip,
        userAgent: s.userAgent,
        grund,
      });
    });
  }
}

const auswahlZumBeenden = {
  sitzungId: sitzung.id,
  benutzerId: sitzung.benutzerId,
  ip: sitzung.ip,
  userAgent: sitzung.userAgent,
};

/** Abmelden: beendet die Sitzung zum Token. Ein unbekanntes Token ändert nichts. */
export async function beendeSitzung(db: DbZugriff, token: string, jetzt: Date): Promise<void> {
  const treffer = await db.select(auswahlZumBeenden).from(sitzung).where(eq(sitzung.tokenHash, hashToken(token)));
  await loescheUndProtokolliere(db, treffer, 'abgemeldet', jetzt, null);
}

/** Ein Administrator beendet eine einzelne Sitzung eines anderen Benutzers. */
export async function beendeSitzungNachId(
  db: DbZugriff,
  sitzungId: number,
  administratorId: number,
  jetzt: Date,
): Promise<void> {
  const treffer = await db.select(auswahlZumBeenden).from(sitzung).where(eq(sitzung.id, sitzungId));
  await loescheUndProtokolliere(db, treffer, 'durch_administrator', jetzt, administratorId);
}

/**
 * Beendet alle Sitzungen eines Benutzers (Entscheidung 16.10.2026):
 *  - Konto deaktiviert oder Einmalpasswort durch einen Administrator: alle Sitzungen,
 *    ausgeloestVonId ist dann der Administrator.
 *  - eigenes Passwort geändert, auch beim Pflichtwechsel nach einem Einmalpasswort:
 *    alle anderen Sitzungen, die aktuelle bleibt (ausserSitzungId).
 */
export async function beendeAlleSitzungen(
  db: DbZugriff,
  benutzerId: number,
  grund: Sitzungsende,
  jetzt: Date,
  optionen: { ausgeloestVonId?: number | null; ausserSitzungId?: number } = {},
): Promise<void> {
  const nurDieserBenutzer = eq(sitzung.benutzerId, benutzerId);
  const bedingung =
    optionen.ausserSitzungId === undefined
      ? nurDieserBenutzer
      : and(nurDieserBenutzer, ne(sitzung.id, optionen.ausserSitzungId));
  const treffer = await db.select(auswahlZumBeenden).from(sitzung).where(bedingung);
  await loescheUndProtokolliere(db, treffer, grund, jetzt, optionen.ausgeloestVonId ?? null);
}

/**
 * Löscht alle abgelaufenen Sitzungen. Später ein regelmäßiger Auftrag des Workers,
 * bis dahin genügt es, dass pruefeSitzung abgelaufene Sitzungen beim nächsten Zugriff
 * entfernt.
 */
export async function raeumeAbgelaufeneAuf(db: DbZugriff, jetzt: Date): Promise<number> {
  const inaktivSeit = new Date(jetzt.getTime() - INAKTIV_HOECHSTENS_MS);
  const treffer = await db
    .select({ ...auswahlZumBeenden, laeuftAbAm: sitzung.laeuftAbAm, letzteAktivitaetAm: sitzung.letzteAktivitaetAm })
    .from(sitzung)
    .where(or(lte(sitzung.laeuftAbAm, jetzt), lte(sitzung.letzteAktivitaetAm, inaktivSeit)));
  for (const s of treffer) {
    await loescheUndProtokolliere(db, [s], ablaufgrund(s, jetzt) ?? 'inaktiv', jetzt, null);
  }
  return treffer.length;
}
