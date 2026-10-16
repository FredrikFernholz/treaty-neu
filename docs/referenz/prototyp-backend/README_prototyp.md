# Treaty Backend (PHP)

Eigenständiges REST-Backend für Treaty, als schlankes PHP ohne Framework (nur PDO), MySQL/MariaDB
als Datenbank. Entstanden als Umsetzung des Treaty-2.0-Prototyps (Klick-Demo, veröffentlicht als
Artifact) in eine echte, persistente Anwendung.

## Warum ein separates Projekt statt direkter Anbindung an den Prototyp?

Der Klick-Prototyp ist als Artifact auf claude.ai veröffentlicht. Eine dort veröffentlichte Seite
läuft in einer Sandbox, die keine beliebigen Netzwerkaufrufe an externe Backends erlaubt – eine
direkte Anbindung des Artifacts an dieses PHP-Backend ist deshalb technisch nicht möglich. Dieses
Backend ist daher als eigenständiges, auf einem eigenen Server zu betreibendes Projekt konzipiert.
Die zum Backend passende Frontend-Variante (dieselbe Oberfläche wie der Prototyp, aber mit echten
`fetch()`-Aufrufen statt In-Memory-Mockdaten) liegt inzwischen im Ordner `treaty-frontend/` daneben
– siehe die README dort für Einrichtung und Zugangsdaten.

## Voraussetzungen

- PHP 8.1 oder neuer mit der Erweiterung `pdo_mysql`
- MySQL 8 oder MariaDB 10.6+ (getestet mit MariaDB 10.11 – `GENERATED ALWAYS AS ... STORED` und
  Tabellen-`CHECK`-Constraints werden vorausgesetzt)

Keine Composer-Abhängigkeiten: ein eigener, minimaler Autoloader (`public/index.php`) bildet den
Namensraum `Treaty\` auf `src/` ab.

## Einrichtung

```bash
# 1. Datenbank und Nutzer anlegen (Zugangsdaten ggf. anpassen, siehe config/config.php)
mysql -u root -e "CREATE DATABASE treaty CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                   CREATE USER 'treaty'@'localhost' IDENTIFIED BY 'treaty_dev_pw';
                   GRANT ALL PRIVILEGES ON treaty.* TO 'treaty'@'localhost';"

# 2. Schema anlegen
mysql -u treaty -p treaty < database/schema.sql

# 3. Demo-Daten laden (identisch zu den Mockdaten des Klick-Prototyps)
php database/seed.php

# 3b. Optional die elf Musterverträge des Vertragsmanagements laden (nach Schritt 3)
php database/seed_vertraege.php

# 4. Entwicklungsserver starten
php -S 127.0.0.1:8099 -t public
```

Für den produktiven Einsatz `config/config.php` über Umgebungsvariablen konfigurieren
(`TREATY_DB_HOST`, `TREATY_DB_PORT`, `TREATY_DB_NAME`, `TREATY_DB_USER`, `TREATY_DB_PASS`,
`TREATY_CORS_ORIGIN`) statt der Standardwerte, und `TREATY_CORS_ORIGIN` auf die tatsächliche
Domain der Frontend-Variante einschränken statt `*`.

## Demo-Zugangsdaten

Der Klick-Prototyp kennt keine echten Passwörter. Das Seed-Skript legt daher alle zwölf
Mitarbeiter-Konten mit demselben Demo-Passwort an:

- Anmeldung mit Kürzel ODER E-Mail (z. B. `NZ` oder `natascha.zibulski@adh.email`)
- Passwort: `treaty2026`

Passwörter einzelner Konten lassen sich über `PUT /mitarbeiter/{id}` mit Feld `password` ändern.
Dies vor einem produktiven Einsatz unbedingt tun.

## Architektur

- `config/config.php` – zentrale Konfiguration (DB-Zugangsdaten, Session-Laufzeit, CORS)
- `src/Database.php` – PDO-Singleton
- `src/Konstanten.php` – feste Auswahllisten (Status, Aufgabentypen, Rechtematrix, …), analog zu
  den Konstanten in `mockdata.py`/`part3_core.js` des Prototyps
- `src/Rechte.php` – Rechteprüfung (Rechtematrix + individuelle Zusatzrechte je Mitarbeiter),
  portiert aus `hatZugriffMitarbeiter()`/`hatZusatzrecht()` (part3_core.js)
- `src/Geschaeftsregeln.php` – WV-Datum-Regel bei Statuswechsel, Farbenlehre/Ampel,
  Rechnungsberechnung, portiert aus `part5_bk.js`/`part6c_office.js`
- `src/Vertragsregeln.php` – berechnete Termine des Vertragsmanagements (Mietende, Optionsfrist,
  Kündigung bis, nächste Indexanpassung, Zieltermin von Erinnerungen), identisch zur Oberfläche
- `src/Auth.php` – Session-basierte Anmeldung
- `src/Router.php` – minimaler Pfad-Router ohne Framework-Abhängigkeit
- `src/Controllers/*` – ein Controller je Modul
- `public/index.php` – Front-Controller (Autoloader, CORS, Routing-Tabelle)
- `database/schema.sql` – vollständiges Datenbankschema
- `database/seed.php` – lädt die Demo-Daten aus `mockdata.json` des Prototyps
- `database/seed_vertraege.php` – lädt die Musterverträge aus `vertraege_mock.json`
- `bin/vertrags_erinnerungen.php` – listet fällige Vertrags-Erinnerungen als JSON (Grundlage für einen Cronjob)

## Fachliche Kernregeln (bewusst hervorgehoben, da leicht zu übersehen)

- **WV-Datum-Neuberechnung**: Bei einem tatsächlichen Statuswechsel einer Betriebskosten- oder
  Mieten-Akte (nicht bei jedem Speichern des Datenblatts) wird das WV-Datum automatisch nach der
  Farbenlehre-Regel neu berechnet und `aenderung` auf heute gesetzt. Bestimmte Status legen das
  Ergebnis zusätzlich auf den nächsten Donnerstag (`warte auf Verwalter`, 1.–4. Erinnerung) – passend
  zur allgemeinen Regel, dass Fristen bei ADH stets auf einen Donnerstag fallen.
- **Ampel/Farbenlehre**: wird bei jeder Ausgabe live aus Status und `aenderung` berechnet
  (`ampel`-Feld in der API-Antwort), nicht in der Datenbank gespeichert.
- **Aufgaben-Sichtbarkeit**: Administrator sieht alle Aufgaben, Sachbearbeiter/in nur die ihr/ihm
  selbst oder „ADH“ (alle) zugewiesenen.
- **Zeiterfassung**: eine Sachbearbeiter/in ohne das individuelle Zusatzrecht
  `zeiterfassung_alle` sieht und bucht ausschließlich die eigenen Zeitbuchungen.
- **NKA/Mietfall „Löschen“**: archiviert nur (`archiviert = 1`), es findet kein echtes `DELETE`
  statt.
- **Zusatzrechte sind bewusst nicht protokollpflichtig**: `mitarbeiter_zusatzrechte` und der
  zugehörige Endpunkt `PUT /mitarbeiter/{id}/zusatzrechte` führen absichtlich kein „geändert
  von/am“ mit. Das ist keine Lücke, sondern eine bestätigte fachliche Entscheidung – bei
  zukünftigen Änderungen an dieser Tabelle/diesem Endpunkt sollte das erhalten bleiben.
- **Rechnungsberechnung**: Grundgebühr (Pauschale- und Prüfgebühr-Positionen; bei gruppierten,
  abgeschlossenen BK-Fällen im Zeitraum als „Gruppierter Wert × Prüfgebühr-Satz“ statt festem
  Betrag), Zeithonorar aus abrechenbaren Zeitbuchungen mit aktiver Stundensatz-Position,
  Erfolgshonorar aus der Ersparnis abgeschlossener BK-Fälle, Reisekosten gedeckelt auf die
  vertragliche Kappungsgrenze des Mandanten.

## Vertragsmanagement

Das Modul bildet die Vertragsdatenbank mit Datenblatt und Vertragskarte ab. Ein Vertrag liegt in
`vertraege`, dazu gehören die Unterlisten `vertraege_flaechen` (mehrere Flächen mit Bemerkung),
`vertraege_staffeln`, `vertraege_ansprechpartner`, `vertraege_notizen` (Quelle und Bemerkung je
Feld) und `vertraege_erinnerungen`. Im API-Payload erscheinen die Unterlisten als Felder des
Vertrags. Wird eine Unterliste mitgeschickt, ersetzt sie die bisherige vollständig, fehlt sie, bleibt
sie unverändert.

Fachliche Regeln, die leicht übersehen werden:

- Mietende, Mietende inklusive Optionen, Optionsfrist, Kündigung bis und nächste Indexanpassung sind
  nicht gespeichert, sondern werden aus den Vertragsangaben berechnet und in der Antwort unter
  `abgeleitet` mitgeliefert. Die Rechenlogik liegt in `src/Vertragsregeln.php` und ist in der
  Oberfläche identisch umgesetzt.
- Laufzeit, Optionslaufzeit und automatische Verlängerung lassen sich je in Jahren oder Monaten
  erfassen. Bei automatischer Verlängerung rückt ein verstrichenes Mietende um jeweils einen
  Verlängerungszeitraum weiter.
- Staffelmiete und Indexierung sind frei kombinierbar. Bei `staffelArt` FIX ist der Staffelwert die
  neue Netto-Miete p.M. in Euro, bei `%` die prozentuale Erhöhung.
- Die Indexierung speichert Indexart, Basis, Art der Klausel, Fundstelle, Schwellenwert, Rhythmus,
  Richtung, Umfang, Obergrenze, Wirkung, Basismonat, Indexstände sowie erste und letzte Anpassung.
- Beim Anlegen und bei jeder Änderung, die daran beteiligte Felder enthält, prüft das Backend
  dieselben fachlichen Regeln wie das Formular. Mietbeginn und Laufzeit sind Pflicht, bei
  automatischer Verlängerung muss der Verlängerungszeitraum größer als null sein, es dürfen nicht
  mehr Optionen ausgeübt sein als vorhanden, bei Staffelmiete ist mindestens eine Staffel mit Betrag
  und Startdatum oder Auslöser nötig, und die Weitergabe der Indexänderung liegt zwischen 1 und 100
  Prozent. Verstöße ergeben HTTP 422 mit deutscher Meldung. Ein reiner Statuswechsel, etwa Aus dem
  Archiv holen, wird nicht blockiert, auch wenn ein älterer Datensatz die Regeln nicht erfüllt.
- Die vertraglichen Fristen und ihre Erinnerungs-Zieltermine werden bewusst nicht auf einen
  Donnerstag verschoben, weil sie sich aus dem Vertrag ergeben.
- Ansprechpartner sind solange aus der Kontaktdatenbank abgeleitet, bis sie für den Vertrag
  angepasst werden (`ansprechpartner` ist dann `null`). Eine angepasste Liste wird vollständig
  gespeichert.
- Das Archivieren (`DELETE /vertraege/{id}`) setzt nur `archiviert = 1` und den Status
  `archiviert`. Ein Statuswechsel zurück auf einen anderen Wert hebt die Archivierung auf.
- Der Prüfhinweis zum Preisklauselgesetz (Mindestbindung für automatische Indexklauseln) wird in der
  Oberfläche angezeigt und ersetzt keine rechtliche Prüfung des Vertragstexts.

Der Versand der Erinnerungen ist nicht Teil des Backends. `GET /vertraege/erinnerungen-faellig`
und das Skript `bin/vertrags_erinnerungen.php` liefern die Erinnerungen, deren Zieltermin heute
oder in den letzten Tagen lag, als Grundlage für einen Cronjob mit E-Mail- oder Chat-Versand.

## API-Überblick

Alle Endpunkte außer `POST /auth/login` erwarten eine bestehende Session (Cookie). Antworten sind
JSON, Listen liefern `{data, page, pageSize, total}`. Zeitstempel/Daten sind ISO-Format
(`YYYY-MM-DD`).

| Bereich | Endpunkte |
|---|---|
| Anmeldung | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Betriebskosten | `GET/POST /betriebskosten`, `GET/PUT /betriebskosten/{id}`, `DELETE /betriebskosten/{id}` (archiviert) |
| Mieten | analog zu Betriebskosten |
| Vertragsmanagement | `GET/POST /vertraege`, `GET/PUT /vertraege/{id}`, `PUT /vertraege/{id}/notizen`, `DELETE /vertraege/{id}` (archiviert), `GET /vertraege/erinnerungen-faellig` |
| Aufgaben | `GET/POST /aufgaben`, `GET/PUT/DELETE /aufgaben/{id}`, `PUT /aufgaben/{id}/subtasks` |
| Kunden | `GET/POST /kunden`, `GET/PUT /kunden/{id}`, `POST /kunden/{id}/kontakte`, `PUT /kunden/{id}/leistungen` |
| Leistungskatalog | `GET/POST /leistungskatalog`, `PUT /leistungskatalog/{id}` |
| Zeiterfassung | `GET/POST /zeitbuchungen`, `PUT/DELETE /zeitbuchungen/{id}` |
| Rechnungen | `GET /rechnungen`, `POST /rechnungen/basis` (Vorschau), `POST /rechnungen`, `PUT /rechnungen/{id}` |
| Nutzerverwaltung | `GET/POST /mitarbeiter`, `GET/PUT /mitarbeiter/{id}`, `PUT /mitarbeiter/{id}/zusatzrechte`, `GET /rechtematrix` |
| Standorte/Kontakte | `GET/POST/PUT /standorte`, `GET/POST /counterparts`, `POST /counterparts/{id}/kontakte` |
| Auswertungen | `GET /auswertungen/fallstatistiken`, `/finanzkennzahlen`, `/auslastung` |

## Noch offen (nicht Teil dieser Auslieferung)

- Feingranulare Audit-Historie/Vorgangshistorie einzelner Datenblatt-Änderungen (der Prototyp
  zeigt dazu bislang nur Demo-Daten, keine echte Protokollierung)
- Datei-Uploads (bk_dateien/mieten_dateien-Metadaten sind im Schema vorhanden, ein tatsächlicher
  Datei-Upload-Endpunkt wurde in dieser Runde nicht umgesetzt)
- Kommentare/Benachrichtigungen, Frist-Erinnerungen und Aufgabenserien haben kein Backend-Pendant
  und bleiben in der Frontend-Variante rein clientseitige Anzeige (Details siehe dortige README)
