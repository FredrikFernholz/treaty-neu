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
