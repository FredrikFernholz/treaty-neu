-- ============================================================================
-- Treaty Backend – Datenbankschema (MySQL/MariaDB, InnoDB, utf8mb4)
-- ============================================================================
-- Abgeleitet 1:1 aus der bestehenden Felddokumentation (Treaty_2.0_Felddokumentation.xlsx)
-- und aus den Feldern des Klick-Prototyps (mockdata.py). Feste Auswahllisten, die im
-- Prototyp nur als einfache String-Arrays vorkommen und nicht selbst vom Nutzer verwaltet
-- werden (Status-Optionen, Aufgaben-Typen als Bezeichnung, Zeichnungsarten, PLZ/Ort-
-- Nachschlageliste), werden bewusst NICHT als eigene Tabellen abgebildet, sondern als
-- Konstanten im Anwendungscode gepflegt (siehe src/Konstanten.php) - das entspricht genau
-- der bisherigen Modellierung und vermeidet unnötige Tabellen für reine Wertelisten.
--
-- Zusatzrechte (siehe mitarbeiter_zusatzrechte) sind laut fachlicher Entscheidung bewusst
-- NICHT protokollpflichtig - diese Tabelle trägt daher absichtlich keine Verlaufs-/
-- Protokollspalten (kein geaendert_von, kein geaendert_am), nur den aktuellen Stand.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Mitarbeiter (Nutzerverwaltung)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mitarbeiter (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kuerzel         VARCHAR(8)   NOT NULL,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(190) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  berechtigung    ENUM('Administrator','Sachbearbeiter/in') NOT NULL DEFAULT 'Sachbearbeiter/in',
  zeichnung       ENUM('ppa.','i.V.','i.A.','ohne') NOT NULL DEFAULT 'ohne',
  bezeichnung     VARCHAR(160) NULL,
  aktiv           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mitarbeiter_kuerzel (kuerzel),
  UNIQUE KEY uq_mitarbeiter_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individuelle Zusatzrechte je Mitarbeiter (additiv zur Rechtematrix, siehe src/Rechte.php).
-- bereich_key-Werte entsprechen exakt ZUSATZRECHTE_OPTIONEN aus dem Prototyp (part3_core.js) -
-- "kunden", nicht "kundenverwaltung" (das ist nur das Label). Bewusst OHNE jede Audit-/
-- Protokoll-Spalte (kein geaendert_von/geaendert_am) - die Vergabe von Zusatzrechten ist laut
-- fachlicher Vorgabe nicht protokollpflichtig (siehe PRD Abschnitt 3).
CREATE TABLE IF NOT EXISTS mitarbeiter_zusatzrechte (
  mitarbeiter_id  INT UNSIGNED NOT NULL,
  bereich_key     ENUM('buchhaltung','leistungskatalog','kunden','nutzerverwaltung',
                       'auswertungen','zeiterfassung_alle') NOT NULL,
  PRIMARY KEY (mitarbeiter_id, bereich_key),
  CONSTRAINT fk_zr_mitarbeiter FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Mandanten (Kundenverwaltung) + Leistungskatalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mandanten (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                    VARCHAR(160) NOT NULL,
  kuerzel                 VARCHAR(8)   NULL,
  adresse                 VARCHAR(255) NULL,
  ansprechpartner         VARCHAR(120) NULL,
  email                   VARCHAR(190) NULL,
  telefon                 VARCHAR(60)  NULL,
  kunde_seit              VARCHAR(4)   NULL,
  vertrag_beginn          DATE         NULL,
  vertrag_laufzeit        VARCHAR(120) NULL,
  vertrag_kuendigungsfrist VARCHAR(120) NULL,
  vertrag_status          ENUM('Aktiv','In Verhandlung','Pausiert') NOT NULL DEFAULT 'Aktiv',
  reisekosten_kappung     DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mandanten_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ansprechpersonen beim Mandanten (MDT_KONTAKTE im Prototyp) - Auswahlliste für "Bearbeiter bei MDT".
CREATE TABLE IF NOT EXISTS mandant_kontakte (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mandant_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(190) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_mk_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zentraler Leistungskatalog: Stammdaten je Aufgabentyp mit Standardpreis/-typ/-häufigkeit.
CREATE TABLE IF NOT EXISTS leistungskatalog (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  modul        VARCHAR(120) NOT NULL,
  price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  type         ENUM('%','Stundensatz','Prüfgebühr','Pauschale','Intern') NOT NULL,
  haeufigkeit  ENUM('Monat','Jahr','Einmalig','-') NOT NULL DEFAULT '-',
  PRIMARY KEY (id),
  UNIQUE KEY uq_leistungskatalog_modul (modul)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Je Mandant individuell vereinbarte Module aus dem Leistungskatalog samt tatsächlich
-- vereinbartem Preis (kann vom Standardpreis abweichen) und Aktiv-Status.
CREATE TABLE IF NOT EXISTS mandant_leistungen (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mandant_id          INT UNSIGNED NOT NULL,
  leistungskatalog_id INT UNSIGNED NOT NULL,
  aktiv               TINYINT(1) NOT NULL DEFAULT 1,
  price               DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mandant_leistung (mandant_id, leistungskatalog_id),
  CONSTRAINT fk_ml_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE CASCADE,
  CONSTRAINT fk_ml_leistung FOREIGN KEY (leistungskatalog_id) REFERENCES leistungskatalog(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Hausverwaltungen (Counterparts) + deren Ansprechpersonen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS counterparts (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name     VARCHAR(160) NOT NULL,
  email    VARCHAR(190) NULL,
  adresse  VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_counterparts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS counterpart_kontakte (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  counterpart_id INT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(190) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_ck_counterpart FOREIGN KEY (counterpart_id) REFERENCES counterparts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Standorte (Stammdaten je Standort-Nr., von Betriebskosten und Mieten gemeinsam genutzt)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standorte (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nr          VARCHAR(16)  NOT NULL,
  ort         VARCHAR(120) NOT NULL,
  plz         VARCHAR(12)  NULL,
  mandant_id  INT UNSIGNED NULL,
  adresse     VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_standorte_nr (nr),
  CONSTRAINT fk_standorte_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Betriebskosten (Modul Betriebskosten)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS betriebskosten (
  id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- NULL, sobald der Fall "abgeschlossen" ist - eine abgeschlossene NKA hat kein WV-Datum mehr
  -- (siehe applyBkWvDatumFuerStatus() im Prototyp und Geschaeftsregeln::wvDatumFuerStatus()).
  wv_datum                 DATE NULL,
  mandant_id               INT UNSIGNED NOT NULL,
  standort_id              INT UNSIGNED NULL,
  ort                      VARCHAR(120) NOT NULL,
  bka_jahr                 INT NOT NULL,
  bka_datum                DATE NULL,
  -- NZ-Datum: Ende des Abrechnungszeitraums für die Platzhalter-Anzeige "BKA Datum (von-bis)" in
  -- Schriftsätzen (bkaDatum - nzDatum, siehe part4_shared_modals.js) - fachlich ein eigenes Feld,
  -- NICHT dasselbe wie das Abschluss-Datum des Falls selbst (abschluss_datum unten).
  nz_datum                 DATE NULL,
  abschluss_datum          DATE NULL,
  status                   VARCHAR(40) NOT NULL DEFAULT 'NEU',
  counterpart_id           INT UNSIGNED NULL,
  ansprechperson_vwt       VARCHAR(120) NULL,
  ansprechperson_vwt_email VARCHAR(190) NULL,
  adh_kuerzel              VARCHAR(8) NOT NULL,
  bearbeiter_mdt           VARCHAR(120) NULL,
  bearbeiter_mdt_email     VARCHAR(190) NULL,
  ca_werte_fehler          DECIMAL(12,2) NOT NULL DEFAULT 0,
  draufleger               DECIMAL(12,2) NOT NULL DEFAULT 0,
  ersparnis                DECIMAL(12,2) NOT NULL DEFAULT 0,
  gesamtkosten             DECIMAL(12,2) NOT NULL DEFAULT 0,
  vorauszahlungen          DECIMAL(12,2) NOT NULL DEFAULT 0,
  -- Ergebnis (brutto) = Gesamtkosten − Vorauszahlungen, siehe bkErgebnis() im Prototyp
  -- (part5_bk.js) - hier als generierte Spalte, damit nie eine abweichende Kopie entsteht.
  ergebnis                 DECIMAL(12,2) GENERATED ALWAYS AS (gesamtkosten - vorauszahlungen) STORED,
  eingang_datum            DATE NULL,
  aenderung                DATE NOT NULL COMMENT 'Datum des letzten echten Statuswechsels - Grundlage der Farbenlehre (bkAge)',
  eigentuemer              VARCHAR(190) NULL,
  eigentuemer_adresse      VARCHAR(255) NULL,
  eigentuemer_info         VARCHAR(255) NULL,
  markt                    VARCHAR(120) NULL,
  gruppiert                TINYINT(1) NOT NULL DEFAULT 0,
  gruppierter_wert         INT NOT NULL DEFAULT 0,
  stromverbrauch           VARCHAR(40) NULL,
  gasverbrauch             VARCHAR(40) NULL,
  archiviert               TINYINT(1) NOT NULL DEFAULT 0,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_bk_mandant (mandant_id),
  KEY ix_bk_status (status),
  KEY ix_bk_wv_datum (wv_datum),
  CONSTRAINT fk_bk_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bk_standort FOREIGN KEY (standort_id) REFERENCES standorte(id) ON DELETE SET NULL,
  CONSTRAINT fk_bk_counterpart FOREIGN KEY (counterpart_id) REFERENCES counterparts(id) ON DELETE SET NULL,
  CONSTRAINT fk_bk_adh FOREIGN KEY (adh_kuerzel) REFERENCES mitarbeiter(kuerzel) ON DELETE RESTRICT,
  CONSTRAINT chk_bk_gruppiert_wert CHECK (gruppiert = 0 OR gruppierter_wert > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datei-Metadaten je Betriebskosten-Fall (kein echter Dateispeicher im Prototyp - siehe README).
CREATE TABLE IF NOT EXISTS bk_dateien (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  betriebskosten_id INT UNSIGNED NOT NULL,
  kategorie        VARCHAR(40)  NOT NULL,
  unterkategorie   VARCHAR(80)  NULL,
  datum            DATE NULL,
  titel            VARCHAR(190) NULL,
  hochgeladen_am   DATE NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_bkd_bk FOREIGN KEY (betriebskosten_id) REFERENCES betriebskosten(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Mieten (Modul Mieten / Mietanpassungsprüfung)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mieten (
  id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Siehe betriebskosten.wv_datum - NULL sobald der Fall "abgeschlossen" ist.
  wv_datum                 DATE NULL,
  mandant_id               INT UNSIGNED NOT NULL,
  standort_id              INT UNSIGNED NULL,
  ort                      VARCHAR(120) NOT NULL,
  dmr_ab                   DATE NOT NULL,
  status                   VARCHAR(40) NOT NULL DEFAULT 'NEU',
  counterpart_id           INT UNSIGNED NULL,
  ansprechperson_vwt       VARCHAR(120) NULL,
  ansprechperson_vwt_email VARCHAR(190) NULL,
  adh_kuerzel              VARCHAR(8) NOT NULL,
  bearbeiter_mdt           VARCHAR(120) NULL,
  bearbeiter_mdt_email     VARCHAR(190) NULL,
  ca_werte_fehler          DECIMAL(12,2) NOT NULL DEFAULT 0,
  draufleger               DECIMAL(12,2) NOT NULL DEFAULT 0,
  ersparnis                DECIMAL(12,2) NOT NULL DEFAULT 0,
  eingang_datum            DATE NULL,
  abschluss_datum          DATE NULL,
  aenderung                DATE NOT NULL,
  eigentuemer              VARCHAR(190) NULL,
  eigentuemer_adresse      VARCHAR(255) NULL,
  eigentuemer_info         VARCHAR(255) NULL,
  archiviert               TINYINT(1) NOT NULL DEFAULT 0,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_mieten_mandant (mandant_id),
  KEY ix_mieten_status (status),
  CONSTRAINT fk_mieten_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mieten_standort FOREIGN KEY (standort_id) REFERENCES standorte(id) ON DELETE SET NULL,
  CONSTRAINT fk_mieten_counterpart FOREIGN KEY (counterpart_id) REFERENCES counterparts(id) ON DELETE SET NULL,
  CONSTRAINT fk_mieten_adh FOREIGN KEY (adh_kuerzel) REFERENCES mitarbeiter(kuerzel) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mieten_dateien (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mieten_id   INT UNSIGNED NOT NULL,
  kategorie   VARCHAR(40)  NOT NULL,
  unterkategorie VARCHAR(80) NULL,
  datum       DATE NULL,
  titel       VARCHAR(190) NULL,
  hochgeladen_am DATE NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_md_mieten FOREIGN KEY (mieten_id) REFERENCES mieten(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Aufgaben
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aufgaben (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  frist_datum    DATE NULL,
  frist_titel    VARCHAR(190) NULL,
  wv_datum       DATE NOT NULL,
  mandant_id     INT UNSIGNED NULL,
  modul_name     VARCHAR(20) NOT NULL DEFAULT '-' COMMENT 'BKA, Miete oder -',
  modul_status   VARCHAR(40) NULL,
  standort_nr    VARCHAR(16) NULL,
  ort            VARCHAR(120) NULL,
  aufgaben_typ   VARCHAR(120) NOT NULL,
  titel          VARCHAR(190) NOT NULL,
  beschreibung   TEXT NULL,
  -- zugewiesen_an/ersteller: Mitarbeiter-Kürzel ODER der Sammelwert "ADH" (gesamtes Team) -
  -- bewusst ohne FK-Constraint, da "ADH" kein echter mitarbeiter-Datensatz ist (siehe
  -- aufgabenSichtbarkeit() in src/Rechte.php und Abschnitt 3 des PRD).
  zugewiesen_an  VARCHAR(8) NOT NULL,
  ersteller      VARCHAR(8) NOT NULL,
  status         VARCHAR(40) NOT NULL DEFAULT 'NEU',
  erstellt_am    DATE NOT NULL,
  bk_id          INT UNSIGNED NULL,
  mieten_id      INT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_af_zugewiesen (zugewiesen_an),
  KEY ix_af_status (status),
  KEY ix_af_bk (bk_id),
  KEY ix_af_mieten (mieten_id),
  CONSTRAINT fk_af_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE SET NULL,
  CONSTRAINT fk_af_bk FOREIGN KEY (bk_id) REFERENCES betriebskosten(id) ON DELETE CASCADE,
  CONSTRAINT fk_af_mieten FOREIGN KEY (mieten_id) REFERENCES mieten(id) ON DELETE CASCADE,
  CONSTRAINT chk_af_bk_xor_mieten CHECK (bk_id IS NULL OR mieten_id IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aufgaben_follower (
  aufgabe_id         INT UNSIGNED NOT NULL,
  mitarbeiter_kuerzel VARCHAR(8) NOT NULL,
  PRIMARY KEY (aufgabe_id, mitarbeiter_kuerzel),
  CONSTRAINT fk_aff_aufgabe FOREIGN KEY (aufgabe_id) REFERENCES aufgaben(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aufgaben_subtasks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  aufgabe_id  INT UNSIGNED NOT NULL,
  titel       VARCHAR(190) NOT NULL,
  erledigt    TINYINT(1) NOT NULL DEFAULT 0,
  position    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_afs_aufgabe FOREIGN KEY (aufgabe_id) REFERENCES aufgaben(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aufgaben_vorlagen (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(160) NOT NULL,
  mandant_id     INT UNSIGNED NULL,
  aufgaben_typ   VARCHAR(120) NOT NULL,
  titel          VARCHAR(190) NOT NULL,
  beschreibung   TEXT NULL,
  zugewiesen_an  VARCHAR(8) NOT NULL,
  ersteller      VARCHAR(8) NOT NULL,
  zugriff        ENUM('Alle','Nur ich') NOT NULL DEFAULT 'Alle',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_afv_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aufgaben_vorlagen_follower (
  vorlage_id          INT UNSIGNED NOT NULL,
  mitarbeiter_kuerzel VARCHAR(8) NOT NULL,
  PRIMARY KEY (vorlage_id, mitarbeiter_kuerzel),
  CONSTRAINT fk_afvf_vorlage FOREIGN KEY (vorlage_id) REFERENCES aufgaben_vorlagen(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Office: Zeiterfassung
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zeitbuchungen (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  datum              DATE NOT NULL,
  mitarbeiter_kuerzel VARCHAR(8) NOT NULL,
  mandant_id         INT UNSIGNED NULL,
  aufgabe_id         INT UNSIGNED NULL,
  aufgaben_typ       VARCHAR(120) NOT NULL,
  beschreibung       VARCHAR(255) NULL,
  start_zeit         TIME NOT NULL,
  ende_zeit          TIME NOT NULL,
  minuten            INT NOT NULL,
  abrechenbar        TINYINT(1) NOT NULL DEFAULT 1,
  quelle             ENUM('timer','manuell') NOT NULL DEFAULT 'manuell',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ze_mitarbeiter (mitarbeiter_kuerzel),
  KEY ix_ze_mandant (mandant_id),
  KEY ix_ze_datum (datum),
  CONSTRAINT fk_ze_mitarbeiter FOREIGN KEY (mitarbeiter_kuerzel) REFERENCES mitarbeiter(kuerzel) ON DELETE RESTRICT,
  CONSTRAINT fk_ze_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE SET NULL,
  CONSTRAINT fk_ze_aufgabe FOREIGN KEY (aufgabe_id) REFERENCES aufgaben(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Office: Buchhaltung (Rechnungsprogramm)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rechnungen (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nummer                VARCHAR(40) NOT NULL,
  mandant_id            INT UNSIGNED NOT NULL,
  zeitraum_von          DATE NOT NULL,
  zeitraum_bis          DATE NOT NULL,
  haeufigkeit           ENUM('monatlich','quartalsweise','jährlich','einmalig') NOT NULL,
  erstellt_am           DATE NOT NULL,
  zahlungsziel          DATE NOT NULL,
  grundgebuehr          DECIMAL(12,2) NOT NULL DEFAULT 0,
  zeithonorar           DECIMAL(12,2) NOT NULL DEFAULT 0,
  reisekosten_ist       DECIMAL(12,2) NOT NULL DEFAULT 0,
  reisekosten           DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'gedeckelter, tatsächlich abgerechneter Betrag',
  reisekosten_kappung   DECIMAL(12,2) NOT NULL DEFAULT 0,
  reisekosten_gedeckelt TINYINT(1) GENERATED ALWAYS AS (reisekosten_ist > reisekosten_kappung) STORED,
  ersparnis_summe       DECIMAL(12,2) NOT NULL DEFAULT 0,
  erfolgshonorar_satz   DECIMAL(6,2) NOT NULL DEFAULT 0,
  erfolgshonorar        DECIMAL(12,2) NOT NULL DEFAULT 0,
  gesamtbetrag          DECIMAL(12,2) NOT NULL DEFAULT 0,
  status                ENUM('Entwurf','Versendet','Bezahlt') NOT NULL DEFAULT 'Entwurf',
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rechnungen_nummer (nummer),
  KEY ix_re_mandant (mandant_id),
  CONSTRAINT fk_re_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Vertragsmanagement (Modul Vertragsdatenbank / Vertragskarte)
-- ---------------------------------------------------------------------------
-- Ein Datensatz je Vertrag. Mietende, Mietende inkl. Optionen, Optionsfrist, Kündigung bis und die
-- nächste Indexanpassung werden NICHT gespeichert, sondern aus Mietbeginn, Laufzeit, Optionen,
-- automatischer Verlängerung und Indexangaben berechnet (src/Vertragsregeln.php, im Frontend
-- identisch in part5c_vertraege.js). Laufzeit, Optionslaufzeit und automatische Verlängerung
-- lassen sich je in Jahren oder Monaten erfassen.
-- Die vertraglichen Fristen werden bewusst nicht auf einen Donnerstag verschoben, weil sie sich aus
-- dem Vertrag ergeben (die Donnerstagsregel gilt nur für Fristen, die ADH selbst setzt).
CREATE TABLE IF NOT EXISTS vertraege (
  id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mandant_id                INT UNSIGNED NOT NULL,
  standort_id               INT UNSIGNED NULL,
  counterpart_id            INT UNSIGNED NULL COMMENT '(Unter-)Vermieter',
  status                    ENUM('vorgeschlagen','aktiv','UMV','ProForma','gekündigt','archiviert') NOT NULL DEFAULT 'aktiv',
  vertragsart               ENUM('Mietvertrag','Erbpachtvertrag','Kaufvertrag','Maklervertrag','Mitnutzungsvereinbarung','Arbeitsvertrag') NOT NULL DEFAULT 'Mietvertrag',
  verwendung                VARCHAR(40)  NULL,
  mietzweck                 VARCHAR(40)  NULL,
  konzession                VARCHAR(160) NULL,
  parkplaetze               INT UNSIGNED NOT NULL DEFAULT 0,
  sitz_innen                INT UNSIGNED NOT NULL DEFAULT 0,
  sitz_aussen               INT UNSIGNED NOT NULL DEFAULT 0,
  aussenterrasse            DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'qm',
  -- Laufzeit und Optionen
  mietbeginn                DATE NULL,
  laufzeit                  INT UNSIGNED NOT NULL DEFAULT 0,
  laufzeit_einheit          ENUM('Jahre','Monate') NOT NULL DEFAULT 'Jahre',
  opt_anzahl                INT UNSIGNED NOT NULL DEFAULT 0,
  opt_ausgeuebt             INT UNSIGNED NOT NULL DEFAULT 0,
  opt_lz                    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Laufzeit je Option',
  opt_lz_einheit            ENUM('Jahre','Monate') NOT NULL DEFAULT 'Jahre',
  opt_frist_monate          INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Ausübung spätestens so viele Monate vor Mietende',
  opt_ausuebung             VARCHAR(190) NULL COMMENT 'Form der Optionsausübung',
  -- Kündigung
  gekuendigt_am             DATE NULL,
  gekuendigt_zum            DATE NULL,
  kuendigungsfrist          ENUM('täglich','Monatsende','Quartalsende','Halbjahresende','Jahresende','Laufzeitende') NOT NULL DEFAULT 'Laufzeitende',
  kuendigung_vorlauf_monate INT UNSIGNED NOT NULL DEFAULT 0,
  sonderkuendigung_vn       TINYINT(1) NOT NULL DEFAULT 0,
  sonderkuendigung_vg       TINYINT(1) NOT NULL DEFAULT 0,
  auto_verlaengerung        TINYINT(1) NOT NULL DEFAULT 0,
  auto_verl_wert            INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Verlängerung je Zeitraum',
  auto_verl_einheit         ENUM('Jahre','Monate') NOT NULL DEFAULT 'Jahre',
  -- Finanzielles
  miete_netto_pm            DECIMAL(12,2) NOT NULL DEFAULT 0,
  nk_pauschale_pm           DECIMAL(12,2) NOT NULL DEFAULT 0,
  nk_vorauszahlung_pm       DECIMAL(12,2) NOT NULL DEFAULT 0,
  mwst                      DECIMAL(5,2)  NOT NULL DEFAULT 19,
  zahlungsrhythmus          ENUM('monatlich','quartalsweise','halbjährlich','jährlich') NOT NULL DEFAULT 'monatlich',
  mietsicherheit            TINYINT(1) NOT NULL DEFAULT 0,
  mietsicherheit_betrag     DECIMAL(12,2) NOT NULL DEFAULT 0,
  mietsicherheit_art        ENUM('Barkaution','Bürgschaft','Bankbürgschaft','Sparbuch/Wertpapier','Verpfändungserklärung') NOT NULL DEFAULT 'Bankbürgschaft',
  umsatzmiete               TINYINT(1) NOT NULL DEFAULT 0,
  umsatzmiete_prozent       DECIMAL(5,2) NOT NULL DEFAULT 0,
  staffelmiete              TINYINT(1) NOT NULL DEFAULT 0,
  staffel_art               ENUM('FIX','%') NOT NULL DEFAULT 'FIX' COMMENT 'FIX = neue Netto-Miete p.M. in Euro, % = Erhöhung in Prozent',
  -- Indexierung (Wertsicherung)
  indexierung               TINYINT(1) NOT NULL DEFAULT 0,
  index_art                 ENUM('Verbraucherpreisindex Deutschland','Verbraucherpreisindex Bundesland','Anderer Index') NOT NULL DEFAULT 'Verbraucherpreisindex Deutschland',
  index_basis               VARCHAR(40) NULL COMMENT 'z. B. 2020=100',
  index_klausel             ENUM('Automatische Anpassung (Gleitklausel)','Anpassung auf Verlangen','Leistungsvorbehalt','Spannungsklausel') NOT NULL DEFAULT 'Automatische Anpassung (Gleitklausel)',
  index_fundstelle          VARCHAR(80)  NULL COMMENT 'Fundstelle der Klausel im Vertrag, z. B. §5 Abs. 2',
  index_schwelle            DECIMAL(8,2) NOT NULL DEFAULT 0,
  index_schwelle_einheit    ENUM('Prozent','Punkte') NOT NULL DEFAULT 'Prozent',
  index_anpassung           ENUM('immer','vierteljährlich','halbjährlich','jährlich') NOT NULL DEFAULT 'jährlich' COMMENT 'Anpassungsrhythmus, frühestens alle',
  index_richtung            ENUM('Erhöhung und Absenkung','Nur Erhöhung') NOT NULL DEFAULT 'Erhöhung und Absenkung',
  index_umfang              DECIMAL(5,2) NOT NULL DEFAULT 100 COMMENT 'Weitergabe der Änderung in Prozent',
  index_deckel              DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT 'Obergrenze je Anpassung in Prozent, 0 = keine',
  index_wirkung             ENUM('Ab Eintritt der Schwelle','Ab Zugang des Verlangens','Ab dem Folgemonat') NOT NULL DEFAULT 'Ab Eintritt der Schwelle',
  index_basis_monat         CHAR(7) NULL COMMENT 'Basismonat des Index als JJJJ-MM',
  index_basis_stand         DECIMAL(10,2) NOT NULL DEFAULT 0,
  index_erste               DATE NULL COMMENT 'erste Anpassung frühestens am',
  index_letzte              DATE NULL COMMENT 'letzte Anpassung am',
  index_letzter_stand       DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Indexstand bei letzter Anpassung',
  -- Sonstige Daten
  konkurrenzschutz          TINYINT(1) NOT NULL DEFAULT 0,
  betriebspflicht           TINYINT(1) NOT NULL DEFAULT 0,
  verkehrssicherung         TINYINT(1) NOT NULL DEFAULT 0,
  schoenheitsreparaturen    TINYINT(1) NOT NULL DEFAULT 0,
  untervermietung           TINYINT(1) NOT NULL DEFAULT 0,
  aktuell_untervermietet    TINYINT(1) NOT NULL DEFAULT 0,
  nk_empfaenger             VARCHAR(160) NULL COMMENT 'leer = Mietzinsempfänger',
  anmerkungen               TEXT NULL,
  -- Ansprechpartner: solange 0, leitet das Frontend die Liste aus der Kontaktdatenbank ab
  ansprechpartner_individuell TINYINT(1) NOT NULL DEFAULT 0,
  aenderung                 DATE NOT NULL,
  archiviert                TINYINT(1) NOT NULL DEFAULT 0,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_vtr_mandant (mandant_id),
  KEY ix_vtr_standort (standort_id),
  KEY ix_vtr_status (status),
  CONSTRAINT fk_vtr_mandant FOREIGN KEY (mandant_id) REFERENCES mandanten(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vtr_standort FOREIGN KEY (standort_id) REFERENCES standorte(id) ON DELETE SET NULL,
  CONSTRAINT fk_vtr_counterpart FOREIGN KEY (counterpart_id) REFERENCES counterparts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mehrere angemietete Flächen je Vertrag, jeweils mit eigener Bemerkung.
CREATE TABLE IF NOT EXISTS vertraege_flaechen (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vertrag_id  INT UNSIGNED NOT NULL,
  position    INT UNSIGNED NOT NULL DEFAULT 0,
  lage        VARCHAR(160) NOT NULL,
  qm          DECIMAL(10,2) NOT NULL DEFAULT 0,
  bemerkung   VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY ix_vf_vertrag (vertrag_id),
  CONSTRAINT fk_vf_vertrag FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Staffelmiete. Je nach vertraege.staffel_art ist "wert" die neue Netto-Miete p.M. in Euro (FIX)
-- oder die prozentuale Erhöhung (%). Der Auslöser beschreibt, wann die Stufe greift.
CREATE TABLE IF NOT EXISTS vertraege_staffeln (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vertrag_id  INT UNSIGNED NOT NULL,
  position    INT UNSIGNED NOT NULL DEFAULT 0,
  wert        DECIMAL(12,2) NOT NULL DEFAULT 0,
  startdatum  DATE NULL,
  ausloeser   VARCHAR(160) NULL,
  PRIMARY KEY (id),
  KEY ix_vs_vertrag (vertrag_id),
  CONSTRAINT fk_vs_vertrag FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Individuell angepasste Ansprechpartner (Vertragskarte). Nur befüllt, wenn
-- vertraege.ansprechpartner_individuell = 1, sonst gilt die aus der Kontaktdatenbank abgeleitete Liste.
CREATE TABLE IF NOT EXISTS vertraege_ansprechpartner (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vertrag_id  INT UNSIGNED NOT NULL,
  position    INT UNSIGNED NOT NULL DEFAULT 0,
  funktion    VARCHAR(80)  NULL,
  firma       VARCHAR(160) NULL,
  anschrift   VARCHAR(190) NULL,
  plz         VARCHAR(12)  NULL,
  ort         VARCHAR(120) NULL,
  name        VARCHAR(120) NULL,
  vorname     VARCHAR(120) NULL,
  telefon     VARCHAR(60)  NULL,
  mobil       VARCHAR(60)  NULL,
  email       VARCHAR(190) NULL,
  PRIMARY KEY (id),
  KEY ix_va_vertrag (vertrag_id),
  CONSTRAINT fk_va_vertrag FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quelle und Bemerkung je Feld. feld_key entspricht dem Feldschlüssel der Oberfläche (z. B.
-- "laufzeit", "indexSchwelle"), für Flächen ist die Bemerkung direkt an der Fläche abgelegt.
CREATE TABLE IF NOT EXISTS vertraege_notizen (
  vertrag_id  INT UNSIGNED NOT NULL,
  feld_key    VARCHAR(60)  NOT NULL,
  quelle      VARCHAR(190) NULL,
  text        TEXT NULL,
  PRIMARY KEY (vertrag_id, feld_key),
  CONSTRAINT fk_vn_vertrag FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Frist-Erinnerungen wie bei den Aufgaben, hier je Fristart des Vertrags. Bei typ "vorher" gilt
-- anzahl/einheit vor dem Termin der Fristart, bei typ "fest" das feste Datum. Der Termin selbst wird
-- berechnet, nicht gespeichert. empfaenger_kuerzel (Mitarbeiter-Kürzel) und kunden_kontakte
-- (Namen aus der Kontaktdatenbank des Mandanten) sind JSON-Listen.
CREATE TABLE IF NOT EXISTS vertraege_erinnerungen (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vertrag_id        INT UNSIGNED NOT NULL,
  frist_art         ENUM('option','kuendigung','mietende','index') NOT NULL,
  typ               ENUM('vorher','fest') NOT NULL DEFAULT 'vorher',
  anzahl            INT UNSIGNED NOT NULL DEFAULT 0,
  einheit           ENUM('Tage','Wochen','Monate') NOT NULL DEFAULT 'Wochen',
  datum             DATE NULL,
  kanal_email       TINYINT(1) NOT NULL DEFAULT 1,
  kanal_chat        TINYINT(1) NOT NULL DEFAULT 0,
  empfaenger_kuerzel JSON NOT NULL,
  kunden_kontakte   JSON NOT NULL,
  PRIMARY KEY (id),
  KEY ix_ve_vertrag (vertrag_id),
  CONSTRAINT fk_ve_vertrag FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
