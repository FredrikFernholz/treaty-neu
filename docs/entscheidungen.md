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
