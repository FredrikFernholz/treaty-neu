import { sql } from 'drizzle-orm';
import { boolean, datetime, int, mysqlEnum, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

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
  berechtigung: mysqlEnum('berechtigung', ['administrator', 'sachbearbeiter']).notNull(),
  // Zeichnungsart im Signaturblock: ppa., i.V., i.A. oder ohne (Code ohne Punkte).
  zeichnung: mysqlEnum('zeichnung', ['ppa', 'iv', 'ia', 'ohne']).notNull().default('ohne'),
  // Freie Bezeichnung bzw. Abteilung, nur für den Signaturblock, ohne Rechtewirkung.
  bezeichnung: varchar('bezeichnung', { length: 100 }),
  aktiv: boolean('aktiv').notNull().default(true),
  // Zweiter Faktor per TOTP folgt später (Konzeption 9), das Feld ist schon vorgesehen.
  totpSecret: varchar('totp_secret', { length: 255 }),
  version,
  ...zeitstempel,
});
