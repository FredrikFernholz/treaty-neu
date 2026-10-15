# Technische Konzeption Treaty 2.0

**Gegenstand:** Technische Konzeption für die Neuumsetzung der internen Softwareplattform Treaty bei ADH Deutschland GmbH.
**Stand:** 01.10.2026, Entwurf zur Abstimmung. Am selben Tag überarbeitet, Rechnungen werden als PDF mit ZUGFeRD erzeugt statt als XRechnung.
**Grundlagen:** PRD_Treaty_2.0.md (Stand 01.10.2026), Treaty_2.0_Felddokumentation.xlsx (Prototyp-Version 66) sowie der Quellcode des Klick-Prototyps aus dem Artifact „Treaty Prototyp“.
**Verhältnis zur PRD:** Die PRD und die Felddokumentation legen fest, was Treaty fachlich tut. Dieses Dokument legt fest, wie das technisch umgesetzt wird. Wo der Prototyp-Code von PRD oder Felddokumentation abweicht, ist das in Abschnitt 16 als Entscheidungsbedarf aufgeführt und nicht stillschweigend in die eine oder andere Richtung aufgelöst.

## 1. Zweck und Lesart

Die Konzeption beschreibt Architektur, Datenmodell, die zentrale Regelbibliothek, Rechte und Anmeldung, Dateiablage, die Schnittstellen zu Outlook und Rechnungswesen, Exporte, Hintergrundaufgaben, die Datenmigration aus dem heutigen Treaty sowie Betrieb und Qualitätssicherung. Am Ende stehen die offenen Entscheidungen und ein Vorschlag für die Reihenfolge der Umsetzung.

Im Text wird durchgehend unterschieden zwischen Vorgaben, die durch die Auftraggeberseite bereits festgelegt sind, Befunden aus PRD, Felddokumentation und Prototyp-Code, und Empfehlungen, die aus dieser Konzeption selbst stammen und noch bestätigt werden müssen. Empfehlungen sind als solche benannt.

## 2. Festgelegte Rahmenbedingungen

Die folgenden Punkte sind durch die Auftraggeberseite vorgegeben und werden in dieser Konzeption nicht mehr zur Wahl gestellt.

| Bereich | Vorgabe |
|---|---|
| Backend | TypeScript auf Node.js |
| Frontend | Vue |
| Datenbank | MySQL beziehungsweise MariaDB |
| Betrieb | Eigener Server mit Ubuntu 24.04 |
| Auslieferung | Apache als Reverse Proxy, Konfiguration unter deploy/apache/treaty.conf |
| Anmeldung | Eigene Benutzer- und Anmeldeverwaltung in Treaty, kein externer Identitätsdienst |
| Dateiablage | Dateisystem des Servers |
| Outlook | Treaty erzeugt nur E-Mail-Entwürfe, der Versand erfolgt von Hand in Outlook |
| Rechnungswesen | Keine direkte Schnittstelle, Rechnungen als PDF mit eingebetteten ZUGFeRD-Daten, zusätzlich eine CSV-Liste |
| Altdaten | Die Bestandsdaten des heutigen Treaty werden übernommen |

## 3. Architekturüberblick

Empfohlen wird ein modularer Monolith. Treaty hat eine überschaubare Nutzerzahl, eine einzige Datenbank und viele fachliche Querbezüge, etwa zwischen Fall, Check-Aufgabe, Zeitbuchung und Rechnung. Eine Aufteilung in getrennte Dienste brächte hier vor allem Abstimmungsaufwand und verteilte Transaktionen, aber keinen Nutzen. Innerhalb des Monolithen sind die Fachmodule trotzdem sauber getrennt, damit sich einzelne Bereiche unabhängig weiterentwickeln lassen.

```
 Browser (Vue-Anwendung)
        │  HTTPS, WebSocket
        ▼
 Apache 2.4  ── liefert /  (statisches Frontend aus /var/www/treaty/frontend/dist)
        │      reicht /api und /ws weiter
        ▼
 treaty-api  (Node.js, 127.0.0.1:3000)
   ├─ Fachmodule (Fälle, Aufgaben, Zeiterfassung, Rechnungen, ...)
   ├─ @treaty/regeln  (zentrale Geschäftsregeln, auch im Frontend genutzt)
   └─ Export-Dienst (Excel, PDF, ZUGFeRD-Rechnung, CSV, E-Mail-Entwurf)
        │                         │
        ▼                         ▼
 MySQL 8.0                 /var/lib/treaty/dateien
        ▲
        │  Auftragstabelle
 treaty-worker  (Node.js, gleicher Code, eigener Prozess)
   └─ Erinnerungen, terminierte Berichte, Aufräumen, Virenprüfung
```

Der Worker ist ein zweiter Prozess aus derselben Codebasis. Er übernimmt alles, was zeitgesteuert oder langlaufend ist, damit Anfragen der Nutzer nie darauf warten müssen. Beide Prozesse laufen als systemd-Dienste unter einem eigenen Systembenutzer treaty.

## 4. Technologieauswahl

Die Auswahl innerhalb der Vorgaben ist eine Empfehlung. Maßgeblich waren Typsicherheit über alle Schichten, gute Unterstützung für MySQL und MariaDB, ein kleiner Betriebsaufwand und deutschsprachige Oberflächen mit umfangreichen Tabellen.

| Schicht | Empfehlung | Begründung |
|---|---|---|
| Laufzeit | Node.js 24 LTS | Langzeitunterstützung bis Frühjahr 2028 |
| Sprache | TypeScript 6.0 | Die neue native Version 7 hat keine JavaScript-Schnittstelle mehr, die vue-tsc für die Prüfung der Vue-Dateien braucht |
| Paketverwaltung | pnpm mit Workspaces | Ein Repository für Backend, Frontend und gemeinsame Pakete |
| HTTP-Framework | Fastify | Schnell, schlank, gute TypeScript-Unterstützung, eingebaute Schema-Validierung |
| Validierung | Zod | Dieselben Schemas prüfen Eingaben im Frontend und im Backend |
| Datenbankzugriff | Drizzle ORM mit mysql2 | Typsichere Abfragen nah an SQL, versionierte Migrationen, unterstützt MySQL und MariaDB |
| Datenbank | MySQL 8.0 aus den Ubuntu-Paketquellen | Läuft bereits auf dem Server, wird mit Ubuntu 24.04 gepflegt, unterstützt generierte Spalten und SKIP LOCKED |
| Frontend | Vue 3, Vite, Vue Router, Pinia, TanStack Query | Etablierter Standard, Serverdaten werden zentral zwischengespeichert und aktualisiert |
| Komponenten | Element Plus | MIT-Lizenz, aktiv gepflegt, Tabellen mit Sortierung, Filter und Paginierung, Formulare und Dialoge, deutsche Sprachdatei eingebaut. PrimeVue war zunächst vorgesehen, ist aber ab Version 5 lizenzpflichtig und wurde deshalb am 01.10.2026 ersetzt. |
| Excel-Export | Eigenes Modul auf Basis des Prototyp-Codes | Siehe unten |
| PDF-Erzeugung | Headless Chromium über Playwright | Briefe, Rechnungen und Berichte aus HTML-Vorlagen mit sauberem Seitenumbruch |
| E-Rechnung | Eigener ZUGFeRD-Baustein mit Ghostscript und pdf-lib, Prüfung mit dem Mustang-Validator im Build | Siehe Abschnitt 12.2 |
| Logging | pino, Ausgabe nach journald | Strukturierte Logs ohne zusätzliche Infrastruktur |
| Tests | Vitest, Playwright | Einheitentests für die Regeln, Ende-zu-Ende-Tests für die Arbeitsabläufe |

Zum Excel-Export gibt es einen Befund. Der Prototyp verwendet keine Bibliothek, sondern schreibt die xlsx-Dateien einschließlich der Balkendiagramme mit eigenem Code (Funktionen buildXlsx und makeZip). Die verbreiteten Node-Bibliotheken wie ExcelJS können keine Diagramme schreiben. Empfohlen wird deshalb, den Excel-Teil des Prototyps als eigenes, getestetes Modul in das Backend zu übernehmen, weil er genau die bereits abgestimmten Dateien erzeugt. Die Alternative wäre, Diagramme ganz aus den Excel-Dateien zu streichen, was die Felddokumentation aber ausdrücklich vorsieht.

Bei MySQL und MariaDB empfiehlt es sich, eines der beiden Systeme fest zu wählen und nur dagegen zu testen. Beide sind sich ähnlich, unterscheiden sich aber im Detail, etwa beim JSON-Typ. Auf dem Server läuft bereits MySQL 8.0 aus den Ubuntu-Paketquellen, daher wird Treaty ausschließlich gegen MySQL 8.0 entwickelt und getestet.

## 5. Aufbau des Codes

```
/home/ccode/treaty/
├─ frontend/            Vue-Anwendung, Build-Ausgabe in frontend/dist
├─ backend/
│  ├─ src/
│  │  ├─ modules/       Fastify-Routen und Dienste, ein Ordner je Fachmodul
│  │  ├─ worker/        Einstiegspunkt für Hintergrundaufträge
│  │  ├─ shared/
│  │  │  ├─ regeln/     Zentrale Geschäftsregeln als reine Funktionen (Abschnitt 7)
│  │  │  ├─ schemas/    Zod-Schemas und gemeinsame Typen für API und Frontend
│  │  │  └─ rechte/     Rechtematrix, Zusatzrechte und Prüffunktionen (Abschnitt 8)
│  │  └─ db/            Drizzle-Schema, Migrationen, Seed-Daten
│  └─ migration/        Importskripte für die Altdaten (Abschnitt 13)
└─ deploy/              Apache-Konfiguration, systemd-Units, Skripte

/var/www/treaty/
├─ frontend  ->  /home/ccode/treaty/frontend
└─ backend   ->  /home/ccode/treaty/backend
```

Frontend und Backend sind zwei eigene Projekte, die ein pnpm-Workspace im Projektordner zusammenhält. Die gemeinsam genutzten Regeln, Schemas und Rechte liegen im Backend unter src/shared. Das Frontend bindet sie über einen Pfad-Alias ein, sodass es sie nur liest und nie eine eigene Kopie führt. Apache greift über die Links unter /var/www/treaty zu. Er liefert nur frontend/dist aus, den Ordner backend liefert er nicht aus. Von dort startet systemd den Node-Dienst.

Die Fachmodule im Backend sind Benutzer und Rechte, Mandanten mit Leistungskatalog und Standorten, Kontakte, Fälle (Betriebskosten und Mieten gemeinsam), Aufgaben, Zeiterfassung, Rechnungen, Dateien, Schriftsätze, Kommentare und Historie, Auswertungen, Berichte und Erinnerungen. Jedes Modul besitzt seine Routen, seine Datenbankzugriffe und seine Dienste. Querbezüge laufen über die Dienste des jeweils anderen Moduls und nie direkt über dessen Tabellen. Das gilt besonders für die Kopplung zwischen Fall und Check-Aufgabe.

Die API folgt REST-Konventionen unter /api/v1. Listen unterstützen serverseitige Filter, Sortierung und Paginierung, weil die Datenmenge im Echtbetrieb weit über den Demodaten liegt. Die Filterleisten mit Mehrfachauswahl und dem Schalter „enthält nicht“ werden als Abfrageparameter abgebildet. Die Volltextsuche je Modul läuft über einen FULLTEXT-Index auf den durchsuchbaren Spalten.

## 6. Datenmodell

### 6.1 Grundsätze

Geldbeträge werden als DECIMAL(12,2) gespeichert und nie als Gleitkommazahl. Fachliche Datumswerte wie WV-Datum, Frist oder Eingang sind reine Kalenderdaten vom Typ DATE. Zeitpunkte wie „erstellt am“ werden als DATETIME(3) in UTC gespeichert. Alle Berechnungen von „heute“ laufen in der Zeitzone Europe/Berlin, denn sonst wechselt das WV-Datum nachts zwischen 0 und 2 Uhr auf den falschen Tag.

Jede änderbare Tabelle erhält eine Spalte version für optimistisches Sperren. Speichert jemand einen Datensatz, den eine andere Person inzwischen geändert hat, lehnt die API das Speichern ab und die Oberfläche zeigt beide Stände an. Der Prototyp kennt dieses Problem nicht, weil er nur einen Nutzer hat. Im Mehrbenutzerbetrieb ist es aber unverzichtbar.

Gelöscht wird fachlich so gut wie nie. Fälle werden archiviert, Aufgaben abgeschlossen, Rechnungen storniert. Ausnahmen sind Zeitbuchungen, Erinnerungsregeln und Berichte, die laut Felddokumentation endgültig gelöscht werden.

Abgeleitete Werte, die sich immer aus anderen Spalten ergeben, werden als generierte Spalten in der Datenbank geführt. Das betrifft etwa das Ergebnis eines Betriebskosten-Falls (Gesamtkosten minus Vorauszahlungen), die Dauer einer Zeitbuchung und den Gesamtbetrag einer Rechnung. So kann kein Code diese Werte versehentlich abweichend speichern.

### 6.2 Stammdaten

| Tabelle | Wesentliche Felder | Hinweise |
|---|---|---|
| benutzer | id, kuerzel (eindeutig, unveränderlich), name, email, passwort_hash, berechtigung (Administrator, Sachbearbeiter/in), zeichnung (ppa., i.V., i.A., ohne), bezeichnung, aktiv, totp_secret | Kürzel wird bei Anlage aus dem Namen vorgeschlagen |
| benutzer_zusatzrecht | benutzer_id, recht | Werte buchhaltung, leistungskatalog, kunden, nutzerverwaltung, auswertungen, zeiterfassung_alle |
| sitzung | id, benutzer_id, erstellt, laeuft_ab, letzte_aktivitaet, ip, user_agent | Serverseitige Sitzungen, Abschnitt 9 |
| mandant | id, name, kuerzel, adresse, ansprechpartner, email, telefon, kunde_seit, vertrag_beginn, laufzeit, kuendigungsfrist, vertragsstatus, reisekosten_kappung | Vertragsstatus Aktiv, In Verhandlung, Pausiert, Gekündigt |
| leistung | id, bezeichnung, standardpreis, typ, haeufigkeit | Zentraler Leistungskatalog, 16 Positionen als Seed aus dem Prototyp |
| mandant_leistung | mandant_id, leistung_id, aktiv, preis, typ, haeufigkeit | Vereinbarte Leistung je Mandant, Änderungen wirken sofort |
| standort | id, mandant_id, nr, plz_ort_id, adresse | Standortnummer mit Duplikatsprüfung |
| plz_ort | id, land, plz, ort | 109 kuratierte Einträge aus dem Prototyp |
| hausverwaltung | id, name, email, adresse | Im Prototyp „Counterpart“ |
| vwt_ansprechperson | id, hausverwaltung_id, name, email | |
| mdt_kontakt | id, mandant_id, name, email | Bearbeiter bei MDT |
| kontakt_manuell | id, rolle, name, email, adresse, info, mandant_id, standort_id, hausverwaltung_id | Von Hand angelegte Kontakte der Kontaktdatenbank |

Der Typ einer Leistung ist einer der Werte %, Stundensatz, Prüfgebühr, Pauschale oder Intern. Im Prototyp sind die Aufgabentypen genau die Bezeichnungen der Leistungskatalog-Positionen. Diese Kopplung wird übernommen, eine Aufgabe verweist also über aufgabentyp_id direkt auf eine Zeile in leistung. Damit ist die Regel aus der PRD technisch abgesichert, nach der bei Neuanlage einer Aufgabe nur die beim Mandanten aktiv vereinbarten Typen wählbar sind.

Die Kontaktdatenbank ist laut PRD kein eigener Datenbestand, sondern eine Zusammenführung. Im Prototyp werden Counterpart, Ansprechperson und Bearbeiter als Text in jedem Fall gespeichert. In der Neuumsetzung verweist ein Fall stattdessen auf Datensätze in hausverwaltung, vwt_ansprechperson und mdt_kontakt. Die Kontaktdatenbank wird damit zu einer Datenbank-Sicht (VIEW) über diese Tabellen, die Eigentümerangaben der Fälle und kontakt_manuell. Das erfüllt die Vorgabe der PRD, vermeidet aber Schreibvarianten desselben Kontakts. Die Fundstellen ergeben sich als Zählung der Verweise.

### 6.3 Fälle (Betriebskosten und Mieten)

Betriebskosten und Mieten teilen den größten Teil ihrer Felder und Regeln. Empfohlen wird deshalb eine gemeinsame Tabelle fall mit einer Spalte modul und je einer Ergänzungstabelle für die modulspezifischen Felder.

| Tabelle | Wesentliche Felder |
|---|---|
| fall | id, fallnummer, modul (BK, MIETE), mandant_id, standort_id, status, wv_datum, letzte_statusaenderung, eingang_datum, abschluss_datum, adh_benutzer_id (leer bedeutet „ADH (nicht zugewiesen)“), mdt_kontakt_id, hausverwaltung_id, vwt_ansprechperson_id, ca_werte_fehler, draufleger, ersparnis, eigentuemer_name, eigentuemer_adresse, eigentuemer_info, gruppiert, gruppierter_wert, archiviert, erstellt_am, erstellt_von, version |
| fall_bk | fall_id, bka_jahr, bka_datum, nz_datum, gesamtkosten, vorauszahlungen, ergebnis (generiert), stromverbrauch, gasverbrauch |
| fall_miete | fall_id, dmr_ab, dmr_jahr (generiert aus dmr_ab) |
| pruefbogen | fall_id, punkt, bewertung, geaendert_von, geaendert_am |

Der Status ist einer der zwölf Werte aus der Felddokumentation, also NEU, in Bearbeitung, AW eingegangen MDT, AW eingegangen VWT, warte auf MDT, warte auf Verwalter, warte auf Dritten, 1. bis 4. Erinnerung und abgeschlossen. Der Prüfbogen hat neun feste Punkte mit den Bewertungen i.O., offen und Mangel und existiert nur für Betriebskosten. Eine Prüfregel in der Datenbank stellt sicher, dass bei gruppiert gleich ja ein gruppierter_wert größer null vorhanden ist.

Für den Vorjahresvergleich sucht die API den Fall desselben Standorts mit Jahr minus eins, bei Mieten bezogen auf dmr_jahr. Ein zusammengesetzter Index auf Modul, Standort und Jahr hält diese Abfrage auch in langen Listen schnell.

### 6.4 Aufgaben

| Tabelle | Wesentliche Felder |
|---|---|
| aufgabe | id, mandant_id, fall_id, ist_check_aufgabe, modul_status_bei_anlage, standort_id, aufgabentyp_id, titel, beschreibung, zuweisung_team, zugewiesen_an, follower_team, follower_id, status (NEU, in Bearbeitung, abgeschlossen), wv_datum, frist_datum, frist_titel, erstellt_am, ersteller_id, abgeschlossen_am, version |
| aufgabe_subtask | id, aufgabe_id, titel, erledigt, reihenfolge |
| aufgabe_serie | aufgabe_id, muster, dauer_typ, end_datum, anzahl_termine, anzahl_bisher, wochentag, tag_im_monat, jahrestag |
| aufgabe_vorlage | id, name, mandant_id, aufgabentyp_id, titel, beschreibung, zuweisung, follower, standort_id, frist_titel, ersteller_id |
| aufgabe_frist_erinnerung | id, aufgabe_id, typ, anzahl, einheit, datum, kanal_email, kanal_chat | Nur im Prototyp-Code vorhanden, siehe Abschnitt 16 |

Der Sammelwert ADH wird nicht als Pseudo-Benutzer gespeichert, sondern über die Kennzeichen zuweisung_team und follower_team. Das hält ihn sauber getrennt von „ADH (nicht zugewiesen)“ bei den Fällen, das schlicht ein leeres adh_benutzer_id ist. Die PRD verlangt diese Trennung in Abschnitt 10 ausdrücklich.

Eine Check-Aufgabe ist über fall_id und ist_check_aufgabe mit genau einem Fall verbunden. Ein eindeutiger Index auf fall_id für Check-Aufgaben verhindert, dass ein Fall zwei Check-Aufgaben erhält. Die IDs vergibt die Datenbank fortlaufend. Der Prototyp bildet IDs aus der Anzahl bestehender Zeilen, was zu doppelten IDs führen kann, das wird nicht übernommen.

### 6.5 Zeiterfassung und Rechnungen

| Tabelle | Wesentliche Felder |
|---|---|
| zeitbuchung | id, benutzer_id, datum, start, ende, minuten (generiert), ist_pause, mandant_id, aufgabe_id, aufgabentyp_id, beschreibung, quelle (timer, manuell), abrechenbar, rechnung_id, version |
| laufender_timer | benutzer_id, aufgabe_id, gestartet_um, pausiert_seit, bisher_minuten, ist_pause |
| rechnung | id, nummer (leer im Entwurf), mandant_id, rechnungsanschrift, zeitraum_von, zeitraum_bis, haeufigkeit, erstellt_am, festgeschrieben_am, zahlungsziel, grundgebuehr, zeithonorar, reisekosten_ist, reisekosten, reisekosten_kappung, reisekosten_gedeckelt, ersparnis_summe, erfolgshonorar_satz, erfolgshonorar, gesamtbetrag (generiert, netto), ust_kategorie, ust_satz, ust_betrag, brutto (generiert), status (Entwurf, Versendet, Bezahlt, Storniert), storno_von_id, pdf_datei_id, berechnung_json, version |
| rechnungsnummer_zaehler | jahr, letzte_nummer |
| adh_stammdaten | firmenname, anschrift, steuernummer, ust_idnr, iban, bic, bank, kontakt_email, handelsregister (genau eine Zeile mit den Angaben zu ADH als Rechnungssteller) |

Der laufende Timer liegt im Gegensatz zum Prototyp auf dem Server. So übersteht er ein Neuladen der Seite und den Wechsel des Geräts, und Administratoren sehen, ob jemand gerade bucht.

Das Feld abrechenbar wird beim Speichern einer Zeitbuchung aus dem Aufgabentyp abgeleitet und ist über die API nicht direkt schreibbar. Pausen sind ein eigener Buchungstyp mit ist_pause, ohne Mandant und Aufgabe und nie abrechenbar. Das entspricht dem Prototyp-Code. Der gegenteilige Hinweis in der Felddokumentation geht auf einen veralteten Kommentar im Code zurück.

Eine Rechnung entsteht zunächst als Entwurf ohne Nummer. Erst beim Festschreiben, also wenn die Rechnung an den Mandanten gehen soll, vergibt Treaty die Rechnungsnummer im Format RE-JAHR-NNNN, erzeugt das ZUGFeRD-PDF und setzt den Status auf Versendet. Die Nummer wird in derselben Transaktion vergeben, mit einer Zeilensperre auf rechnungsnummer_zaehler. Damit bleibt die Nummernfolge auch dann lückenlos und eindeutig, wenn zwei Personen gleichzeitig Rechnungen festschreiben, und ein verworfener Entwurf hinterlässt keine Lücke. Im Prototyp erhält eine Rechnung ihre Nummer schon bei der Erstellung. Die Abweichung ist in Abschnitt 16 aufgeführt. In berechnung_json wird festgehalten, aus welchen Leistungspositionen, Zeitbuchungen und Fällen die automatisch berechneten Beträge stammen. So bleibt eine Rechnung nachvollziehbar, auch wenn sich der Leistungskatalog später ändert.

Die Spalte rechnung_id an der Zeitbuchung ist eine Empfehlung dieser Konzeption. Der Prototyp merkt sich nicht, welche Zeitbuchungen schon abgerechnet sind. Überlappen sich die Zeiträume zweier Rechnungen, würde dieselbe Zeit doppelt berechnet. Abschnitt 16 führt das als Entscheidungsbedarf.

### 6.6 Nachvollziehbarkeit, Kommentare und Dateien

| Tabelle | Wesentliche Felder |
|---|---|
| historie | id, bezug_typ (fall, aufgabe), bezug_id, art (anlage, status, wiedervorlage, dokument, kommentar, zuweisung, abschluss, archivierung), alt, neu, text, benutzer_id, zeitpunkt |
| kommentar | id, bezug_typ, bezug_id, von_id, an_id, text, erstellt_am, gelesen_am |
| datei | id, bezug_typ (fall, aufgabe), bezug_id, kategorie, unterkategorie, titel, dokument_datum, speicher_schluessel, originalname, mime_typ, groesse, sha256, hochgeladen_von, hochgeladen_am, pruefstatus |
| textbaustein | id, modul, vorlage, version, absaetze_json, einschreiben, filialnummer, kein_rechnungsblock, gueltig_ab |

Die Historie ist eine reine Anfügetabelle. Die Anwendung schreibt dort hinein, ändert oder löscht aber nie Einträge, und der Datenbankbenutzer der Anwendung erhält auf dieser Tabelle kein UPDATE- und DELETE-Recht. Jeder echte Statuswechsel, jede Änderung des WV-Datums, jede Zuweisung und jeder Upload erzeugt einen Eintrag in derselben Transaktion wie die Änderung selbst. Kommentare erscheinen in der Vorgangshistorie über eine gemeinsame Abfrage beider Tabellen.

Die Textbausteine werden aus dem Prototyp vollständig übernommen und versioniert gespeichert. Ein erzeugter Schriftsatz merkt sich die verwendete Version, damit ein früheres Schreiben auch nach einer Textänderung genau so reproduzierbar bleibt.

### 6.7 Auswertungen, Berichte und Erinnerungen

| Tabelle | Wesentliche Felder |
|---|---|
| erinnerungsregel | id, name, bereich, rhythmus, wochentag, monatstag, kanal_email, kanal_chat, aktiv, naechster_lauf |
| erinnerungsregel_empfaenger | regel_id, benutzer_id |
| bericht | id, name, modul, spalten_json, rhythmus, wochentag, monatstag, monat, format_pdf, format_excel, an_intern, an_kunde, kunde_mandant_id, weitere_email, aktiv, naechster_lauf |
| bericht_empfaenger | bericht_id, benutzer_id oder mdt_kontakt_id |
| auftrag | id, art, nutzlast_json, faellig_um, status, versuche, gesperrt_bis, fehler |
| versandprotokoll | id, quelle, empfaenger, kanal, zeitpunkt, ergebnis |

Die Kennzahlen der Auswertungen werden bei jedem Aufruf frisch aus den Fachtabellen berechnet. Bei der zu erwartenden Datenmenge eines Beratungsunternehmens reicht das mit passenden Indizes aus. Erst wenn einzelne Auswertungen messbar langsam werden, lohnen sich vorberechnete Tabellen.

## 7. Zentrale Geschäftsregeln

Die PRD verlangt in Abschnitt 11, dass die modulübergreifenden Regeln an einer Stelle gehalten werden. Technisch heißt das, dass alle Regeln als reine Funktionen ohne Datenbankzugriff im Paket @treaty/regeln liegen. Das Backend nutzt sie für jede verbindliche Berechnung. Das Frontend nutzt dieselben Funktionen für die Live-Vorschau, etwa das WV-Datum, das sich im Formular bei einem Statuswechsel sofort anpasst. Verbindlich ist immer das Ergebnis des Servers.

Die folgenden Regeln sind dem Prototyp-Code entnommen und stimmen mit der Felddokumentation überein, soweit nicht anders vermerkt.

**Arbeitstage.** Als Arbeitstag zählt Montag bis Freitag. Feiertage werden im Prototyp nicht berücksichtigt. Die Funktion erhält trotzdem einen optionalen Feiertagskalender als Parameter, damit sich diese Entscheidung später ohne Umbau ändern lässt (Abschnitt 16).

**Nächster Donnerstag.** Fällt ein Datum bereits auf einen Donnerstag, bleibt es dort. Andernfalls wird es auf den folgenden Donnerstag gelegt.

**WV-Datum bei Statuswechsel.** Bei einem echten Statuswechsel, also wenn sich der Status tatsächlich ändert, wird das WV-Datum aus dem Wechseltag neu berechnet, und zwar auch dann, wenn im selben Speichervorgang ein WV-Datum von Hand eingetragen wurde. Gleichzeitig wird letzte_statusaenderung auf heute gesetzt.

| Status | Arbeitstage | Auf Donnerstag legen |
|---|---|---|
| NEU | 10 | nein |
| in Bearbeitung | 5 | nein |
| AW eingegangen MDT | 5 | nein |
| AW eingegangen VWT | 10 | nein |
| warte auf MDT | 10 | nein |
| warte auf Verwalter | 20 | ja |
| warte auf Dritten | 10 | nein |
| 1. Erinnerung | 20 | ja |
| 2. Erinnerung | 10 | ja |
| 3. Erinnerung | 10 | ja |
| 4. Erinnerung | 15 | ja |
| abgeschlossen | kein WV-Datum | |

**Ampel eines Falls.** Maßgeblich sind die Arbeitstage seit letzte_statusaenderung und nicht der Abstand zum WV-Datum. Ein abgeschlossener Fall ist immer grün.

| Status | Grün bis | Gelb bis | Danach |
|---|---|---|---|
| NEU | 5 | 10 | rot |
| in Bearbeitung, AW eingegangen MDT | 1 | 5 | rot |
| AW eingegangen VWT | 5 | 10 | rot |
| warte auf MDT, Verwalter, Dritten | 10 | 13 | rot |
| 1. Erinnerung | 20 | 23 | rot |
| 2. bis 4. Erinnerung | 10 | 13 | rot |

**Neuanlage eines Falls.** Das WV-Datum liegt genau 14 Kalendertage nach dem Anlagetag, der Status ist NEU. In derselben Transaktion entsteht die Check-Aufgabe (Betriebskosten-Check beziehungsweise Wertsicherungs-Check) mit demselben WV-Datum, ohne Frist-Datum und zugewiesen an den ADH-Bearbeiter des Falls oder, wenn keiner gesetzt ist, an das Team. Bei Mieten wird die Hausverwaltung aus dem Vorjahresfall desselben Standorts vorgeschlagen.

**Kopplung von Fall und Check-Aufgabe.** Ändert sich am Fall das WV-Datum oder der ADH-Bearbeiter, zieht die Check-Aufgabe in derselben Transaktion nach. Wird der Vorgang abgeschlossen, wird auch die Check-Aufgabe abgeschlossen. Diese Kopplung liegt im Dienst des Fall-Moduls an genau einer Stelle, damit sie bei keinem Speicherweg vergessen wird.

**Ampel und Frist einer Aufgabe.** Das WV-Datum einer Aufgabe ist grün ab sechs Tagen bis zum Termin, gelb von null bis fünf Tagen und rot, sobald der Termin verstrichen ist. Ein Frist-Datum entsteht nur von Hand. Es wird bis sieben Tage vor Fälligkeit neutral dargestellt, danach blinkend und nach Ablauf durchgehend rot. „Frist abschließen“ entfernt Frist-Datum und Frist-Titel, ohne die Aufgabe abzuschließen.

**Serienaufgaben.** Beim Abschließen einer Serienaufgabe berechnet die Regel den nächsten Termin. Bei täglich ist es der Folgetag, bei wöchentlich der nächste gewählte Wochentag, bei monatlich der gewählte Tag im Folgemonat, begrenzt auf die Länge dieses Monats, und bei jährlich derselbe Tag im Folgejahr. Ist die Seriendauer noch nicht erreicht, wird die Aufgabe mit dem neuen WV-Datum auf NEU gesetzt, andernfalls endgültig abgeschlossen. Ob die Unteraufgaben dabei zurückgesetzt werden, beschreiben weder PRD noch Felddokumentation (Abschnitt 16). Fällt ein jährlicher Termin auf den 29. Februar, legt Treaty ihn in Jahren ohne Schalttag auf den 28. Februar. Der Prototyp verschiebt ihn an dieser Stelle auf den 1. März.

**Sortierung.** Abgeschlossene Fälle und Aufgaben stehen unabhängig von der gewählten Sortierung immer am Ende. Das wird in der Datenbankabfrage als erstes Sortierkriterium umgesetzt und nicht erst im Frontend, weil die Listen serverseitig paginiert werden.

**Rechnungsberechnung.** Die Formel entspricht dem Prototyp-Code. Jede Teilsumme wird auf zwei Nachkommastellen kaufmännisch gerundet.
- Die Grundgebühr ist die Summe der aktiven Pauschale-Positionen des Mandanten plus der Prüfgebühr. Liegen im Zeitraum abgeschlossene gruppierte Fälle vor, ersetzt die Summe aus gruppiertem Wert mal Prüfgebührsatz den festen Prüfgebührbetrag.
- Das Zeithonorar ist die Summe aus Minuten durch 60 mal Stundensatz über alle abrechenbaren Zeitbuchungen des Mandanten im Zeitraum, deren Aufgabentyp beim Mandanten als aktive Stundensatz-Position geführt ist. Buchungen ohne passende Position zählen mit null.
- Das Erfolgshonorar ist die Summe der Ersparnis abgeschlossener Betriebskosten-Fälle im Zeitraum mal dem aktiven Prozentsatz des Mandanten. Welches Datum dabei über die Zugehörigkeit zum Zeitraum entscheidet, ist offen (Abschnitt 16).
- Die Reisekosten werden auf die Kappungsgrenze des Mandanten begrenzt.
- Der Gesamtbetrag ist die Summe der vier Posten.
- Das Zahlungsziel liegt 30 Tage nach dem Erstelltag, auf den nächsten Donnerstag gelegt.

Die Regeln werden mit Tabellentests abgesichert, die jede Zeile der beiden Tabellen oben, die Monatsenden bei Serien und die Rundung der Rechnungsposten einzeln prüfen. Wo möglich, wird dasselbe Eingabebeispiel gegen den Prototyp gerechnet, um Abweichungen früh zu erkennen.

## 8. Rechte und Sichtbarkeit

Die Rechtematrix aus PRD Abschnitt 3 liegt als Konstante im Paket @treaty/rechte. Daraus werden drei Dinge erzeugt, nämlich die Zugriffsprüfung im Backend, das Ein- und Ausblenden in der Oberfläche und die Kreuzchenliste in der Nutzerverwaltung. Damit können Anzeige und tatsächliche Wirkung nicht auseinanderlaufen, wie die PRD es fordert.

| Bereich | Administrator | Sachbearbeiter/in | Zusatzrecht möglich |
|---|---|---|---|
| Betriebskosten, Mieten, Aufgaben | ja | ja | |
| Office, Zeiterfassung | ja | ja, nur eigene Buchungen | zeiterfassung_alle |
| Kontaktdatenbank | ja | ja | |
| Office, Buchhaltung | ja | nein | buchhaltung |
| Kundenverwaltung | ja | nein | kunden |
| Leistungskatalog | ja | nein | leistungskatalog |
| Nutzerverwaltung | ja | nein | nutzerverwaltung |
| Auswertungen | ja | nein | auswertungen |

Die eigentliche Sperre sitzt im Backend. Jede Route erklärt, welchen Bereich sie braucht, und eine gemeinsame Prüfung lehnt die Anfrage mit 403 ab, wenn weder die Berechtigungsstufe noch ein Zusatzrecht reicht. Die Oberfläche blendet gesperrte Bereiche zusätzlich aus, ist aber nie die einzige Sicherung. Im Prototyp fehlt für den Unter-Tab Kundenverwaltung eine solche Prüfung an einer Stelle. In der Neuumsetzung kann diese Lücke nicht entstehen, weil die Prüfung an der Route hängt und nicht an der Ansicht.

Die feineren Sichtbarkeitsregeln werden in den Datenbankabfragen selbst umgesetzt.
- Bei der Zeiterfassung filtert jede Abfrage einer Sachbearbeiter/in ohne zeiterfassung_alle fest auf die eigene benutzer_id. Beim Anlegen und Ändern setzt der Server benutzer_id auf die angemeldete Person und ignoriert einen abweichenden Wert.
- Bei der Aufgabenauswahl in der Zeiterfassung und bei der Suche im Seitenraster sieht eine Sachbearbeiter/in nur eigene und Team-Aufgaben. Der Server prüft das auch beim Buchen, damit sich über eine manipulierte Anfrage keine Zeit auf eine fremde Aufgabe buchen lässt.
- Im Aufgaben-Hauptmodul sehen alle Nutzer alle Aufgaben, wie die PRD es vorsieht.

Aus der Trennung der Bereiche ergibt sich ein Detail, das PRD und Prototyp nicht ansprechen. Eine Sachbearbeiter/in braucht beim Anlegen eines Falls oder einer Aufgabe die Namen der Mandanten, deren Kontakte und die beim Mandanten aktiven Aufgabentypen, obwohl Kundenverwaltung und Leistungskatalog gesperrt sind. Dafür gibt es eigene Auswahl-Endpunkte, die nur Bezeichnungen und IDs liefern, aber keine Preise, Vertragsdaten oder Kappungsgrenzen.

Die PRD legt fest, dass die Vergabe von Zusatzrechten nicht protokolliert wird. Das wird so umgesetzt. Als Empfehlung sei angemerkt, dass ein schlichtes technisches Sicherheitsprotokoll über Änderungen an Berechtigungen und Anmeldungen im Echtbetrieb üblich ist und bei einer späteren Prüfung der IT-Sicherheit oft verlangt wird. Das könnte getrennt von der fachlichen Historie geführt werden, ohne die Entscheidung der PRD zu berühren.

## 9. Anmeldung und Sitzungen

Weil kein externer Identitätsdienst angebunden wird, muss Treaty die Anmeldung selbst sicher umsetzen. Empfohlen wird folgender Aufbau.

Passwörter werden mit argon2id gehasht. Verlangt wird eine Mindestlänge von 12 Zeichen. Zusätzlich wird gegen eine Liste bekannter, häufig verwendeter Passwörter geprüft, auf erzwungene Wechsel in festen Abständen wird verzichtet. Nach fünf Fehlversuchen wird die Anmeldung für das Konto und die IP-Adresse gesperrt, zunächst für 30 Sekunden und mit jedem weiteren Fehlversuch doppelt so lange, höchstens 15 Minuten. Die Zähler liegen im Speicher des API-Prozesses. Für einen einzelnen Prozess reicht das, bei mehreren Prozessen müssten sie in die Datenbank. Der zweite Faktor per TOTP-App folgt nach der Entscheidung vom 01.10.2026 in einer späteren Ausbaustufe (Abschnitt 16, Nr. 17). Das Datenmodell sieht das Feld dafür bereits vor.

Sitzungen liegen serverseitig in der Tabelle sitzung. Der Browser erhält nur ein zufälliges Sitzungscookie mit den Eigenschaften HttpOnly, Secure und SameSite=Strict. Das macht zusätzlichen Schutz gegen Cross-Site-Request-Forgery weitgehend überflüssig, schreibende Anfragen verlangen trotzdem einen eigenen Header. Eine Sitzung endet nach 8h ohne Aktivität und spätestens nach 12h. Administratoren können Sitzungen anderer Nutzer beenden, und das Sperren eines Kontos beendet alle seine Sitzungen sofort.

Da Treaty keine eigenen E-Mails verschickt (Abschnitt 11), gibt es kein Zurücksetzen des Passworts per E-Mail-Link. Ein Administrator vergibt ein Einmalpasswort, das bei der nächsten Anmeldung geändert werden muss. Sollte doch ein Mailversand eingerichtet werden, lässt sich der übliche Ablauf nachrüsten.

## 10. Dateiablage

Dateien liegen im Dateisystem des Servers unter /var/lib/treaty/dateien, also außerhalb des Webverzeichnisses. Apache kann sie nicht direkt ausliefern. Jeder Download läuft über die API, die vorher prüft, ob die anfragende Person den zugehörigen Fall oder die Aufgabe sehen darf.

Gespeichert wird unter einem zufälligen Schlüssel mit Jahresordnern, etwa 2026/3f9a.../datei, und nicht unter dem Originalnamen. Originalname, Kategorie, Unterkategorie, Titel, Größe und eine SHA-256-Prüfsumme stehen in der Tabelle datei. So gibt es keine Probleme mit Sonderzeichen und keine Kollisionen, und die Prüfsumme erkennt doppelte Uploads und beschädigte Dateien. Die Ordneransicht „Ordner öffnen“ mit SV, MV, NKA & Belege und bei Mieten zusätzlich DMR ist eine Darstellung dieser Metadaten und kein echter Ordner auf der Platte.

Ein einzelner Upload ist auf 50MB begrenzt, gleichlautend in Apache und im Node-Dienst. Erlaubt sind die üblichen Büroformate, also PDF, Word, Excel, Bilder sowie E-Mail-Dateien im Format msg und eml. Der Dateityp wird anhand des Inhalts geprüft und nicht nur anhand der Endung. Empfohlen wird außerdem eine Virenprüfung mit ClamAV durch den Worker. Bis die Prüfung abgeschlossen ist, lässt sich die Datei noch nicht herunterladen. Aufgaben erlauben höchstens 25 Anhänge, wie in der Felddokumentation festgelegt.

Für Unterkategorien mit automatischer Benennung, also DMR und Indexanpassung bei Mieten, bildet der Server den Titel aus dem Datum im Fall. Bei „Andere“ und „fehlender“ ist ein eigener Titel Pflicht.

## 11. Outlook und Schriftsätze

### 11.1 E-Mail-Entwürfe

Treaty verschickt keine E-Mails selbst, sondern erzeugt Entwürfe, die die bearbeitende Person in Outlook öffnet, prüft und abschickt. Dafür gibt es zwei Wege, die sich ergänzen.

Für eine einfache Nachricht ohne Anhang, etwa per Doppelklick auf Counterpart oder Bearbeiter bei MDT, erzeugt Treaty einen mailto-Link mit Empfänger und Betreff. Das öffnet sofort ein neues Fenster im Standard-Mailprogramm. Ein mailto-Link kann aber keine Anhänge tragen und ist in der Länge begrenzt.

Für Schreiben mit Anhang, etwa einen Widerspruch als PDF, erzeugt Treaty eine eml-Datei mit Empfänger, Betreff, Text, Anhängen und dem Header `X-Unsent: 1`. Outlook für Windows öffnet eine solche Datei als noch nicht gesendeten Entwurf mit Senden-Schaltfläche. Ob das auch im neuen Outlook und im Web-Outlook so funktioniert, muss mit den bei ADH eingesetzten Versionen getestet werden, denn hier gibt es Unterschiede zwischen den Versionen.

Ob eine Mail tatsächlich verschickt wurde, erfährt Treaty bei diesem Weg nicht. Die Historie vermerkt deshalb nur, dass ein Entwurf erzeugt wurde.

### 11.2 Schriftsätze

Der Prototyp zeigt Briefe nur als Vorschau. In der Neuumsetzung erzeugt „Brief erstellen“ aus Textbaustein, Falldaten und Signaturblock ein PDF über eine HTML-Vorlage mit Briefkopf, Betreffblock, Fließtext und den beiden Signaturspalten nebeneinander. Die Platzhalter für die Frist (heute plus 14 Tage, auf Donnerstag gelegt) und das letzte Schreiben werden serverseitig gefüllt. Das Feld Rechnungsnummer bleibt leer und wird vor dem Erzeugen von Hand eingetragen, wie die PRD es vorsieht. Vor dem Erzeugen lässt sich der Text wie im Prototyp noch frei ergänzen.

Das fertige PDF kann direkt in der Ablage des Falls unter SV mit passender Unterkategorie gespeichert werden, etwa „1. Erinnerung“. Das schließt einen Kreis, denn der Platzhalter „letztes Schreiben“ wird schon im Prototyp aus genau diesen ausgehenden SV-Dateien ermittelt. Anschließend kann Treaty dazu einen E-Mail-Entwurf mit dem PDF als Anhang erzeugen.

## 12. Rechnungsexport

### 12.1 CSV

Der CSV-Export ist eine Übersicht für die Buchhaltung und ersetzt nicht die Rechnung selbst. Er enthält je Rechnung eine Zeile mit Nummer, Datum, Mandant, Zeitraum, Zahlungsziel, den vier Einzelposten, Nettobetrag, Umsatzsteuer, Bruttobetrag und dem Status. Die Datei wird mit Semikolon als Trennzeichen, Komma als Dezimalzeichen und in UTF-8 mit BOM geschrieben, damit ein deutsches Excel sie ohne Umwege korrekt öffnet. Welche Spalten die Buchhaltung genau braucht, sollte mit ihr abgestimmt werden, bevor das Format feststeht.

### 12.2 ZUGFeRD-Rechnung

Treaty erzeugt jede Rechnung als PDF mit eingebetteten ZUGFeRD-Daten. Eine solche Datei ist für Menschen eine gewöhnliche, lesbare Rechnung und enthält zugleich alle Rechnungsdaten maschinenlesbar als XML. Eine getrennte XRechnung wird nicht erzeugt. Im Prototyp ist das Rechnungs-PDF nur simuliert.

Rechtlich ist die E-Rechnung zwischen Unternehmen in Deutschland zunehmend Pflicht. Seit dem 01.01.2025 müssen Unternehmen elektronische Rechnungen empfangen können. Ab dem 01.01.2027 müssen Unternehmen mit mehr als 800.000€ Vorjahresumsatz sie auch ausstellen, ab dem 01.01.2028 alle Unternehmen (§14 UStG). ZUGFeRD erfüllt diese Pflicht, allerdings nur in einem Profil, das der europäischen Norm EN 16931 entspricht. Die einfacheren Profile MINIMUM und BASIC WL gelten nicht als E-Rechnung im Sinne des Gesetzes. Treaty verwendet daher das Profil EN 16931 (früher COMFORT) in der jeweils aktuellen Version 2.x des Standards, die vor der Umsetzung zu bestätigen ist.

Technisch ist eine ZUGFeRD-Rechnung ein PDF im Archivformat PDF/A-3, in das eine Datei factur-x.xml in der Syntax UN/CEFACT CII eingebettet ist. Das PDF trägt Metadaten, die Profil und Version der eingebetteten Daten ausweisen. Sichtbarer Inhalt und XML müssen inhaltlich übereinstimmen, deshalb werden beide aus demselben Datensatz erzeugt.

Empfohlen wird folgende Erzeugungskette im Node-Dienst.
1. Aus der festgeschriebenen Rechnung entsteht ein typisiertes Datenobjekt mit allen Pflichtangaben.
2. Daraus erzeugt ein eigener TypeScript-Baustein die CII-XML.
3. Aus derselben Rechnung wird eine HTML-Vorlage gefüllt, die Chromium in ein PDF umwandelt, wie bei den Schriftsätzen.
4. Ghostscript wandelt dieses PDF in PDF/A-3b um.
5. pdf-lib bettet die XML-Datei mit der vorgeschriebenen Kennzeichnung ein und ergänzt die Metadaten.

Jede Rechnung, die Treaty in den Tests erzeugt, wird im Build mit dem Mustang-Validator geprüft. Er prüft sowohl das PDF/A-Format als auch die Geschäftsregeln der EN 16931. Der Validator braucht Java, das aber nur in der Build-Umgebung und nicht auf dem Server.

Ein Risiko liegt in der PDF/A-Umwandlung. Ob die Ausgabe von Chromium nach der Umwandlung durch Ghostscript die PDF/A-Prüfung zuverlässig besteht, lässt sich erst im Versuch zeigen. Deshalb ist dafür in der ersten Ausbaustufe ein Proof of Concept vorgesehen. Besteht die Kette die Prüfung nicht, ist die Rückfallebene das quelloffene Werkzeug Mustangproject auf dem Server, das PDF und XML zu einer gültigen ZUGFeRD-Datei zusammenführt. Es braucht dann allerdings auch dort Java.

Der Proof of Concept ist am 01.10.2026 gelungen. Mit Ghostscript 10.02.1 aus Ubuntu 24.04, dem Chromium von Playwright und pdf-lib entsteht ein PDF/A-3b, das der Mustang-Validator 2.26.0 sowohl in der PDF/A-Prüfung als auch bei den Geschäftsregeln der EN 16931 ohne Fehler und ohne Warnung annimmt. Die Rückfallebene wird damit nicht gebraucht. Ein Gegentest mit absichtlich falscher Gesamtsumme lehnt der Validator mit den Regeln BR-CO-15 und BR-CO-16 ab, er nimmt also nicht einfach alles an. Java ist nur für den Validator nötig und damit nur in der Build- und Testumgebung. Der Code liegt unter backend/src/modules/rechnungen/zugferd, eine Beispielrechnung erzeugt `pnpm zugferd:beispiel`.

Für eine gültige Rechnung fehlen im Datenstand des Prototyps mehrere Angaben. Es fehlen die Umsatzsteuer mit Kategorie, Satz und Betrag, die Angaben zu ADH als Rechnungssteller wie Anschrift, Steuernummer oder USt-IdNr. und Bankverbindung, eine vollständige Rechnungsanschrift des Mandanten und der Leistungszeitraum als eigenes Feld. Diese Felder sind im Datenmodell eingeplant (Abschnitt 6.5). Die Umsatzsteuer betrifft auch die Berechnung selbst, denn der Gesamtbetrag ist heute ein Nettobetrag. Eine Käuferreferenz, die eine XRechnung zwingend verlangt hätte, ist im Profil EN 16931 nicht nötig.

Das PDF wird beim Festschreiben genau einmal erzeugt, mit Prüfsumme in der Dateiablage gespeichert und mit der Rechnung verknüpft. Danach wird es nie neu erzeugt, auch wenn sich Stammdaten oder Vorlage ändern, denn die versendete Fassung ist das maßgebliche Dokument. An den Mandanten geht die Rechnung über einen E-Mail-Entwurf mit dem PDF als Anhang (Abschnitt 11.1). Die Aufbewahrungsfrist für Rechnungen beträgt derzeit 8 Jahre. Das sollte mit dem Steuerbüro bestätigt und in der Datensicherung berücksichtigt werden.

### 12.3 Nachträgliche Änderung von Rechnungen

Die PRD sieht vor, dass sich eine erstellte Rechnung von Hand anpassen lässt. Für eine noch nicht versendete Rechnung ist das unproblematisch. Für eine versendete Rechnung widerspricht es aber den Grundsätzen ordnungsmäßiger Buchführung (GoBD), nach denen eine ausgestellte Rechnung nicht mehr verändert, sondern nur durch eine Stornorechnung und eine neue Rechnung korrigiert werden darf. Empfohlen wird deshalb, Änderungen nur im Status Entwurf zuzulassen. Mit dem Festschreiben ist die Rechnung samt ZUGFeRD-PDF unveränderlich. Für eine Korrektur erzeugt Treaty eine Stornorechnung, die über storno_von_id auf die ursprüngliche Rechnung verweist, und anschließend eine neue Rechnung. Das ist eine Abweichung von der PRD und daher in Abschnitt 16 aufgeführt.

## 13. Datenmigration aus dem heutigen Treaty

Über das heutige Treaty liegen in den Unterlagen keine technischen Angaben vor, weder zur Datenbank noch zur Dateiablage noch zum Umfang der Daten. Die Migration kann daher erst nach einer Analyse des Altsystems im Detail geplant werden. Das Vorgehen lässt sich aber schon festlegen.

Zuerst wird das Altsystem analysiert, also Schema, Datenmengen, Datenqualität und der Ort der Dateien. Daraus entsteht eine Zuordnungstabelle von alten zu neuen Feldern, einschließlich der Übersetzung von Status, Kategorien und Personen. Die Importskripte im Ordner migration laden die Altdaten zuerst in Zwischentabellen und überführen sie von dort in das neue Schema. Sie sind wiederholbar und lassen sich beliebig oft gegen eine leere Datenbank ausführen. Nach jedem Probelauf vergleicht ein Abgleichbericht Anzahlen und Summen zwischen Alt und Neu, etwa Fälle je Status, Ersparnis je Mandant oder Zeitstunden je Monat. Die Umstellung selbst erfolgt an einem festgelegten Termin mit eingefrorenem Altsystem, letztem Import, Abgleich und Freigabe durch den Fachbereich.

Einige Punkte sind absehbar und sollten früh entschieden werden.
- Bestehende WV-Daten werden übernommen und nicht nach den neuen Regeln neu berechnet, sonst verschieben sich bei der Umstellung schlagartig alle Wiedervorlagen. Die Regeln greifen ab dem ersten Statuswechsel nach der Umstellung.
- Für offene Bestandsfälle ohne Check-Aufgabe ist zu entscheiden, ob eine Check-Aufgabe nachträglich angelegt wird.
- Bisherige Fall- und Aufgabennummern bleiben als fallnummer erhalten, weil sie in Schriftverkehr und Ablage verwendet werden.
- Die Rechnungsnummern müssen nahtlos an die bisherige Nummernfolge anschließen. Weicht das bisherige Format von RE-JAHR-NNNN ab, ist zu klären, ab wann das neue gilt.
- Passwörter lassen sich in aller Regel nicht übernehmen. Alle Nutzer erhalten zur Umstellung ein Einmalpasswort.
- Die Historie wird übernommen, soweit das Altsystem sie liefert, und in Treaty als migriert gekennzeichnet.
- Dateien werden mit Prüfsumme übernommen und den neuen Kategorien zugeordnet. Was sich nicht zuordnen lässt, landet unter „Andere“.

Für die Analyse wird ein Zugang zum Altsystem oder zumindest ein vollständiger Datenbankexport mit Beispieldateien benötigt.

## 14. Exporte, Hintergrundaufgaben und Echtzeit

Die Excel- und PDF-Exporte der Auswertungen erzeugt der Server, nicht der Browser, damit die Rechteprüfung greift und auch große Datenmengen nicht am Browser scheitern. Kleine Exporte werden direkt in der Anfrage erzeugt. Umfangreiche Exporte laufen als Auftrag im Worker und stehen nach Fertigstellung zum Download bereit. Die Aufteilung breiter PDF-Tabellen in mehrere lesbare Teile, die die PRD für die Berichte beschreibt, wird in der HTML-Vorlage umgesetzt. Die bisher simulierten Exporte in Betriebskosten, Mieten und Aufgaben werden mit demselben Dienst echt.

Hintergrundaufträge stehen in der Tabelle auftrag. Der Worker holt fällige Aufträge mit SELECT ... FOR UPDATE SKIP LOCKED, sodass auch mehrere Worker-Prozesse denselben Auftrag nie doppelt ausführen. Ein zusätzlicher Dienst wie Redis ist dafür nicht nötig. Zeitgesteuerte Erinnerungsregeln und Berichte legen beim Speichern ihren nächsten Lauf fest, der Worker führt sie aus und plant den folgenden Lauf.

Für die terminierten Erinnerungen und Berichte gibt es einen ungeklärten Punkt. Die PRD sieht ihren Versand per E-Mail an Mitarbeitende und an Kunden-Ansprechpersonen sowie per Chatbenachrichtigung vor. Die Vorgabe, dass Treaty nur Entwürfe erzeugt, schließt einen automatischen Versand aber aus. Ohne einen Versandweg, etwa über den SMTP-Server von ADH, kann der Worker diese Aufträge nur innerhalb von Treaty zustellen, also als Benachrichtigung im Seitenraster und als Bericht zum Herunterladen. Welcher Chat gemeint ist, nennen die Unterlagen nicht. Beides ist in Abschnitt 16 aufgeführt.

Die Datenschutzregel für Berichte aus PRD Abschnitt 9 wird beim Erzeugen erzwungen und nicht in der Oberfläche. Geht ein Bericht an eine Kunden-Ansprechperson, filtert der Server die gesamte Datei auf deren Mandanten, auch wenn derselbe Bericht zugleich intern verschickt wird.

Für Echtzeit-Benachrichtigungen hält der Browser eine WebSocket-Verbindung unter /ws. Darüber erfährt das Seitenraster sofort von neuen Kommentaren an die angemeldete Person. Außerdem wird gemeldet, wenn jemand einen gerade geöffneten Fall geändert hat, sodass die Ansicht neu lädt, bevor ein Speicherkonflikt entsteht. Die Verbindung prüft beim Aufbau dasselbe Sitzungscookie wie die API.

## 15. Betrieb, Sicherheit und Datenschutz

**Server und Dienste.** Auf dem Ubuntu-24.04-Server laufen Apache nach PRD Abschnitt 13, MySQL 8.0 sowie die beiden systemd-Dienste treaty-api und treaty-worker unter dem Systembenutzer treaty. Die Dienste werden mit den Schutzoptionen von systemd eingeschränkt, etwa auf Schreibrechte nur in /var/lib/treaty. MySQL lauscht nur lokal. Die Anwendung nutzt einen eigenen Datenbankbenutzer ohne Rechte zur Schemaänderung, Migrationen laufen beim Deployment mit einem getrennten Benutzer.

**Deployment.** Jede Version wird in der Build-Umgebung gebaut und getestet und als Paket auf den Server gebracht. Dort liegt sie in einem eigenen Release-Verzeichnis. Nach den Datenbankmigrationen wird ein Verweis auf das neue Release umgestellt und die Dienste werden neu gestartet. Ein Rücksprung auf das vorige Release ist damit in Sekunden möglich, sofern die Migration abwärtskompatibel war. Als Verweis dienen die symbolischen Links unter /var/www/treaty. Während der Entwicklung zeigen sie auf den Projektordner /home/ccode/treaty, im Produktivbetrieb auf das jeweils aktive Release-Verzeichnis. Apache-Konfiguration und systemd-Units bleiben dabei unverändert. Neben der Produktion sollte es eine Testumgebung mit anonymisierten Daten geben, in der der Fachbereich neue Versionen vor dem Einspielen abnimmt.

**Datensicherung.** Die Datenbank wird nachts mit mysqldump im Modus --single-transaction vollständig gesichert, bei wachsender Datenmenge mit Percona XtraBackup, die Dateiablage mit einem inkrementellen Verfahren, und beides wird auf ein zweites System außerhalb des Servers übertragen. Die Aufbewahrungsdauer sollte sich an den Aufbewahrungspflichten für Rechnungen orientieren. Eine Rücksicherung wird regelmäßig tatsächlich ausprobiert, weil eine nie getestete Sicherung keine verlässliche Sicherung ist.

**Überwachung.** Ein Endpunkt /api/health meldet den Zustand von Datenbank, Dateiablage und Worker. Fehler werden strukturiert nach journald geschrieben. Ob ein bestehendes Monitoring bei ADH angebunden werden soll, ist mit dem Serverbetrieb zu klären.

**Datenschutz.** Treaty verarbeitet personenbezogene Daten von Kontaktpersonen bei Mandanten und Hausverwaltungen, von Eigentümern und von den eigenen Mitarbeitenden. Für Treaty sollte ein Eintrag im Verarbeitungsverzeichnis angelegt und ein Löschkonzept festgelegt werden, etwa für Kontakte ohne verbleibende Fälle. Besondere Aufmerksamkeit verdient die Zeiterfassung. Auswertungen wie Stunden je Mitarbeiter oder der Benutzerbericht mit einem Tabellenblatt je Person sind technisch geeignet, Leistung und Verhalten zu überwachen. Besteht bei ADH ein Betriebsrat, ist dafür nach §87 Abs. 1 Nr. 6 BetrVG dessen Mitbestimmung erforderlich. Das sollte vor der Einführung geklärt werden.

## 16. Entscheidungsbedarf

Die folgenden Punkte sind vor oder während der Umsetzung zu entscheiden. Bei jedem ist vermerkt, woher der Befund stammt, und eine Empfehlung angegeben.

| Nr. | Thema | Befund | Empfehlung |
|---|---|---|---|
| 1 | Feiertage bei Arbeitstagen | Prototyp und Felddoku zählen nur Montag bis Freitag. | Bundesweite Feiertage plus die des Bundeslands am Sitz von ADH berücksichtigen, sonst fallen WV-Daten auf Feiertage. Technisch ist beides vorbereitet. |
| 2 | Umfang von „Alle abschließen“ beim Vorgangsabschluss | Der Code schließt alle offenen Aufgaben des Mandanten, auch die anderer Fälle, Jahre und Module, und übergeht die Serienlogik. | Nur Aufgaben des abgeschlossenen Falls schließen. Serien regulär fortsetzen. |
| 3 | Bezugsdatum des Erfolgshonorars | Der Code nimmt das Datum der letzten Statusänderung, obwohl es ein Abschluss-Datum gibt. | Abschluss-Datum verwenden, damit eine spätere Datenkorrektur den Fall nicht in einen anderen Abrechnungszeitraum verschiebt. |
| 4 | Mieten im Erfolgshonorar | Der Code berücksichtigt nur Betriebskosten-Fälle. PRD und Felddoku sagen dasselbe, ob das fachlich gewollt ist, ist unklar. | Bestätigen lassen. |
| 5 | Doppelte Abrechnung von Zeitbuchungen | Abgerechnete Zeitbuchungen werden nicht markiert. | Zeitbuchungen beim Erstellen der Rechnung mit der Rechnung verknüpfen und danach sperren. |
| 6 | Änderung versendeter Rechnungen | PRD erlaubt nachträgliche Anpassung jeder Rechnung. | Änderung nur im Entwurf, danach Storno und neue Rechnung (GoBD). |
| 7 | Umsatzsteuer und Pflichtangaben | Der Prototyp kennt keine Umsatzsteuer und keine Angaben zum Rechnungssteller. | Umsatzsteuer, Stammdaten von ADH und Rechnungsanschrift aufnehmen. Voraussetzung für eine gültige ZUGFeRD-Rechnung. |
| 8 | Abrechenbarkeit einer Zeitbuchung | Laut PRD folgt sie aus dem Leistungskatalog des Mandanten, im Code aus dem zentralen Katalog (alles außer Typ Intern). | Mandantenbezogen ableiten, so wie die PRD es beschreibt. |
| 9 | Versand von Erinnerungen und Berichten | PRD sieht E-Mail und Chat vor, die Vorgabe lautet „nur Entwürfe“. | Für Systemnachrichten einen SMTP-Versand über den Mailserver von ADH zulassen oder den Versand auf Benachrichtigungen in Treaty beschränken. Gemeinten Chat benennen. |
| 10 | Kontaktdatenbank und Mieten | PRD nennt Betriebskosten und Mieten als Quelle, Felddoku und Code nur Betriebskosten. | Beide Module einbeziehen, durch das neue Datenmodell ohnehin naheliegend. |
| 11 | Frist-Erinnerungen an Aufgaben | Nur im Prototyp-Code vorhanden, weder in PRD noch in Felddoku beschrieben. | Fachlich bestätigen oder streichen. |
| 12 | Vertragsstatus „Gekündigt“ | Felddoku nennt vier Werte, der Code nur drei. | Alle vier übernehmen. |
| 13 | Weitergabe Rechtsabteilung | Im Code eine einfache Feldansicht, keine strukturierte Prüftabelle. | Klären, welches Dokument die Rechtsabteilung erhalten soll, und als PDF-Vorlage umsetzen. |
| 14 | Pflege der Textbausteine | Im Prototyp fest im Code. | Zunächst als versionierte Seed-Daten übernehmen, eine Bearbeitungsmaske für Administratoren in einer späteren Ausbaustufe. |
| 15 | Unteraufgaben bei Serien | Nicht beschrieben, ob sie beim nächsten Serientermin zurückgesetzt werden. | Zurücksetzen, weil eine Serie dieselbe Tätigkeit wiederholt. |
| 16 | Eindeutigkeit der Standortnummer | Duplikatsprüfung beschrieben, aber nicht, ob global oder je Mandant. | Je Mandant eindeutig, sofern die Nummern von den Mandanten stammen. |
| 17 | Zweiter Faktor bei der Anmeldung | Nicht Teil der Unterlagen. | Entschieden am 01.10.2026, TOTP folgt in einer späteren Ausbaustufe. Das Feld im Datenmodell ist vorbereitet. |
| 18 | Zugang zum Altsystem | Keine technischen Angaben vorhanden. | Datenbankexport und Beispieldateien bereitstellen, Ansprechperson für das Altsystem benennen. |
| 19 | Mitbestimmung bei der Zeiterfassung | Auswertungen je Mitarbeiter vorgesehen. | Vor Einführung mit dem Betriebsrat klären, falls vorhanden. |
| 20 | Zeitpunkt der Rechnungsnummer | Im Prototyp erhält eine Rechnung ihre Nummer schon beim Erstellen. | Nummer erst beim Festschreiben vergeben, damit verworfene Entwürfe keine Lücken in der Nummernfolge hinterlassen. |

## 17. Vorschlag für die Umsetzungsreihenfolge

Empfohlen wird eine Umsetzung in Ausbaustufen, von denen jede für sich in der Testumgebung abgenommen werden kann. Die Reihenfolge folgt den fachlichen Abhängigkeiten, denn Fälle brauchen Mandanten und Standorte, Rechnungen brauchen Zeitbuchungen und abgeschlossene Fälle, und Auswertungen brauchen alles andere.

1. **Grundlagen.** Repository, Build und Tests, Server mit Apache und Datenbank, Anmeldung, Benutzer, Rechtematrix und Zusatzrechte, das Paket @treaty/regeln mit vollständigen Tests. Dazu ein Proof of Concept für die ZUGFeRD-Erzeugung, der eine Beispielrechnung erzeugt und durch den Mustang-Validator bringt. Parallel beginnt die Analyse des Altsystems. Stand 01.10.2026 ist diese Stufe umgesetzt, offen ist nur die Analyse des Altsystems, für die noch der Zugang fehlt.
2. **Stammdaten.** Mandanten mit Vertrag, Leistungskatalog und Zuordnung je Mandant, Standorte mit PLZ-Liste, Hausverwaltungen und Kontakte, Kontaktdatenbank.
3. **Betriebskosten und Aufgaben.** Fallliste mit Filtern, Datenblatt, Statuslogik mit WV-Datum und Ampel, Check-Aufgabe, Aufgabenmodul mit Serien und Vorlagen, Historie, Kommentare mit Seitenraster und WebSocket, Dateiablage, Prüfbogen, Vorgang abschließen und Archivierung.
4. **Mieten und Schriftverkehr.** Mieten auf der gemeinsamen Fall-Basis, Schriftsätze als PDF, E-Mail-Entwürfe.
5. **Office.** Zeiterfassung mit Timer und Kalender, Rechnungserstellung, Festschreiben mit ZUGFeRD-PDF, Storno, CSV-Export.
6. **Auswertungen.** Die fünf Unter-Tabs, Excel- und PDF-Exporte, Berichte und Erinnerungsregeln mit dem in Punkt 9 gewählten Versandweg.
7. **Migration und Umstellung.** Probeläufe mit Abgleichberichten, Schulung, Umstellungstermin, Parallelphase mit Lesezugriff auf das Altsystem.

Eine Aufwandsschätzung ist erst sinnvoll, wenn die Punkte aus Abschnitt 16 entschieden sind und die Analyse des Altsystems vorliegt, weil vor allem die Migration und die Rechnungsthemen den Umfang stark beeinflussen.

## 18. Abnahme und Qualitätssicherung

Jede fachliche Regel aus PRD und Felddokumentation wird zu mindestens einem automatisierten Test. Die Regeln aus Abschnitt 7 werden als Tabellentests geprüft, die Rechte als Matrix aus Bereich, Berechtigungsstufe und Zusatzrecht gegen jede Route. Die zentralen Arbeitsabläufe werden als Ende-zu-Ende-Tests im Browser abgebildet, darunter eine neue Abrechnung mit automatischer Check-Aufgabe, ein Statuswechsel mit neuem WV-Datum, das Abschließen einer Serienaufgabe, die Zeiterfassung einer Sachbearbeiter/in und eine Rechnung mit allen vier Posten. Jedes ZUGFeRD-PDF, das in den Tests entsteht, muss den Mustang-Validator ohne Fehler bestehen, sonst schlägt der Build fehl. Tests mit Datenbank laufen gegen eine eigene Datenbank treaty_test, die das Einrichtungsskript deploy/mysql/setup.sh anlegt, und berühren die eigentlichen Daten nie.

Für die fachliche Abnahme wird die Felddokumentation zur Checkliste. Jede Zeile gilt als erfüllt, wenn das beschriebene Verhalten in der Testumgebung nachvollziehbar ist. Der Prototyp bleibt bis zur Umstellung als Referenz bestehen. Weicht die Neuumsetzung von ihm ab, muss das auf eine Entscheidung aus Abschnitt 16 zurückgehen.
