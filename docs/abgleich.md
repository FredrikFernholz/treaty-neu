## A-01 Ampel und WV-Datum bei „in Bearbeitung“
- PRD/Konzeption: WV nach 5 Arbeitstagen, Ampel grün bis 1, gelb bis 5
- Entwicklerdoku 6.2: Neu für Rebuild: Frist 7 Arbeitstage, grün 5, gelb 2, rot ab Tag 8
- Betrifft: Schritt 2.3 (Regeln), Stufe 3
- Status: entschieden
- Entscheidung: PRD/Konzeption gilt (5 Arbeitstage, grün bis 1, gelb bis 5), siehe docs/entscheidungen.md vom 15.10.2026

## A-02 Anzahl Follower je Aufgabe
- Entscheidung 15.10.2026: Sachbearbeiter/innen sehen Aufgaben, bei denen sie Follower sind, die Follower-Funktion ist damit Pflicht
- Offen: Kann eine Aufgabe einen oder mehrere Follower haben?
- Auswirkung: ein Feld follower_id an der Aufgabe oder eine eigene Tabelle aufgabe_follower
- Betrifft: Stufe 3 (Aufgaben), Datenmodell Konzeption 6.4
- Status: offen
- Entscheidung: –

## A-03 PRD vom 13.10.2026 ohne die Ergänzungen vom 01.10.2026
- PRD alt (Stand 01.10.2026): Abschnitt 13 Betrieb und Auslieferung (Apache, 127.0.0.1, 50MB, 300s, deploy/apache/treaty.conf) und in Abschnitt 16 die festen technischen Rahmenbedingungen (TypeScript auf Node.js, Vue, MySQL 8.0, eigene Anmeldung, Dateien im Dateisystem, Outlook nur Entwürfe, Rechnung als PDF mit ZUGFeRD EN 16931, CSV-Rechnungsliste, Übernahme der Bestandsdaten)
- PRD neu (13.10.2026): beides fehlt, der Stand baut offenbar auf der Fassung vom 24.09.2026 auf. Abschnitt 16 empfiehlt stattdessen, eine technische Konzeption erst zu erarbeiten und sie auf das Vertragsmanagement-Backend des Prototyps (PHP) aufzusetzen
- Konzeption Abschnitte 2 und 15 sowie CLAUDE.md legen die Rahmenbedingungen unverändert fest, im Projekt gibt es kein PHP
- Empfehlung: Rahmenbedingungen gelten weiter wie in Konzeption und CLAUDE.md. Das Fachteam bitten, die Ergänzungen vom 01.10.2026 wieder in die PRD aufzunehmen
- Betrifft: alle Stufen, insbesondere Betrieb und Office (ZUGFeRD)
- Status: entschieden
- Entscheidung: Rahmenbedingungen vom 01.10.2026 gelten unverändert weiter, ihr Fehlen in der PRD vom 13.10.2026 gilt als Versehen, kein Aufsetzen auf dem PHP-Backend, siehe docs/entscheidungen.md vom 16.10.2026

## A-04 Versand der Vertrags-Erinnerungen
- PRD 6 und Felddoku Vertragsmanagement: Erinnerungen zu Optionsfrist, Kündigung bis, Mietende und Indexanpassung gehen per E-Mail, Chat oder beidem an ADH-Kürzel und an Kontakte der Kunden. Im Prototyp simuliert, die PRD nennt den Versandweg selbst als offenen Punkt
- Konzeption 14 und 16 Nr. 9: Vorgabe „nur Entwürfe“ schließt automatischen Versand aus, welcher Chat gemeint ist, ist unbekannt
- Empfehlung: zusammen mit Konzeption 16 Nr. 9 entscheiden, damit Aufgaben, Auswertungen und Verträge denselben Versandweg nutzen
- Betrifft: Stufe Vertragsmanagement, Worker
- Status: offen
- Entscheidung: –

## A-05 Frist-Erinnerungen an Aufgaben
- Konzeption 16 Nr. 11: nur im Prototyp-Code vorhanden, weder in PRD noch in Felddoku beschrieben, fachlich bestätigen oder streichen
- PRD 6 und Felddoku Vertragsmanagement (13.10.2026) setzen sie jetzt als bestehende Funktion voraus („nach derselben Logik wie die Frist-Erinnerungen bei Aufgaben“)
- Der Befund in Konzeption 16 Nr. 11 stimmt damit nur noch teilweise, eine Entscheidung fehlt weiterhin
- Betrifft: Stufe 3 (Aufgaben), Stufe Vertragsmanagement
- Status: offen
- Entscheidung: –

## A-06 Prüfhinweis zum Preisklauselgesetz
- PRD 6 und Felddoku: Bei automatischer Gleitklausel vergleicht ein Hinweis die Gesamtlaufzeit inkl. Optionen mit den zehn Jahren nach §3 PrKG
- PRD 16 nennt die fachliche oder rechtliche Abstimmung des Hinweistexts als offen
- Betrifft: Stufe Vertragsmanagement
- Status: offen
- Entscheidung: –

## A-07 Übernahme der Bestandsverträge und Block Vertragsunterlagen
- PRD 16: offen, ob und wie die Verträge aus der Excel-Vertragsdatenbank übernommen werden und ob der Block Vertragsunterlagen der bisherigen Vertragskarte in die neue Karte gehört
- Konzeption 13 beschreibt nur die Migration aus dem heutigen Treaty, nicht aus der Excel-Arbeitsmappe
- Betrifft: Stufe Vertragsmanagement, Stufe 7 (Migration)
- Status: offen
- Entscheidung: –

## A-08 Zeitraum „sechs Monate“ im Vertragsmanagement
- Felddoku: Kennzahl „Fristen in sechs Monaten“ und Filterschalter zählen bis 183 Tage, die Fristampel ist gelb bis 180 Tage
- Ein Vertrag mit Frist in 181 bis 183 Tagen ist damit grün, wird aber als Frist in sechs Monaten gezählt
- Empfehlung: Grenzen so übernehmen, wie sie im Prototyp stehen, oder einheitlich auf 180 Tage oder auf sechs Kalendermonate legen
- Betrifft: Stufe Vertragsmanagement
- Status: offen
- Entscheidung: –

## A-09 Umfang des Exports im Vertragsmanagement
- Felddoku Toolbar: zu klären, ob Export und Druck die Verträge der aktuellen Auswahl oder alle Verträge umfassen
- Betrifft: Stufe Vertragsmanagement
- Status: offen
- Entscheidung: –

## A-10 Vertragsmanagement fehlt in der Konzeption
- Konzeption Abschnitte 6 (Datenmodell), 8 (Rechte) und 17 (Reihenfolge) kennen das Modul nicht. Die Reihenfolge ist entschieden (15.10.2026), Datenmodell und Rechtematrix noch nicht
- PRD 13: Für die Datenhaltung des Moduls gilt schema.sql des Prototyps, im Zweifel vor der Felddoku
- schema.sql weicht von den Leitplanken der Konzeption ab: keine Spalte version, Zeitpunkte als DATETIME statt DATETIME(3) in UTC, Status-Vorbelegung aktiv statt vorgeschlagen wie im Formular laut Felddoku, Archivieren über DELETE
- Empfehlung: schema.sql bestimmt die fachlichen Felder und Tabellen, Typen, version, Zeitstempel und API-Form folgen der Konzeption. Bereich vertraege in die Rechtematrix aufnehmen (beide Berechtigungsstufen, laut PRD 3)
- Vorgabe 16.10.2026: Vor Beginn der Stufe Vertragsmanagement wird die Konzeption in einem eigenen Arbeitsschritt um das Modul ergänzt. Vorlage ist schema.sql, aber mit Spalte version und Zeitpunkten als DATETIME(3) gemäß den Leitplanken
- Betrifft: Stufe Vertragsmanagement
- Status: offen
- Entscheidung: –

## A-11 Ampel und Frist-Anzeige einer Aufgabe
- PRD 7 und Konzeption 7: WV-Datum grün ab 6 Tagen bis zum Termin, gelb 0 bis 5, rot nach Ablauf. Frist „bis sieben Tage vor Fälligkeit neutral, danach blinkend gelb-rot“, nach Ablauf rot. Ob Kalender- oder Arbeitstage gemeint sind und was genau 7 Tage vorher gilt, steht dort nicht
- Entwicklerdoku Altsystem 8.2 (vom Fachteam bestätigt): Kalendertage, blinkend „ab 7 Tage vor dem Frist-Datum“, rot ab 1 Tag danach. Mehr als 7 Tage vorher ist die Frist dort gelb statt neutral, und die Aufgabe hat nur eine Farbe, bei der die dringlichere von WV-Datum und Frist den Ausschlag gibt
- Umgesetzt (aufgabe.ts, 16.10.2026): Kalendertage, Frist neutral bis 8 Tage vorher, blinkend von 7 Tagen vorher bis zum Fälligkeitstag, danach rot. WV-Ampel und Frist-Anzeige getrennt wie in PRD und Konzeption, keine gemeinsame Farbe
- Ebenfalls offen: welche Ampel eine abgeschlossene Aufgabe zeigt (beim Fall immer grün, bei der Aufgabe nicht beschrieben)
- Betrifft: Schritt 2 (Regeln), Stufe 3 (Aufgaben)
- Status: entschieden
- Entscheidung: Frist vorher neutral wie PRD, WV-Ampel und Frist getrennt, abgeschlossene Aufgabe immer grün und ohne Frist-Anzeige, siehe docs/entscheidungen.md vom 16.10.2026

## A-12 Seriendauer und Fortsetzung einer Serie
- Konzeption 7 und Felddoku Aufgaben: Beim Abschließen wird der nächste Serientermin berechnet, ist die Seriendauer (kein Enddatum, Endet am, Endet nach n Terminen) nicht erreicht, wird die Aufgabe mit neuem WV-Datum auf NEU gesetzt
- Offen war, von welchem Tag aus gerechnet wird, was mit Terminen in der Vergangenheit geschieht, ob die angelegte Aufgabe als Termin zählt, ob ein Termin am Enddatum noch gilt und ob Unteraufgaben zurückgesetzt werden (Konzeption 16 Nr. 15)
- Betrifft: Schritt 2 (Regeln), Stufe 3 (Aufgaben)
- Status: entschieden
- Entscheidung: vom bisherigen WV-Datum aus rechnen, bis der Termin heute oder später liegt, übersprungene Termine zählen als verbraucht, die angelegte Aufgabe ist Termin 1, ein Termin am Enddatum gilt noch, Unteraufgaben werden zurückgesetzt, siehe docs/entscheidungen.md vom 16.10.2026

## A-13 Tägliche Serie am Wochenende
- Konzeption 7 und Felddoku: bei „täglich“ ist der nächste Termin der Folgetag, ob Wochenenden ausgelassen werden, stand nicht fest
- Betrifft: Schritt 2 (Serien), Stufe 3 (Aufgaben)
- Status: entschieden
- Entscheidung: „täglich“ bleibt der Folgetag einschließlich Wochenende, Aufgaben gehören nicht zu Betriebskosten, siehe docs/entscheidungen.md vom 16.10.2026

## A-14 Bezugstag des Zahlungsziels
- Konzeption 7 und CLAUDE.md: Zahlungsziel 30 Tage nach dem Erstelltag, auf den nächsten Donnerstag gelegt. Felddoku Office: „liegt automatisch 30 Tage in der Zukunft“ im Erstellen-Formular
- Ein Entwurf kann länger liegen, bis er festgeschrieben und versendet wird, die Frist des Mandanten würde dann verkürzt
- Betrifft: Schritt 2 (Regeln), Stufe 5 (Office)
- Status: entschieden
- Entscheidung: 30 Kalendertage ab Rechnungsdatum (= Festschreibetag), berechnet beim Festschreiben, dann auf den nächsten Donnerstag, ein Donnerstag bleibt, siehe docs/entscheidungen.md vom 16.10.2026

## A-15 Fälligkeiten in Mieten am Wochenende
- Offen war, ob Mieten bei Fälligkeiten wie Betriebskosten behandelt wird (nur Montag bis Freitag)
- Betrifft: Schritt 2 (Neuanlage eines Falls), Stufe 3 und 4
- Status: entschieden
- Entscheidung: nein, in Mieten dürfen Fälligkeiten auf Wochenenden und Feiertage fallen, nur Betriebskosten ist auf Montag bis Freitag beschränkt, siehe docs/entscheidungen.md vom 16.10.2026

## A-16 Kappung ohne Wert und mehrere Prüfgebühr-Positionen
- Prototyp (schema.sql, Geschaeftsregeln.php): reisekosten_kappung ist NOT NULL mit Vorgabewert 0, und abgerechnet wird min(Ist, Kappung). Ein Mandant ohne eingetragene Kappung bekommt damit keine Reisekosten berechnet. PRD und Felddoku sprechen nur von der „hinterlegten Kappungsgrenze“
- Prototyp: Bei gruppierten Fällen gilt als Prüfgebührsatz der Preis der ersten Prüfgebühr-Position des Mandanten, ohne gruppierte Fälle die Summe aller Prüfgebühr-Positionen. Bei mehreren Positionen hängt das Ergebnis damit von der Reihenfolge ab
- Umgesetzt (rechnung.ts, 16.10.2026): beides wie im Prototyp, mit Tests
- Empfehlung: Kappung als optionales Feld führen, leer bedeutet keine Begrenzung. Beim Satz klären, ob ein Mandant mehr als eine Prüfgebühr-Position haben darf, sonst im Leistungskatalog auf eine begrenzen
- Betrifft: Stufe 2 (Mandanten, Leistungskatalog), Stufe 5 (Rechnungen)
- Status: entschieden
- Entscheidung: ohne eingetragene Kappung sind die Reisekosten unbegrenzt, eine Kappung von 0,00€ bleibt eine echte Grenze, je Mandant höchstens eine aktive Prüfgebühr-Position, siehe docs/entscheidungen.md vom 16.10.2026
