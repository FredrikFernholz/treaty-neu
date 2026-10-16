# Entscheidungen Treaty 2.0

Hier werden fachliche und technische Entscheidungen festgehalten, die PRD und Konzeption offenlassen oder die von ihnen abweichen. Jeder Eintrag nennt Datum, Anlass, Entscheidung und Auswirkung. Spätere Änderungen an einer Entscheidung werden als neuer Eintrag ergänzt, der alte bleibt stehen.

## 15.10.2026, Anmeldung per Kürzel, E-Mail Pflicht und eindeutig

**Anlass.** Konzeption Abschnitt 9 beschreibt Passwortregeln, Sperren und Sitzungen, legt aber nicht fest, mit welchem Merkmal sich ein Nutzer anmeldet. Die Tabelle `benutzer` (Konzeption 6.2) führt sowohl ein Kürzel als auch eine E-Mail-Adresse.

**Entscheidung.** Die Anmeldung erfolgt mit dem Kürzel und dem Passwort. Die E-Mail-Adresse ist trotzdem ein Pflichtfeld und muss eindeutig sein.

**Auswirkung.** In der Datenbank sind `kuerzel` und `email` beide `NOT NULL` und mit einer Eindeutigkeitsregel versehen (Migration `0000_benutzer`). Das Kürzel ist nach der Anlage nicht mehr änderbar und damit ein stabiles Anmeldemerkmal. Die Anmeldemaske in Ausbaustufe 1 fragt nach Kürzel und Passwort.

## 15.10.2026, Geldbeträge mit decimal.js und als Text in der API

**Anlass.** CLAUDE.md verlangt, Geldbeträge nie als JavaScript-`number` zu rechnen, und lässt die Wahl zwischen `decimal.js` und Ganzzahlen in Cent offen. Die Rechnungsregeln in Konzeption Abschnitt 7 enthalten Rechenschritte, die nicht in ganzen Cent aufgehen. Dazu gehören das Zeithonorar (Minuten durch 60 mal Stundensatz, gerundet erst als Teilsumme) und das Erfolgshonorar (Ersparnis mal Prozentsatz, auch mit Nachkommastellen).

**Entscheidung.** Geld wird mit `decimal.js` gerechnet, und zwar ausschließlich über das Modul `backend/src/shared/regeln/geld.ts`. Kein anderer Code verwendet `decimal.js` direkt. Gerundet wird kaufmännisch auf 2 Nachkommastellen (`ROUND_HALF_UP`, bei negativen Beträgen vom Nullpunkt weg), und zwar je Teilsumme dort, wo die Geschäftsregel es verlangt. Zwischenergebnisse bleiben ungerundet. In der API werden Geldbeträge immer als Text übertragen, nie als JSON-Zahl. Eingehende Beträge prüft das gemeinsame Schema `geldbetragSchema` in `backend/src/shared/schemas/geldbetrag.ts`. Es nimmt nur Text im Format einer DECIMAL(12,2)-Spalte mit höchstens 2 Nachkommastellen an.

**Auswirkung.** Beträge aus der Datenbank (mysql2 liefert DECIMAL als Text, `decimalNumbers` bleibt aus) werden mit `betrag()` eingelesen und mit `alsDbWert()` zurückgeschrieben. `alsDbWert()` verweigert ungerundete Beträge, damit eine vergessene Rundung sofort auffällt. Negative Beträge sind im Schema erlaubt, etwa für Stornos und Gutschriften. Felder, die nur positive Beträge zulassen, schränken das an ihrer Stelle zusätzlich ein. Ganzzahlen in Cent wurden verworfen, weil sie bei Division und Prozentsätzen trotzdem Bruchteile erzeugen und eine eigene, fehleranfällige Umrechnung zwischen Text und Cent erfordern würden.

## 15.10.2026, Entscheidungen des Fachteams zu Regeln, Sichtbarkeit und Ausbaustufen

Quelle für alle Punkte dieses Abschnitts ist eine Rückfrage bei N. Zibulski am 15.10.2026.

### WV-Datum und Ampel bei „in Bearbeitung“

**Anlass.** PRD und Konzeption sehen ein WV-Datum nach 5 Arbeitstagen und eine Ampel mit grün bis 1 und gelb bis 5 vor. Die Entwicklerdoku des Altsystems (Abschnitt 6.2) nennt für den Neubau 7 Arbeitstage mit grün 5 und gelb 2 (Abgleich A-01).

**Entscheidung.** Es gilt der Stand von PRD und Konzeption. Das WV-Datum liegt 5 Arbeitstage nach dem Wechseltag, die Ampel ist grün bis 1 und gelb bis 5 Arbeitstage, danach rot.

### WV-Datum bei „4. Erinnerung“

**Anlass.** Konzeption, Felddokumentation vom 13.10.2026 und Prototyp-Code legen das WV-Datum bei „4. Erinnerung“ auf 15 Arbeitstage.

**Entscheidung.** Das WV-Datum liegt 10 Arbeitstage nach dem Wechseltag und wird auf den nächsten Donnerstag gelegt. Das gilt ausdrücklich entgegen Felddokumentation und Prototyp-Code. Die Ampel bleibt unverändert grün bis 10 und gelb bis 13 Arbeitstage.

**Auswirkung.** Beim Gegenrechnen gegen den Prototyp-Code ist die Abweichung bei „4. Erinnerung“ gewollt und kein Fehler.

### Zählweise der Arbeitstage

**Entscheidung.** Der Ausgangstag zählt nicht mit. Ein WV-Datum „nach n Arbeitstagen“ ist der n-te Arbeitstag nach dem Wechseltag. Für die Ampel zählen die Arbeitstage nach der letzten Statusänderung bis einschließlich heute, am Tag des Wechsels also 0.

### Feiertage

**Anlass.** Konzeption Abschnitt 16 Nr. 1.

**Entscheidung.** Feiertage spielen keine Rolle, Arbeitstage sind Montag bis Freitag. Der optionale Feiertagsparameter der Arbeitstagfunktionen darf bleiben, eine Feiertagsliste wird nicht eingebaut.

### Prüfbogen

**Entscheidung.** Der Prüfbogen wird vorerst nicht umgesetzt und aus Ausbaustufe 3 herausgenommen.

### Sichtbarkeit von Aufgaben

**Anlass.** PRD Abschnitt 3 und Konzeption Abschnitt 8 beschränken die Sichtbarkeit für Sachbearbeiter/innen nur bei der Aufgabenauswahl in der Zeiterfassung und bei der Suche im Seitenraster. Im Aufgabenmodul selbst sehen dort alle Nutzer alle Aufgaben.

**Entscheidung.** Sachbearbeiter/innen sehen überall, auch im Aufgabenmodul, nur Aufgaben, die ihnen selbst zugewiesen sind, die „ADH“ (dem Team) zugewiesen sind oder bei denen sie Follower sind. Administratoren sehen alle Aufgaben. Das weicht bewusst von PRD Abschnitt 3 ab.

**Auswirkung.** Die Follower-Funktion ist damit Pflicht und muss mit den Aufgaben umgesetzt werden. Ob eine Aufgabe einen oder mehrere Follower haben kann, ist noch offen (Abgleich A-02). Die Sichtbarkeit wird in den Datenbankabfragen des Aufgabenmoduls durchgesetzt, nicht nur in der Oberfläche.

### Reihenfolge der Ausbaustufen

**Entscheidung.** Das Vertragsmanagement wird als eigene Ausbaustufe direkt nach Mieten umgesetzt. Weitere Wünsche aus Entwicklerdoku und Geschäftsführungsvorgabe (Texterkennung, automatischer Widerspruch, Matching, Kunden-Upload, Anbindung an n8n oder make) kommen erst nach dem Grundsystem.

## 16.10.2026, Technische Rahmenbedingungen gelten trotz PRD vom 13.10.2026 weiter

**Anlass.** Der PRD vom 13.10.2026 fehlen die Ergänzungen vom 01.10.2026, also der Abschnitt Betrieb und Auslieferung und die festgelegten technischen Rahmenbedingungen. Stattdessen empfiehlt sie, die technische Konzeption auf das Vertragsmanagement-Backend des Prototyps in PHP aufzusetzen (Abgleich A-03).

**Entscheidung.** Die technischen Rahmenbedingungen vom 01.10.2026 gelten unverändert weiter. Dazu gehören TypeScript auf Node.js, MySQL 8.0, die Auslieferung über Apache, eine eigene Benutzerverwaltung, die Ablage der Dateien im Dateisystem, Outlook nur mit Entwürfen, Rechnungen nach ZUGFeRD EN 16931 mit der CSV-Rechnungsliste und die Übernahme der Bestandsdaten. Dass diese Punkte in der PRD vom 13.10.2026 fehlen, gilt als Versehen. Die Empfehlung, auf dem PHP-Backend aufzusetzen, wird nicht übernommen.

**Auswirkung.** Konzeption und CLAUDE.md bleiben für die Technik maßgeblich. Der PHP-Port unter `docs/referenz/prototyp-backend/` dient weiter nur zum Nachschlagen.

## 16.10.2026, Ampel und Frist-Anzeige einer Aufgabe

**Anlass.** PRD 7 und Konzeption 7 legen nicht eindeutig fest, wie die Frist vor der Blinkgrenze dargestellt wird, ob WV-Datum und Frist eine gemeinsame Farbe ergeben und welche Ampel eine abgeschlossene Aufgabe zeigt. Die Entwicklerdoku des Altsystems (Abschnitt 8.2) zeigt die Frist vorher gelb und fasst beide Daten zu einer Farbe zusammen (Abgleich A-11).

**Entscheidung.** Gezählt werden Kalendertage. Eine Frist ist mehr als 7 Tage vor Fälligkeit neutral, wie in der PRD, ab 7 Tagen vorher bis zum Fälligkeitstag blinkend und danach rot. WV-Ampel und Frist-Anzeige bleiben getrennt, eine gemeinsame Farbe gibt es nicht. Eine zusätzliche Sortierung nach Dringlichkeit ist später möglich. Eine abgeschlossene Aufgabe hat immer eine grüne Ampel und keine Frist-Anzeige.

**Auswirkung.** `ampelAufgabe` und `fristAnzeige` in `backend/src/shared/regeln/aufgabe.ts` bekommen neben dem Datum das Kennzeichen `abgeschlossen` und sind dafür mit Tests abgedeckt.

## 16.10.2026, Seriendauer und Fortsetzung einer Serienaufgabe

**Anlass.** Konzeption 7 und Felddokumentation beschreiben, wie der nächste Serientermin berechnet wird, aber nicht, von welchem Tag aus, was mit Terminen in der Vergangenheit geschieht und wie die Seriendauer gezählt wird. Konzeption 16 Nr. 15 lässt offen, ob Unteraufgaben zurückgesetzt werden (Abgleich A-12).

**Entscheidung.** Der nächste Termin wird vom bisherigen WV-Datum der Aufgabe aus berechnet. Liegt er vor heute, wird weitergerechnet, bis er heute oder später liegt. Übersprungene Termine zählen für „Endet nach n Terminen“ als verbraucht. Die angelegte Aufgabe ist Termin 1. Bei „Endet am“ gilt ein Termin genau am Enddatum noch. Beim nächsten Serientermin werden die Unteraufgaben zurückgesetzt, wie es Konzeption 16 Nr. 15 empfiehlt.

**Auswirkung.** Die Berechnung des nächsten Termins und das Ende der Serie liegen in `backend/src/shared/regeln/serie.ts` und sind mit Tests abgedeckt. Das Zurücksetzen der Unteraufgaben ist ein Datenbankvorgang und wird in Ausbaustufe 3 im Aufgaben-Dienst umgesetzt, in derselben Transaktion wie die Fortsetzung. Konzeption 16 Nr. 15 ist damit entschieden.

## 16.10.2026, Fälligkeiten am Wochenende je nach Modul

Quelle ist eine Antwort des Fachteams vom 16.10.2026.

**Anlass.** Offen war, ob berechnete Fälligkeiten auf ein Wochenende fallen dürfen, etwa das WV-Datum eines neuen Falls (Anlagetag plus 14 Kalendertage) oder ein täglicher Serientermin, und ob Mieten dabei wie Betriebskosten behandelt wird (Abgleich A-13 und A-15).

**Entscheidung.** In Betriebskosten liegen Fälligkeiten nur auf Montag bis Freitag, Feiertage spielen keine Rolle. In allen anderen Modulen, ausdrücklich auch in Mieten, dürfen Fälligkeiten auf Wochenenden und Feiertage fallen. Die Tabelle für das WV-Datum nach einem Statuswechsel gilt für Betriebskosten und Mieten unverändert (Arbeitstage, gegebenenfalls Donnerstag), sie liefert ohnehin immer einen Werktag.

**Auswirkung.** Bei der Neuanlage eines Betriebskosten-Falls wird ein WV-Datum, das auf Samstag oder Sonntag fällt, auf den folgenden Montag geschoben, bei Mieten bleibt es unverändert. Die Check-Aufgabe übernimmt wie bisher das Datum ihres Falls. Bei Serien bleibt „täglich“ der Folgetag einschließlich Wochenende. Ein von Hand eingetragenes WV-Datum ist nur bei Betriebskosten auf Montag bis Freitag beschränkt (Merkposten für Ausbaustufe 3).

## 16.10.2026, Zahlungsziel ab dem Festschreiben der Rechnung

**Anlass.** Konzeption 7 und CLAUDE.md legen das Zahlungsziel auf 30 Tage nach dem Erstelltag, die Felddokumentation (Office, Erstellen-Formular) auf 30 Tage in der Zukunft. Ein Entwurf kann aber länger liegen, bevor die Rechnung festgeschrieben und versendet wird (Abgleich A-14).

**Entscheidung.** Das Zahlungsziel wird beim Festschreiben der Rechnung berechnet. Es liegt 30 Kalendertage nach dem Rechnungsdatum, also dem Festschreibetag, und wird dann auf den nächsten Donnerstag gelegt. Fällt der 30. Tag auf einen Donnerstag, bleibt er dort. So hat der Mandant die volle Frist ab der versendeten Rechnung.

**Auswirkung.** Die Regel bekommt das Rechnungsdatum als Parameter, nicht den Erstelltag des Entwurfs. Im Entwurf steht noch kein verbindliches Zahlungsziel. CLAUDE.md ist entsprechend angepasst.

## 16.10.2026, Reisekosten ohne Kappung und eine Prüfgebühr-Position je Mandant

Quelle ist eine Antwort des Fachteams vom 16.10.2026.

**Anlass.** Im Prototyp ist die Reisekosten-Kappung ein Pflichtfeld mit Vorgabewert 0, ein Mandant ohne eingetragene Kappung bekäme also keine Reisekosten berechnet. Bei mehreren Prüfgebühr-Positionen addiert der Prototyp ohne gruppierte Fälle alle Preise, mit gruppierten Fällen nimmt er nur den ersten (Abgleich A-16).

**Entscheidung.** Ist keine Reisekosten-Kappung eingetragen, sind die Reisekosten unbegrenzt. Eine eingetragene Kappung von 0,00€ bleibt eine echte Grenze von 0€. Reisekosten werden in der Praxis kaum abgerechnet. Je Mandant darf höchstens eine Prüfgebühr-Position aktiv sein.

**Auswirkung.** `berechneRechnung` in `backend/src/shared/regeln/rechnung.ts` nimmt die Kappung optional (null bedeutet keine Kappung, die Reisekosten werden voll übernommen und gelten als nicht gedeckelt) und wirft einen Fehler, wenn mehr als eine aktive Prüfgebühr-Position übergeben wird. Für Ausbaustufe 2 ist ein Merkposten angelegt, damit die Stammdaten beides schon bei der Eingabe sicherstellen.

## 16.10.2026, Grundlagen der Ausbaustufe 1 (Hashing, Passwortliste, Rechtematrix, Sicherheitsprotokoll)

**Anlass.** Vor Beginn der Ausbaustufe 1 waren vier Punkte offen. Es ging um das Paket für argon2id (das Paket `argon2` braucht ein Build-Skript), die Liste häufiger Passwörter aus Konzeption 9, den Bereich Vertragsmanagement in der Rechtematrix (Abgleich A-10) und das in Konzeption 8 empfohlene technische Sicherheitsprotokoll.

**Entscheidung.**
- Passwörter werden mit `@node-rs/argon2` gehasht, das ohne Build-Skript auskommt. Die Lizenz wird bei der Installation geprüft. Die Parameter entsprechen mindestens der OWASP-Empfehlung, also argon2id mit 19MiB Speicher, t=2 und p=1. Sie stehen als Konstante mit Kommentar in der Konfiguration.
- Die Liste häufiger Passwörter besteht aus den Top 10.000 aus SecLists und einer kurzen eigenen Ergänzung mit Firmenbegriffen (adh, treaty, Firmenname, Jahreszahlen). Die Lizenz von SecLists wird geprüft und in der Datei vermerkt. Die Liste ist im Repository versioniert, verglichen wird ohne Beachtung der Groß- und Kleinschreibung.
- Der Bereich `vertraege` wird jetzt in der Rechtematrix angelegt. Er steht beiden Berechtigungsstufen offen, ein Zusatzrecht gibt es dafür nicht.
- Das Sicherheitsprotokoll wird jetzt umgesetzt, als eigene Tabelle getrennt von der fachlichen Historie. Protokolliert werden erfolgreiche und fehlgeschlagene Anmeldungen, Sperren, Passwortwechsel, die Vergabe eines Einmalpassworts und beendete Sitzungen. Änderungen an Rechten werden nicht protokolliert, wie die PRD es festlegt (Rückfrage bei der Geschäftsführung als Abgleich A-17). Einträge werden nach 90 Tagen gelöscht. Das Aufräumen übernimmt später der Worker.

**Auswirkung.** Ausbaustufe 1 wird in elf Teilschritten umgesetzt, beginnend mit der Rechtematrix in `backend/src/shared/rechte`. Für die lokale Entwicklung genügt localhost, weil Browser Secure-Cookies dort akzeptieren. Geprüft wird über localhost oder `fastify.inject`.

## 16.10.2026, Liste häufiger Passwörter nur mit Einträgen ab 12 Zeichen, Höchstlänge 256

**Anlass.** Die zuerst gewählte Liste, die Top 10.000 aus SecLists, enthält nur 24 Einträge mit mindestens 12 Zeichen. Alle anderen lehnt schon die Mindestlänge ab, die Liste hätte also kaum zusätzlich geschützt. Außerdem war die Höchstlänge von 256 Zeichen für Passwörter noch nicht als Entscheidung festgehalten. Dieser Eintrag ändert die Entscheidung von heute zur Passwortliste, der frühere Eintrag bleibt stehen.

**Entscheidung.**
- Die Liste aus SecLists besteht aus den 10.000 häufigsten Einträgen mit mindestens 12 Zeichen aus `Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt`, selbe Quelle und selber Commit (`f1196104c5594a19d78b486c52c0794b9d947993`). Herkunft, Filterregel und die Prüfsummen von Quelle und Ergebnis stehen im Dateikopf.
- Das Filterskript `backend/tools/passwortliste-erzeugen.mjs` liegt im Repository, damit die Liste reproduzierbar ist. Die Quelldatei mit 1 Million Einträgen wird nicht eingecheckt.
- Die eigene Ergänzung wird um deutsche Muster erweitert. Das sind Passwort, Willkommen, Hallo, Geheim, Sommer, Winter, Frühling und Herbst, jeweils mit den Jahreszahlen 2020 bis 2030 und mit oder ohne „!“, dazu Tastaturfolgen der QWERTZ-Tastatur und Zahlenfolgen wie 123456789012. Aufgenommen werden nur Einträge ab 12 Zeichen.
- Ein Passwort darf höchstens 256 Zeichen lang sein. Die Grenze schützt den Server davor, mit sehr langen Eingaben für argon2 beschäftigt zu werden. Sie liegt weit über den mindestens 64 Zeichen, die OWASP zulassen will, schränkt Passphrasen also nicht ein.

**Auswirkung.** Das Skript lädt die Quelle vom festen Commit, prüft deren SHA-256 und bricht bei einer Abweichung ab. Zweimal ausgeführt ergibt es byteweise dieselben Dateien. Die Tests prüfen, dass der Inhalt jeder Liste zur Prüfsumme im Kopf passt und die Filterregel einhält. Die Höchstlänge steht in `backend/src/shared/schemas/passwort.ts`.

## 16.10.2026, Benutzer werden nie gelöscht, nur deaktiviert

**Anlass.** Die Tabellen der Migration `0001_anmeldung` hängen per Fremdschlüssel am Benutzer. Ein gelöschter Benutzer würde Bezüge in Sitzungen, Zusatzrechten und Protokoll verlieren und später auch in fachlichen Daten wie Fällen, Aufgaben und Zeitbuchungen.

**Entscheidung.** Benutzer werden nie gelöscht, sondern nur deaktiviert (`aktiv = false`). Das Deaktivieren beendet sofort alle Sitzungen des Benutzers. Die API bietet kein Löschen von Benutzern an. Fremdschlüssel aus Fachtabellen auf `benutzer`, die ab Ausbaustufe 3 entstehen, werden mit `ON DELETE RESTRICT` angelegt, damit ein versehentliches Löschen in der Datenbank scheitert.

**Auswirkung.** Die Löschregeln in Migration `0001_anmeldung` (CASCADE bei Zusatzrechten und Sitzungen, SET NULL beim Sicherheitsprotokoll) bleiben bestehen. Sie greifen nur, wenn ein Benutzer außerhalb von Treaty gelöscht wird, etwa beim Aufräumen von Testdaten, und hinterlassen dann nichts Verwaistes. Das Beenden der Sitzungen beim Deaktivieren gehört zur Benutzerverwaltung in Teilschritt 9.

## 16.10.2026, Fehlversuchssperre je Konto und IP und je IP

**Anlass.** Konzeption 9 sperrt nach fünf Fehlversuchen „für das Konto und die IP-Adresse“, ohne festzulegen, ob das Paar gezählt wird oder beides getrennt. Offen war auch, wann ein Zähler wieder vergessen wird.

**Entscheidung.**
- Gezählt wird das Paar aus Konto und IP nach Konzeption 9. Ab dem 5. Fehlversuch wird gesperrt, zunächst 30 Sekunden, dann jeweils doppelt so lange, höchstens 15 Minuten.
- Zusätzlich gibt es einen Zähler nur je IP über alle Konten. Ab 20 Fehlversuchen wird die IP gesperrt, höchstens 5 Minuten. Die Sperre beginnt ebenfalls bei 30 Sekunden und verdoppelt sich (Annahme bei der Umsetzung, vorgegeben war nur die Obergrenze).
- Ein Zähler wird nach 60 Minuten ohne neuen Fehlversuch vergessen, gerechnet ab dem letzten Fehlversuch bzw. dem Ende der letzten Sperre.
- Versuche während einer laufenden Sperre zählen nicht und verlängern sie nicht (bei der Umsetzung festgelegt, damit sich ein Konto nicht durch Dauerversuche beliebig lange sperren lässt).

**Auswirkung.** `backend/src/modules/anmeldung/fehlversuchssperre.ts` enthält die Regeln `KONTO_IP_REGEL` und `IP_REGEL`. Die Anmelderoute (Teilschritt 7) verwendet je Regel eine eigene Instanz.

## 16.10.2026, Sitzungen bei Passwortwechsel und Einmalpasswort

**Anlass.** Konzeption 9 legt fest, dass das Sperren eines Kontos alle Sitzungen beendet, sagt aber nichts zum Passwortwechsel und zum Einmalpasswort.

**Entscheidung.**
- Ändert jemand das eigene Passwort, auch beim Pflichtwechsel nach einem Einmalpasswort, werden alle anderen Sitzungen dieses Kontos beendet. Die aktuelle Sitzung bleibt bestehen. Im Sicherheitsprotokoll steht als Grund `passwort_geaendert`.
- Vergibt ein Administrator ein Einmalpasswort, werden alle Sitzungen des Kontos beendet.
- Beim Beenden einer Sitzung laufen Löschen und Protokolleintrag in einer gemeinsamen Transaktion. Protokolliert wird nur, wenn das Löschen tatsächlich eine Sitzung entfernt hat, damit gleichzeitige Anfragen keinen doppelten Eintrag erzeugen.

**Auswirkung.** `beendeAlleSitzungen` in `backend/src/modules/anmeldung/sitzungen.ts` hat dafür die Option `ausserSitzungId`. Passwortwechsel und Einmalpasswort selbst entstehen in den Teilschritten 7 und 9.

## 16.10.2026, Sitzungscookie, Zugriffsprüfung und Anmeldefehler

**Anlass.** Konzeption 9 beschreibt Sitzungscookie und Schutz schreibender Anfragen nur in Grundzügen. Für die Umsetzung von Teilschritt 7 waren Name und Eigenschaften des Cookies, der Pflicht-Header, die Fehlercodes und das Verhalten bei Anmeldefehlern festzulegen.

**Entscheidung.**
- Für Cookies wird das offizielle Plugin `@fastify/cookie` verwendet (MIT, Lizenz nach Installation geprüft).
- Das Sitzungscookie heißt `__Host-treaty_sitzung` und ist HttpOnly, Secure, SameSite=Strict mit Path `/`, ohne Domain. Es bekommt kein Ablaufdatum, ist also ein Sitzungscookie des Browsers. Die Grenzen von 8h ohne Aktivität und 12h insgesamt erzwingt der Server. Sollte das Präfix `__Host-` in Teilschritt 10 über localhost Probleme machen, wird das gemeldet.
- Schreibende Anfragen (POST, PUT, PATCH, DELETE) unter `/api/v1` brauchen den Header `X-Treaty: 1`, sonst antwortet der Server mit 403.
- Ohne gültige Sitzung antwortet der Server mit 401, bei einem nach der Rechtematrix nicht erlaubten Bereich mit 403. Solange ein Passwortwechsel nötig ist, sind nur „ich“, „Passwort ändern“ und „Abmelden“ erlaubt.
- Anmeldefehler verraten nicht, ob das Kürzel existiert. Unbekanntes Kürzel, falsches Passwort und deaktiviertes Konto ergeben dieselbe Meldung. Bei unbekanntem Kürzel wird trotzdem gegen einen festen Platzhalter-Hash geprüft, damit die Antwortzeit gleich bleibt. Im Sicherheitsprotokoll steht der echte Grund.
- Greift die Fehlversuchssperre, antwortet der Server mit 429 und dem Header `Retry-After`.

**Auswirkung.** Jede Route unter `/api/v1` muss erklären, welchen Zugriff sie verlangt. Eine Route ohne diese Angabe lässt den Start scheitern, statt still offen zu sein. Umgesetzt in Teilschritt 7b (Zugriffsprüfung) und 7c (Anmelderouten).

## 16.10.2026, Einzelheiten der Anmelderouten

**Anlass.** Bei der Umsetzung der Anmelderouten (Teilschritt 7c) waren vier Einzelheiten offen, die weder Konzeption 9 noch die bisherigen Entscheidungen regeln.

**Entscheidung.**
- Eine erfolgreiche Anmeldung setzt nur den Zähler für Konto und IP zurück, nicht den Zähler je IP. Sonst ließe sich der IP-Zähler mit einem eigenen gültigen Konto immer wieder leeren. Das präzisiert die Entscheidung zur Fehlversuchssperre von heute.
- Anmeldeversuche während einer Sperre werden mit dem Grund „gesperrt“ protokolliert, aber höchstens ein Eintrag je Sperre und Schlüssel, damit ein automatisierter Angriff das Sicherheitsprotokoll nicht flutet.
- Ein falsches bisheriges Passwort beim Passwortwechsel zählt als Fehlversuch, sonst ließe sich über diese Route ein Passwort ohne Sperre durchprobieren.
- Das neue Passwort darf nicht dem bisherigen entsprechen, insbesondere nicht dem Einmalpasswort.

**Auswirkung.** Umgesetzt in `backend/src/modules/anmeldung/routen.ts` und `fehlversuchssperre.ts` (`ersteMeldungWaehrendSperre`), mit Tests, darunter 50 Versuche während einer Sperre mit genau einem Eintrag „gesperrt“.

## 16.10.2026, Kürzel, E-Mail, erster Administrator und Testlauf

**Anlass.** Beim Anlegen des ersten Administrators (Teilschritt 8) waren das Format des Kürzels, die Schreibweise der E-Mail-Adresse, der Schutz des Kommandos und der Ablauf der Tests festzulegen.

**Entscheidung.**
- Ein Kürzel hat 2 bis 10 Zeichen, nur Großbuchstaben und Ziffern. Die Eingabe wird ohne Leerzeichen am Rand und in Großbuchstaben übernommen, aus „ab“ wird „AB“.
- Das Kürzel „ADH“ ist gesperrt. Es ist der reservierte Sammelwert für die Zuweisung an das Team und darf keiner einzelnen Person gehören.
- E-Mail-Adressen werden klein geschrieben gespeichert, damit „A@x.de“ und „a@x.de“ nicht als zwei Adressen gelten.
- Das Kommando `pnpm benutzer:erster-administrator` legt nur dann einen Administrator an, wenn es noch keinen aktiven Administrator gibt. Er bekommt ein zufälliges Einmalpasswort und muss bei der ersten Anmeldung ein eigenes festlegen.
- Die Testdateien laufen nacheinander (`fileParallelism: false`), weil sich Tests mit der gemeinsamen Testdatenbank sonst gegenseitig stören können. Die Suite braucht dadurch etwa 12 statt 5 Sekunden.

**Auswirkung.** Die Regeln für Kürzel, Name und E-Mail stehen in `backend/src/shared/schemas/benutzer.ts` und gelten auch für die Benutzerverwaltung (Teilschritt 9). Ob alle Kürzel im Altsystem dem Format entsprechen, wird bei der Migration geprüft (Merkposten für Stufe 7).

## 16.10.2026, Benutzerverwaltung: Kürzelvorschlag, Rechtevergabe, Schutzregeln

**Anlass.** Felddokumentation und Konzeption widersprechen sich beim Kürzel (automatisch gebildet oder nur vorgeschlagen, Abgleich A-18) und bei der Frage, wer Rechte vergeben darf (nur Administratoren oder auch Personen mit dem Zusatzrecht nutzerverwaltung, Abgleich A-19). Dazu kamen Schutzregeln gegen das Aussperren und die Frage der Seitenaufteilung.

**Entscheidung.**
- Das Kürzel wird bei der Neuanlage aus Vor- und Nachname vorgeschlagen, etwa „Anna Beispiel“ → „AB“, bei Kollision „ABE“, danach „AB2“. Vor dem Speichern lässt es sich ändern, nach dem Anlegen ist es unveränderlich (Konzeption 6.2). Der Vorschlag ergibt nie „ADH“.
- Berechtigungsstufe und Zusatzrechte ändern nur Administratoren. Wer als Sachbearbeiter/in das Zusatzrecht nutzerverwaltung hat, kann Sachbearbeiter/innen anlegen, ändern, deaktivieren und mit einem Einmalpasswort versehen, aber keine Administratoren und nicht sich selbst. Er oder sie kann niemanden zum Administrator machen und niemandem ein Zusatzrecht geben, auch sich selbst nicht.
- Niemand kann sich selbst deaktivieren oder die eigene Berechtigungsstufe herabsetzen. Der letzte aktive Administrator kann weder deaktiviert noch herabgestuft werden.
- Die Benutzerliste wird nicht seitenweise aufgeteilt, weil ADH nur wenige Dutzend Benutzer hat. Das ist eine bewusste Ausnahme von der Leitplanke, Listen serverseitig zu paginieren.

**Auswirkung.** Umgesetzt in Teilschritt 9 (`backend/src/modules/benutzer`), mit Tests für jede dieser Regeln.

## 16.10.2026, Einmalpasswörter in der Benutzerverwaltung

**Anlass.** Bei Deaktivieren, Einmalpasswort und Sitzung beenden (Teilschritt 9c) waren der Umgang mit Einmalpasswörtern in Antworten und Logs, das eigene Konto, deaktivierte Konten und die Fehlversuchssperre festzulegen.

**Entscheidung.**
- Jede Antwort, die ein Einmalpasswort enthält (Anlegen eines Benutzers, Neuvergabe), trägt `Cache-Control: no-store`, damit weder Browser noch ein Proxy sie zwischenspeichern.
- Einmalpasswörter erscheinen nie in der Log-Ausgabe, auch nicht auf der ausführlichsten Stufe. Ein Test fängt die pino-Ausgabe ab und durchsucht sie.
- Für das eigene Konto kann niemand ein Einmalpasswort vergeben, auch kein Administrator. Dafür gibt es den Passwortwechsel.
- Einem deaktivierten Konto kann ein Einmalpasswort vergeben werden. Die Anmeldung bleibt trotzdem gesperrt, bis das Konto wieder aktiv ist. So lässt sich beim Reaktivieren gleich ein neues Passwort vergeben.
- Beim Vergeben eines Einmalpassworts werden alle Zähler „Konto und IP“ zu diesem Kürzel gelöscht, über alle IPs. Die reinen IP-Zähler bleiben unverändert. Ein gesperrtes Konto kann sich damit sofort mit dem neuen Passwort anmelden, eine gesperrte IP bleibt gesperrt.

**Auswirkung.** Umgesetzt in `backend/src/modules/benutzer` (`vergibEinmalpasswort`, Routen) und `backend/src/modules/anmeldung` (`vergissKontoSperren`, `Fehlversuchssperre.vergissMitAnfang`), jeweils mit Tests.
