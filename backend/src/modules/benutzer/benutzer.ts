import { asc, desc, eq, inArray } from 'drizzle-orm';
import { benutzer, benutzerZusatzrecht, sitzung } from '../../db/schema.js';
import type { DbZugriff } from '../../db/zugriff.js';
import type { Zusatzrecht } from '../../shared/rechte/rechtematrix.js';
import type { Benutzer, BenutzerAuswahl, BenutzerDetail } from '../../shared/schemas/benutzer.js';

// Lesende Abfragen der Benutzerverwaltung (Teilschritt 9a).
//
// Ausgewählt werden die Spalten einzeln. Passwort-Hash und TOTP-Geheimnis werden so gar
// nicht erst gelesen und können nicht versehentlich in einer Antwort landen.

const spalten = {
  id: benutzer.id,
  kuerzel: benutzer.kuerzel,
  name: benutzer.name,
  email: benutzer.email,
  berechtigung: benutzer.berechtigung,
  zeichnung: benutzer.zeichnung,
  bezeichnung: benutzer.bezeichnung,
  aktiv: benutzer.aktiv,
  passwortWechselNoetig: benutzer.passwortWechselNoetig,
  version: benutzer.version,
};

/**
 * Zusatzrechte je Benutzer-id, in der Reihenfolge von ZUSATZRECHTE (Rechtematrix). MySQL
 * sortiert eine ENUM-Spalte nach der Reihenfolge ihrer Definition, nicht alphabetisch.
 */
async function zusatzrechteVon(db: DbZugriff, ids: number[]): Promise<Map<number, Zusatzrecht[]>> {
  const ergebnis = new Map<number, Zusatzrecht[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return ergebnis;
  const zeilen = await db
    .select()
    .from(benutzerZusatzrecht)
    .where(inArray(benutzerZusatzrecht.benutzerId, ids))
    .orderBy(asc(benutzerZusatzrecht.recht));
  for (const z of zeilen) ergebnis.get(z.benutzerId)?.push(z.recht);
  return ergebnis;
}

/** Alle Benutzer für die Nutzerverwaltung. Deaktivierte stehen immer am Ende, sonst nach Name. */
export async function listeBenutzer(db: DbZugriff): Promise<Benutzer[]> {
  const zeilen = await db.select(spalten).from(benutzer).orderBy(desc(benutzer.aktiv), asc(benutzer.name));
  const rechte = await zusatzrechteVon(db, zeilen.map((z) => z.id));
  return zeilen.map((z) => ({ ...z, zusatzrechte: rechte.get(z.id) ?? [] }));
}

/** Ein Benutzer mit seinen laufenden Sitzungen, oder null. */
export async function ladeBenutzer(db: DbZugriff, id: number): Promise<BenutzerDetail | null> {
  const [zeile] = await db.select(spalten).from(benutzer).where(eq(benutzer.id, id)).limit(1);
  if (!zeile) return null;
  const rechte = await zusatzrechteVon(db, [id]);
  const sitzungen = await db
    .select({
      id: sitzung.id,
      erstelltAm: sitzung.erstelltAm,
      letzteAktivitaetAm: sitzung.letzteAktivitaetAm,
      laeuftAbAm: sitzung.laeuftAbAm,
      ip: sitzung.ip,
      userAgent: sitzung.userAgent,
    })
    .from(sitzung)
    .where(eq(sitzung.benutzerId, id))
    .orderBy(desc(sitzung.letzteAktivitaetAm));
  return {
    ...zeile,
    zusatzrechte: rechte.get(id) ?? [],
    sitzungen: sitzungen.map((s) => ({
      ...s,
      erstelltAm: s.erstelltAm.toISOString(),
      letzteAktivitaetAm: s.letzteAktivitaetAm.toISOString(),
      laeuftAbAm: s.laeuftAbAm.toISOString(),
      // Welche Sitzung zur Anfrage gehört, weiß nur die Route. Sie setzt das Feld mit
      // markiereAktuelleSitzung (routen.ts).
      aktuell: false,
    })),
  };
}

/**
 * Aktive Benutzer für Auswahllisten wie „Zugewiesen an“ oder Follower (Konzeption 8).
 * Nur id, Kürzel und Name, keine Berechtigungen, keine E-Mail.
 */
export async function benutzerAuswahl(db: DbZugriff): Promise<BenutzerAuswahl[]> {
  return db
    .select({ id: benutzer.id, kuerzel: benutzer.kuerzel, name: benutzer.name })
    .from(benutzer)
    .where(eq(benutzer.aktiv, true))
    .orderBy(asc(benutzer.kuerzel));
}
