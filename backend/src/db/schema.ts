import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  varchar,
} from 'drizzle-orm/mysql-core';
import { BERECHTIGUNGEN, ZUSATZRECHTE } from '../shared/rechte/rechtematrix.js';

// Datenbankschema von Treaty. Aus dieser Datei erzeugt "pnpm db:generieren" die
// SQL-Migrationen in src/db/migrationen. Die Tabelle wird nie von Hand geändert,
// sondern immer hier und dann über eine neue Migration.
//
// Spaltennamen in der Datenbank sind snake_case (wie in der Konzeption),
// im TypeScript-Code camelCase.

// Gemeinsame Spalten jeder änderbaren Tabelle (Konzeption 6.1).
// Zeitpunkte sind UTC. Die Verbindung stellt dafür die Sitzungszeitzone auf +00:00.
const zeitstempel = {
  erstelltAm: datetime('erstellt_am', { mode: 'date', fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  // Setzt die Datenbank bei jeder Änderung selbst (ON UPDATE), auch bei Änderungen
  // außerhalb von Treaty, etwa per Hand oder durch die Altdatenübernahme.
  // Drizzle kennt dafür nur bei "timestamp" eine eigene Funktion, nicht bei "datetime".
  // Deshalb steht die ON-UPDATE-Klausel hier direkt im Standardwert. Drizzle übernimmt
  // den Text unverändert in die Migration.
  geaendertAm: datetime('geaendert_am', { mode: 'date', fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
};

// Optimistisches Sperren: Jede Änderung erhöht version um 1. Weicht die version beim
// Speichern vom gelesenen Stand ab, hat jemand anderes inzwischen geändert (409).
const version = int('version', { unsigned: true }).notNull().default(1);

// Benutzer (Konzeption 6.2, PRD Abschnitt 3)
export const benutzer = mysqlTable('benutzer', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  // Kürzel wie "DW". Eindeutig und nach der Anlage nicht mehr änderbar
  // (die Sperre gegen Änderung sitzt später im Dienst, nicht in der Datenbank).
  kuerzel: varchar('kuerzel', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwortHash: varchar('passwort_hash', { length: 255 }).notNull(),
  // Berechtigungsstufe. Gespeichert wird ein Code, die Anzeige
  // ("Administrator", "Sachbearbeiter/in") übernimmt die Oberfläche.
  // Werte aus der Rechtematrix (shared/rechte), damit es nur eine Liste gibt.
  berechtigung: mysqlEnum('berechtigung', BERECHTIGUNGEN).notNull(),
  // Zeichnungsart im Signaturblock: ppa., i.V., i.A. oder ohne (Code ohne Punkte).
  zeichnung: mysqlEnum('zeichnung', ['ppa', 'iv', 'ia', 'ohne']).notNull().default('ohne'),
  // Freie Bezeichnung bzw. Abteilung, nur für den Signaturblock, ohne Rechtewirkung.
  bezeichnung: varchar('bezeichnung', { length: 100 }),
  aktiv: boolean('aktiv').notNull().default(true),
  // true nach einem Einmalpasswort vom Administrator: Bei der nächsten Anmeldung muss
  // ein eigenes Passwort gesetzt werden, bevor etwas anderes möglich ist (Konzeption 9).
  passwortWechselNoetig: boolean('passwort_wechsel_noetig').notNull().default(false),
  // Zweiter Faktor per TOTP folgt später (Konzeption 9), das Feld ist schon vorgesehen.
  totpSecret: varchar('totp_secret', { length: 255 }),
  version,
  ...zeitstempel,
});

// Individuelle Zusatzrechte je Benutzer (Konzeption 6.2 und 8). Eine Zeile je Recht.
// Bewusst ohne Zeitstempel und Bearbeiter, weil die Vergabe laut PRD 3 nicht
// protokolliert wird (Abgleich A-17). Gleichzeitige Änderungen fängt die version des
// Benutzers ab, denn Zusatzrechte werden immer zusammen mit dem Benutzer gespeichert.
export const benutzerZusatzrecht = mysqlTable(
  'benutzer_zusatzrecht',
  {
    benutzerId: int('benutzer_id', { unsigned: true })
      .notNull()
      .references(() => benutzer.id, { onDelete: 'cascade' }),
    recht: mysqlEnum('recht', ZUSATZRECHTE).notNull(),
  },
  (t) => [primaryKey({ columns: [t.benutzerId, t.recht] })],
);

// Serverseitige Sitzungen (Konzeption 9). Der Browser bekommt nur ein zufälliges Token
// im Cookie. Gespeichert wird nicht das Token selbst, sondern sein SHA-256-Hash. Wer die
// Tabelle liest, kann damit keine Sitzung übernehmen. Eine beendete Sitzung wird
// gelöscht, das Sicherheitsprotokoll hält das Ende fest.
export const sitzung = mysqlTable(
  'sitzung',
  {
    // Fortlaufende Nummer, damit Administratoren eine Sitzung beenden können, ohne den
    // Token-Hash zu sehen.
    id: int('id', { unsigned: true }).autoincrement().primaryKey(),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    benutzerId: int('benutzer_id', { unsigned: true })
      .notNull()
      .references(() => benutzer.id, { onDelete: 'cascade' }),
    erstelltAm: datetime('erstellt_am', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    // Spätestes Ende, 12 Stunden nach der Anmeldung, unabhängig von der Aktivität.
    laeuftAbAm: datetime('laeuft_ab_am', { mode: 'date', fsp: 3 }).notNull(),
    // Endet zusätzlich nach 8 Stunden ohne Aktivität, gemessen ab diesem Zeitpunkt.
    letzteAktivitaetAm: datetime('letzte_aktivitaet_am', { mode: 'date', fsp: 3 }).notNull(),
    // IPv6 in Textform hat höchstens 45 Zeichen.
    ip: varchar('ip', { length: 45 }).notNull(),
    userAgent: varchar('user_agent', { length: 500 }),
  },
  (t) => [index('sitzung_laeuft_ab_am').on(t.laeuftAbAm)],
);

/** Ereignisse im Sicherheitsprotokoll (Entscheidung 16.10.2026). */
export const SICHERHEITSEREIGNISSE = [
  'anmeldung_erfolgreich',
  'anmeldung_fehlgeschlagen',
  'sperre',
  'passwort_geaendert',
  'einmalpasswort_vergeben',
  'sitzung_beendet',
] as const;

// Technisches Sicherheitsprotokoll, getrennt von der fachlichen Historie
// (Entscheidung 16.10.2026). Nur anfügen, nie ändern. Einträge werden nach 90 Tagen
// gelöscht, das übernimmt später der Worker (Merkposten). Änderungen an Rechten stehen
// hier bewusst nicht (PRD 3, Abgleich A-17).
export const sicherheitsprotokoll = mysqlTable(
  'sicherheitsprotokoll',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    zeitpunkt: datetime('zeitpunkt', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    ereignis: mysqlEnum('ereignis', SICHERHEITSEREIGNISSE).notNull(),
    // Betroffener Benutzer. Leer, wenn eine Anmeldung mit unbekanntem Kürzel scheitert.
    benutzerId: int('benutzer_id', { unsigned: true }).references(() => benutzer.id, {
      onDelete: 'set null',
    }),
    // Das eingegebene Kürzel bei einer Anmeldung, auch wenn es keinen Benutzer dazu gibt.
    // Länger als ein echtes Kürzel, damit auch Fehleingaben vollständig zu sehen sind.
    kuerzelEingabe: varchar('kuerzel_eingabe', { length: 50 }),
    // Wer das Ereignis ausgelöst hat, wenn es nicht die betroffene Person selbst war,
    // z. B. der Administrator, der ein Einmalpasswort vergibt oder eine Sitzung beendet.
    ausgeloestVonId: int('ausgeloest_von_id', { unsigned: true }).references(() => benutzer.id, {
      onDelete: 'set null',
    }),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    // Kurze Zusatzangabe, z. B. warum eine Sitzung endete (abgemeldet, abgelaufen,
    // durch Administrator, Konto gesperrt) oder wie lange eine Sperre gilt.
    grund: varchar('grund', { length: 100 }),
  },
  (t) => [
    index('sicherheitsprotokoll_zeitpunkt').on(t.zeitpunkt),
    index('sicherheitsprotokoll_benutzer').on(t.benutzerId, t.zeitpunkt),
  ],
);
