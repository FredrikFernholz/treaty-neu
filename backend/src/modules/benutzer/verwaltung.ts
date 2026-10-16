import { and, eq, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { benutzer, benutzerZusatzrecht, sitzung } from '../../db/schema.js';
import type { DbZugriff } from '../../db/zugriff.js';
import type { ApiFehlercode } from '../../shared/schemas/api-fehler.js';
import { RESERVIERTE_KUERZEL, type BenutzerDetail, type benutzerAendernSchema, type benutzerAnlegenSchema } from '../../shared/schemas/benutzer.js';
import { schlageKuerzelVor } from '../../shared/regeln/kuerzel.js';
import { erzeugeEinmalpasswort } from '../anmeldung/einmalpasswort.js';
import { hashePasswort } from '../anmeldung/passwort-hash.js';
import { protokolliere } from '../anmeldung/sicherheitsprotokoll.js';
import { beendeAlleSitzungen, beendeSitzungNachId, type Angemeldet } from '../anmeldung/sitzungen.js';
import { ladeBenutzer } from './benutzer.js';

// Anlegen, Ändern, Deaktivieren, Einmalpasswort und Sitzungen beenden (Teilschritte 9b
// und 9c, Entscheidungen 16.10.2026).
//
// Wer darf was (Abgleich A-19):
//  - Administratoren dürfen alles, außer die eigene Berechtigungsstufe herabsetzen.
//  - Sachbearbeiter/innen mit dem Zusatzrecht nutzerverwaltung verwalten nur
//    Sachbearbeiter/innen und nicht sich selbst. Sie können niemanden zum Administrator
//    machen und keine Zusatzrechte vergeben oder entziehen.
//  - Niemand kann sich selbst deaktivieren.
//  - Der letzte aktive Administrator kann weder herabgestuft noch deaktiviert werden.
// Das Kürzel ist nach dem Anlegen unveränderlich (Konzeption 6.2).
// Änderungen an Berechtigungsstufe und Zusatzrechten werden nicht protokolliert (PRD 3,
// Abgleich A-17). Sie wirken sofort, weil jede Anfrage die Rechte frisch liest.

/** Fehler mit HTTP-Status und Code für die Antwort. */
export class Verwaltungsfehler extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiFehlercode,
    meldung: string,
  ) {
    super(meldung);
  }
}

type Handelnder = Pick<Angemeldet, 'benutzerId' | 'berechtigung'>;
type Anlegen = z.output<typeof benutzerAnlegenSchema>;
type Aendern = z.output<typeof benutzerAendernSchema>;

const nurAdministratoren = (meldung: string) => new Verwaltungsfehler(403, 'kein_zugriff', meldung);

function istDoppelteingabe(fehler: unknown): boolean {
  return (fehler as { code?: string })?.code === 'ER_DUP_ENTRY' || (fehler as { cause?: { code?: string } })?.cause?.code === 'ER_DUP_ENTRY';
}

/** Kürzelvorschlag zum Namen, unter Ausschluss aller vergebenen und reservierten Kürzel. */
export async function kuerzelVorschlag(db: DbZugriff, name: string): Promise<string | null> {
  const vergeben = await db.select({ kuerzel: benutzer.kuerzel }).from(benutzer);
  return schlageKuerzelVor(name, new Set([...RESERVIERTE_KUERZEL, ...vergeben.map((b) => b.kuerzel.toUpperCase())]));
}

/** Prüft, ob Kürzel oder E-Mail-Adresse schon einem anderen Benutzer gehören. */
async function pruefeEindeutig(db: DbZugriff, angaben: { kuerzel?: string; email: string }, ausserId?: number) {
  const andere = ausserId === undefined ? undefined : ne(benutzer.id, ausserId);
  if (angaben.kuerzel !== undefined) {
    const [k] = await db.select({ id: benutzer.id }).from(benutzer).where(and(eq(benutzer.kuerzel, angaben.kuerzel), andere));
    if (k) throw new Verwaltungsfehler(409, 'bereits_vergeben', `Das Kürzel ${angaben.kuerzel} ist bereits vergeben.`);
  }
  const [e] = await db.select({ id: benutzer.id }).from(benutzer).where(and(eq(benutzer.email, angaben.email), andere));
  if (e) throw new Verwaltungsfehler(409, 'bereits_vergeben', `Die E-Mail-Adresse ${angaben.email} ist bereits vergeben.`);
}

function pruefeZusatzrechteZurStufe(eingabe: { berechtigung: string; zusatzrechte: string[] }) {
  if (eingabe.berechtigung === 'administrator' && eingabe.zusatzrechte.length > 0) {
    throw new Verwaltungsfehler(400, 'ungueltige_eingabe', 'Administratoren haben alle Rechte und brauchen keine Zusatzrechte.');
  }
}

/** Legt einen Benutzer mit Einmalpasswort an. Das Einmalpasswort gibt es nur in der Rückgabe. */
export async function legeBenutzerAn(
  db: DbZugriff,
  handelnder: Handelnder,
  eingabe: Anlegen,
  herkunft: { ip: string; userAgent: string | null },
  jetzt: Date,
): Promise<{ benutzer: BenutzerDetail; einmalpasswort: string }> {
  if (handelnder.berechtigung !== 'administrator') {
    if (eingabe.berechtigung !== 'sachbearbeiter') throw nurAdministratoren('Nur Administratoren können Administratoren anlegen.');
    if (eingabe.zusatzrechte.length > 0) throw nurAdministratoren('Nur Administratoren können Zusatzrechte vergeben.');
  }
  pruefeZusatzrechteZurStufe(eingabe);

  const einmalpasswort = erzeugeEinmalpasswort();
  const passwortHash = await hashePasswort(einmalpasswort);

  try {
    const id = await db.transaction(async (tx) => {
      await pruefeEindeutig(tx, eingabe);
      const [angelegt] = await tx
        .insert(benutzer)
        .values({
          kuerzel: eingabe.kuerzel,
          name: eingabe.name,
          email: eingabe.email,
          passwortHash,
          berechtigung: eingabe.berechtigung,
          zeichnung: eingabe.zeichnung,
          bezeichnung: eingabe.bezeichnung,
          passwortWechselNoetig: true,
        })
        .$returningId();
      if (!angelegt) throw new Error('Benutzer wurde nicht angelegt');
      if (eingabe.zusatzrechte.length > 0) {
        await tx.insert(benutzerZusatzrecht).values(eingabe.zusatzrechte.map((recht) => ({ benutzerId: angelegt.id, recht })));
      }
      await protokolliere(tx, {
        ereignis: 'einmalpasswort_vergeben',
        zeitpunkt: jetzt,
        benutzerId: angelegt.id,
        ausgeloestVonId: handelnder.benutzerId,
        ...herkunft,
        grund: 'neu angelegt',
      });
      return angelegt.id;
    });
    const angelegt = await ladeBenutzer(db, id);
    if (!angelegt) throw new Error('Angelegter Benutzer nicht gefunden');
    return { benutzer: angelegt, einmalpasswort };
  } catch (fehler) {
    // Gleichzeitige Anlage mit demselben Kürzel: die Eindeutigkeitsregel der Datenbank greift
    if (istDoppelteingabe(fehler)) throw new Verwaltungsfehler(409, 'bereits_vergeben', 'Kürzel oder E-Mail-Adresse ist bereits vergeben.');
    throw fehler;
  }
}

/** Ändert Stammdaten, Berechtigungsstufe und Zusatzrechte. Das Kürzel bleibt. */
export async function aendereBenutzer(
  db: DbZugriff,
  handelnder: Handelnder,
  id: number,
  eingabe: Aendern,
): Promise<BenutzerDetail> {
  await db.transaction(async (tx) => {
    // Zeile sperren, bis die Transaktion endet, damit niemand dazwischen ändert.
    const [ziel] = await tx.select().from(benutzer).where(eq(benutzer.id, id)).for('update');
    if (!ziel) throw new Verwaltungsfehler(404, 'nicht_gefunden', 'Diesen Benutzer gibt es nicht.');
    if (ziel.version !== eingabe.version) {
      throw new Verwaltungsfehler(409, 'konflikt', 'Der Benutzer wurde inzwischen geändert. Bitte neu laden.');
    }

    const bisherigeRechte = (
      await tx.select({ recht: benutzerZusatzrecht.recht }).from(benutzerZusatzrecht).where(eq(benutzerZusatzrecht.benutzerId, id))
    ).map((r) => r.recht);
    const rechteGeaendert =
      bisherigeRechte.length !== eingabe.zusatzrechte.length || bisherigeRechte.some((r) => !eingabe.zusatzrechte.includes(r));
    const istSelbst = ziel.id === handelnder.benutzerId;

    if (handelnder.berechtigung !== 'administrator') {
      if (ziel.berechtigung === 'administrator') throw nurAdministratoren('Administratoren kann nur ein Administrator bearbeiten.');
      if (istSelbst) throw nurAdministratoren('Die eigenen Angaben kann nur ein Administrator ändern.');
      if (eingabe.berechtigung !== 'sachbearbeiter') throw nurAdministratoren('Nur Administratoren können jemanden zum Administrator machen.');
      if (rechteGeaendert) throw nurAdministratoren('Nur Administratoren können Zusatzrechte vergeben oder entziehen.');
    }
    pruefeZusatzrechteZurStufe(eingabe);

    const wirdHerabgestuft = ziel.berechtigung === 'administrator' && eingabe.berechtigung !== 'administrator';
    if (wirdHerabgestuft && istSelbst) {
      throw new Verwaltungsfehler(403, 'nicht_erlaubt', 'Die eigene Berechtigungsstufe kann nicht herabgesetzt werden.');
    }
    if (wirdHerabgestuft && ziel.aktiv) {
      const andereAdmins = await tx
        .select({ id: benutzer.id })
        .from(benutzer)
        .where(and(eq(benutzer.berechtigung, 'administrator'), eq(benutzer.aktiv, true), ne(benutzer.id, id)))
        .for('update');
      if (andereAdmins.length === 0) {
        throw new Verwaltungsfehler(403, 'nicht_erlaubt', 'Der letzte aktive Administrator kann nicht herabgestuft werden.');
      }
    }

    await pruefeEindeutig(tx, { email: eingabe.email }, id);

    await tx
      .update(benutzer)
      .set({
        name: eingabe.name,
        email: eingabe.email,
        berechtigung: eingabe.berechtigung,
        zeichnung: eingabe.zeichnung,
        bezeichnung: eingabe.bezeichnung,
        version: sql`${benutzer.version} + 1`,
      })
      .where(and(eq(benutzer.id, id), eq(benutzer.version, eingabe.version)));

    if (rechteGeaendert) {
      await tx.delete(benutzerZusatzrecht).where(eq(benutzerZusatzrecht.benutzerId, id));
      if (eingabe.zusatzrechte.length > 0) {
        await tx.insert(benutzerZusatzrecht).values(eingabe.zusatzrechte.map((recht) => ({ benutzerId: id, recht })));
      }
    }
  });

  const geaendert = await ladeBenutzer(db, id);
  if (!geaendert) throw new Error('Geänderter Benutzer nicht gefunden');
  return geaendert;
}

type Herkunft = { ip: string; userAgent: string | null };

/**
 * Prüft, ob die handelnde Person die Zielperson verwalten darf (Abgleich A-19).
 * Administratoren dürfen jeden, mit dem Zusatzrecht nutzerverwaltung nur
 * Sachbearbeiter/innen und nicht sich selbst.
 */
function pruefeVerwaltbar(handelnder: Handelnder, ziel: { id: number; berechtigung: string }, aktion: string) {
  if (handelnder.berechtigung === 'administrator') return;
  if (ziel.berechtigung === 'administrator') throw nurAdministratoren(`Einen Administrator kann nur ein Administrator ${aktion}.`);
  if (ziel.id === handelnder.benutzerId) throw nurAdministratoren(`Das eigene Konto kann nur ein Administrator ${aktion}.`);
}

async function ladeGesperrt(tx: DbZugriff, id: number) {
  const [ziel] = await tx.select().from(benutzer).where(eq(benutzer.id, id)).for('update');
  if (!ziel) throw new Verwaltungsfehler(404, 'nicht_gefunden', 'Diesen Benutzer gibt es nicht.');
  return ziel;
}

/**
 * Deaktiviert oder aktiviert ein Konto (Entscheidung 16.10.2026: Benutzer werden nie
 * gelöscht). Beim Deaktivieren enden sofort alle Sitzungen des Kontos.
 */
export async function setzeAktiv(
  db: DbZugriff,
  handelnder: Handelnder,
  id: number,
  eingabe: { aktiv: boolean; version: number },
  jetzt: Date,
): Promise<BenutzerDetail> {
  await db.transaction(async (tx) => {
    const ziel = await ladeGesperrt(tx, id);
    if (ziel.version !== eingabe.version) {
      throw new Verwaltungsfehler(409, 'konflikt', 'Der Benutzer wurde inzwischen geändert. Bitte neu laden.');
    }
    pruefeVerwaltbar(handelnder, ziel, eingabe.aktiv ? 'aktivieren' : 'deaktivieren');

    if (!eingabe.aktiv && ziel.aktiv) {
      if (ziel.id === handelnder.benutzerId) {
        throw new Verwaltungsfehler(403, 'nicht_erlaubt', 'Das eigene Konto kann nicht deaktiviert werden.');
      }
      if (ziel.berechtigung === 'administrator') {
        const andereAdmins = await tx
          .select({ id: benutzer.id })
          .from(benutzer)
          .where(and(eq(benutzer.berechtigung, 'administrator'), eq(benutzer.aktiv, true), ne(benutzer.id, id)))
          .for('update');
        if (andereAdmins.length === 0) {
          throw new Verwaltungsfehler(403, 'nicht_erlaubt', 'Der letzte aktive Administrator kann nicht deaktiviert werden.');
        }
      }
    }

    await tx
      .update(benutzer)
      .set({ aktiv: eingabe.aktiv, version: sql`${benutzer.version} + 1` })
      .where(and(eq(benutzer.id, id), eq(benutzer.version, eingabe.version)));
    if (!eingabe.aktiv) {
      await beendeAlleSitzungen(tx, id, 'konto_deaktiviert', jetzt, { ausgeloestVonId: handelnder.benutzerId });
    }
  });
  const ergebnis = await ladeBenutzer(db, id);
  if (!ergebnis) throw new Error('Benutzer nicht gefunden');
  return ergebnis;
}

/**
 * Vergibt ein neues Einmalpasswort (Konzeption 9). Das bisherige Passwort gilt danach
 * nicht mehr, bei der nächsten Anmeldung ist ein Passwortwechsel nötig, und alle
 * Sitzungen des Kontos enden (Entscheidung 16.10.2026). Das eigene Konto ist
 * ausgeschlossen, dafür gibt es den Passwortwechsel.
 */
export async function vergibEinmalpasswort(
  db: DbZugriff,
  handelnder: Handelnder,
  id: number,
  herkunft: Herkunft,
  jetzt: Date,
): Promise<{ einmalpasswort: string; kuerzel: string }> {
  const einmalpasswort = erzeugeEinmalpasswort();
  const passwortHash = await hashePasswort(einmalpasswort);
  const kuerzel = await db.transaction(async (tx) => {
    const ziel = await ladeGesperrt(tx, id);
    pruefeVerwaltbar(handelnder, ziel, 'mit einem Einmalpasswort versehen');
    if (ziel.id === handelnder.benutzerId) {
      throw new Verwaltungsfehler(403, 'nicht_erlaubt', 'Für das eigene Konto bitte das Passwort ändern statt ein Einmalpasswort zu vergeben.');
    }
    await tx
      .update(benutzer)
      .set({ passwortHash, passwortWechselNoetig: true, version: sql`${benutzer.version} + 1` })
      .where(eq(benutzer.id, id));
    await beendeAlleSitzungen(tx, id, 'einmalpasswort', jetzt, { ausgeloestVonId: handelnder.benutzerId });
    await protokolliere(tx, {
      ereignis: 'einmalpasswort_vergeben',
      zeitpunkt: jetzt,
      benutzerId: id,
      ausgeloestVonId: handelnder.benutzerId,
      ...herkunft,
      grund: 'neu vergeben',
    });
    return ziel.kuerzel;
  });
  return { einmalpasswort, kuerzel };
}

/** Beendet eine einzelne Sitzung eines Benutzers aus der Nutzerverwaltung heraus. */
export async function beendeSitzungDurchVerwaltung(
  db: DbZugriff,
  handelnder: Handelnder,
  benutzerId: number,
  sitzungId: number,
  jetzt: Date,
): Promise<void> {
  const [ziel] = await db.select().from(benutzer).where(eq(benutzer.id, benutzerId));
  if (!ziel) throw new Verwaltungsfehler(404, 'nicht_gefunden', 'Diesen Benutzer gibt es nicht.');
  pruefeVerwaltbar(handelnder, ziel, 'abmelden');
  const [s] = await db
    .select({ id: sitzung.id })
    .from(sitzung)
    .where(and(eq(sitzung.id, sitzungId), eq(sitzung.benutzerId, benutzerId)));
  if (!s) throw new Verwaltungsfehler(404, 'nicht_gefunden', 'Diese Sitzung gibt es nicht (mehr).');
  await beendeSitzungNachId(db, sitzungId, handelnder.benutzerId, jetzt);
}
