# Betriebskostenmodul in Treaty – Grundlage für eine Neuentwicklung

Dieses Dokument fasst zusammen, was sich aus der laufenden Oberfläche von Treaty über das Betriebskostenmodul und das damit verbundene Aufgabenmodul beobachten lässt, ergänzt um die Klärungen, die das Fachteam in zwei Nachfragerunden direkt beantwortet hat. Die reinen Oberflächenbeobachtungen stammen aus einer Durchsicht der Live-Anwendung inklusive einiger Blicke in das HTML-DOM, nicht aus dem Quellcode oder der Datenbank von Treaty selbst. Wo eine Angabe direkt im DOM nachgewiesen wurde, ist das vermerkt, weil sie dann als gesichert gelten kann. Fachlich bestätigte Angaben sind ausdrücklich als vom Fachteam bestätigt gekennzeichnet. Was weiterhin unklar ist, steht gesammelt in Abschnitt 10. Der Prüfbogen ist für die erste Phase der Neuentwicklung ausdrücklich nicht vorgesehen, seine Beschreibung steht deshalb nicht mehr im Hauptteil, sondern als Anhang A am Ende des Dokuments.

## 1. Technische Beobachtungen zur bestehenden Umsetzung

Die Fallliste ist eine serverseitig nachgeladene Tabelle, erkennbar an den DOM-Elementen yadcf-filter--HistoryList-*. Das deutet auf die JavaScript-Bibliothek DataTables mit dem Erweiterungsplugin yadcf (Yet Another DataTables Column Filter) hin, worüber vermutlich auch die spaltenweisen Autocomplete-Filter realisiert sind. Die Spaltenfilter laden ihre Auswahllisten offenbar serverseitig aus der Datenbank, denn sie enthalten die tatsächlich vorkommenden Werte inklusive Tippfehlern, zum Beispiel taucht bei BKA-Jahr neben den Jahreszahlen 2008 bis 2026 auch ein offensichtlicher Ausreißer 4422 sowie ein null-Eintrag auf. Für eine Neuentwicklung bedeutet das, dass eine einfache Datenbereinigung beim Import sinnvoll ist, bevor Filter aus den Echtdaten gespeist werden. Dasselbe Muster, eine serverseitig aus den Echtdaten gespeiste Filterliste über yadcf, findet sich auch in der Aufgabenliste wieder, siehe Abschnitt 8.

Die Zeilenfarbe der Fallliste (rot, gelb, grün) ist ein eigenes, in der Datenbank gespeichertes Feld mit dem Namen Farbe und den drei Werten Rot, Gelb und Grün, das wurde direkt im DOM bestätigt. Die genaue Regel, nach der dieses Feld gesetzt wird, hat das Fachteam nachgeliefert und ist vollständig in Abschnitt 6 dokumentiert, sie hängt vom Status des Falls und der Anzahl vergangener Arbeitstage seit Eintritt in diesen Status ab. Ein eigenes Farbe-Feld mit denselben drei Werten existiert im DOM bestätigt auch in der Aufgabenliste, siehe Abschnitt 8.

## 2. Grober fachlicher Aufbau

Das Modul bildet den Ablauf einer Betriebskostenprüfung ab, wie ADH sie für ihre Auftraggeber durchführt. Ein Mandant (Feldname MDT, für Mandant) ist ein Kunde von ADH, meist eine größere Handels- oder Immobiliengruppe, mit eigenem Kürzel, etwa ALDI_BUT oder COM_1-4. Ein Mandant hat mehrere Standorte, jeweils mit eigener Standortnummer, Adresse und Ort. Für jeden Standort und jedes Abrechnungsjahr wird ein Fall angelegt, das ist die Nebenkostenabrechnung oder Betriebskostenabrechnung, die geprüft werden soll, in der Datenbank unter Kürzeln wie NKA oder BKA geführt. Jeder Fall durchläuft einen Bearbeitungsstatus, wird über die Zeit dokumentiert, kann Dateien, Kommentare und Aufgaben tragen. Aufgaben bilden dabei, wie sich in der zweiten Klärungsrunde gezeigt hat, ein eigenständiges, deutlich breiter angelegtes Modul, das ADH firmenweit auch außerhalb der Betriebskostenprüfung nutzt, siehe Abschnitt 8.

## 3. Datenmodell Betriebskosten

### 3.1 Mandant (MDT)

Aus dem Formular Neue MDT bzw. MDT bearbeiten ergeben sich, im DOM bestätigt, drei Reiter mit insgesamt drei Gruppen von Feldern, Basic, Vertrag und Leistungskatalog.

| Bereich | Feld | Anmerkung |
| --- | --- | --- |
| Basic | Code | Kurzkürzel des Mandanten, z.B. ALDI_BUT, dient als Anzeigewert in der Fallliste |
| Basic | Firma | Firmenname |
| Basic | User | ein oder mehrere Ansprechpersonen beim Mandanten, Auswahlfeld mit Plus-Button zum Hinzufügen weiterer Personen; greift auf denselben Nutzerstamm zu wie das Info-Center unter Usermanagement, siehe Abschnitt 9.1 |
| Basic | Addresse | Straße und Hausnummer |
| Basic | Postfächer | optionales Postfach |
| Basic | Ort | Auswahlfeld, siehe Anmerkung unten |
| Basic | Email |     |
| Basic | Fax |     |
| Basic | Abteilung |     |
| Basic | Lieferantennummer | interne Nummer, mit der ADH beim Mandanten geführt wird |
| Basic | Bestellnummer |     |
| Vertrag | Zahlungsziel | Zahlungsfrist für Rechnungen an den Mandanten |
| Vertrag | Grundgebühr | **Vom Fachteam bestätigt:** das Basishonorar, das ADH mit dem Mandanten vereinbart hat |
| Vertrag | Anrechnen | **Vom Fachteam bestätigt:** Auswahlfeld, mit dem festgelegt wird, ob eine durch ADH erzielte Ersparnis mit der Grundgebühr verrechnet werden kann; im DOM bestätigte, vollständige Werteliste Grundgebühr, Prüfgebühr, Both, None |
| Vertrag | Reisekosten | Auswahlfeld, ob und wie Reisekosten abgerechnet werden; im DOM bestätigte Werteliste Ja, Nein |
| Vertrag | Kappungsgrenze Reisekosten | Deckel für Reisekosten |
| Vertrag | Rechnungsausgang | Auswahlfeld, wie ADH-Rechnungen versendet werden; im DOM bestätigte Werteliste Post, Email, Fax |
| Vertrag | Rechnungskopie an | Auswahlfeld für einen zusätzlichen Rechnungsempfänger; im DOM bestätigte Werteliste Post, Email, Fax |
| Vertrag | Häufigkeit | **Vom Fachteam bestätigt:** der Abrechnungsturnus; im DOM bestätigte, vollständige Werteliste Monat, Quartal, Jahr, Einmalig |
| Vertrag | Zulässige Abrechnungen | Freitext oder Zahl |
| Vertrag | Zulässige Abrechnungen Typ | Auswahlfeld, im DOM bestätigte, vollständige Werteliste NKA, Markt |
| Vertrag | Vertrag Datum | Zeitraum, Start- und Endmonat |

Genau diese Vertragsfelder deuten darauf hin, dass MDT nicht nur die Kundenbeziehung, sondern auch das Honorarmodell abbildet, nach dem ADH gegenüber diesem Mandanten abrechnet.

Der dritte Reiter, Leistungskatalog, ist im DOM bestätigt keine Feldgruppe, sondern eine dem Mandanten individuell zugeordnete Liste von Leistungsmodulen. Jede Zeile besteht aus einer Aktiv-Kennzeichnung, dem Modulnamen, einem Preis, einem Typ (Prüfgebühr oder Stundensatz) und einer Häufigkeit, ergänzbar über eine eigene Maske Neue Module mit den Feldern Module, Price Type, Price und Häufigkeit. Die auswählbaren Module stammen aus einem zentralen, mandantenübergreifenden Stammdatensatz, der ebenfalls im Info-Center gepflegt wird, siehe Abschnitt 9.3. Damit trägt MDT nicht nur ein pauschales Honorarmodell über die Vertragsfelder, sondern zusätzlich eine granulare, modulare Preisliste je Mandant.

**Vom Fachteam bestätigt und im DOM nachvollzogen:** Alle Standorte werden zentral im Info-Center unter dem eigenen Menüpunkt Standortmanagement gepflegt, siehe Abschnitt 9.4. Das Auswahlfeld Ort greift dabei, ebenfalls vom Fachteam bestätigt, auf ebendiese zentrale Stammdatenliste zu.

### 3.2 Standort

Aus dem Formular Neue Standort ergeben sich folgende Felder: Standort Nr. (die fachliche Kennung, in der Fallliste als Standort Nr. angezeigt), MDT (Fremdschlüssel auf den Mandanten, mit eigener Möglichkeit, direkt aus diesem Formular einen neuen Mandanten anzulegen), Adresse, Postfach, ORT (Auswahlfeld, siehe Anmerkung in Abschnitt 3.1), Eigentümer Name, Eigentümer Adresse mit Straße und Ort, sowie ein Freitextfeld Eigentumer Info. Die Verwaltung aller Standorte selbst erfolgt, wie das Fachteam bestätigt und wie sich beim Durchgehen des Info-Centers auch im DOM bestätigt hat, zentral im Info-Center unter dem eigenen Menüpunkt Standortmanagement, siehe Abschnitt 9.4 für die dort dokumentierte Listenansicht mit dem zusätzlichen, hier noch nicht erfassten Reiter Kontakte und einer Add-Field-Funktion für zusätzliche, frei benennbare Felder.

### 3.3 Der Fall (Betriebskostenabrechnung / NKA / BKA)

Dies ist die zentrale Entität der Fallliste.

| Feld | Typ / Beobachtung |
| --- | --- |
| ID  | numerische, automatisch vergebene Fall-ID, in Dateinamen und Titeln wiederverwendet |
| WV-Datum | Datum, Wiedervorlagetermin, siehe Farblogik in Abschnitt 6 |
| MDT | Fremdschlüssel auf Mandant |
| Standort Nr. | Fremdschlüssel auf Standort, im Bearbeitungsformular Markt Nr. genannt |
| ORT | wird aus dem Standort übernommen |
| BKA Jahr | Abrechnungsjahr, vierstellig |
| BKA Datum | Zeitraum (Monat/Jahr bis Monat/Jahr), Abrechnungszeitraum der NKA |
| NZ Datum | Zeitraum (Monat/Jahr bis Monat/Jahr), Nutzungszeitraum des Mieters |
| Status | String-Enum mit 11 festen Werten, siehe Abschnitt 6, im DOM bestätigt |
| Farbe | String-Enum Rot / Gelb / Grün / leer, im DOM bestätigt, Regel siehe Abschnitt 6 |
| ADH | Kürzel der intern zuständigen Person, Fremdschlüssel auf die ADH-Mitarbeiterliste, siehe Abschnitt 3.6 |
| Bearbeiter bei MDT | Name der zuständigen Person beim Mandanten bzw. bei dessen Dienstleister |
| Counterpart | die Gegenseite im Schriftverkehr, z.B. Hausverwaltung oder Property-Management-Gesellschaft |
| ca. Werte Fehler | **Vom Fachteam bestätigt:** die erste, vorläufige Einschätzung von ADH, was an einer NKA möglicherweise falsch sein könnte, noch vor der vollständigen Prüfung |
| Draufleger | **Vom Fachteam bestätigt:** eine identifizierte, aber nicht umgesetzte Ersparnis, weil der Mandant die Kosten trotz Beanstandung selbst tragen wollte |
| Ersparnis | **Vom Fachteam bestätigt:** die Differenz zwischen dem ursprünglichen Ergebnis und dem Ergebnis nach der korrigierten Abrechnung |
| Gesamtkosten (brutto) | Betrag laut Abrechnung |
| Vorauszahlungen (brutto) | Betrag laut Abrechnung |
| Ergebnis | **Vom Fachteam bestätigt:** das Ergebnis der ursprünglichen, ersten Abrechnung, errechnet aus Gesamtkosten und Vorauszahlungen |
| Stromverbrauch / Zählernummer Strom | optionale Zählerdaten |
| Gasverbrauch / Zählernummer Gas | optionale Zählerdaten |
| Eigentümer Name / Adresse / Info | können pro Fall abweichend vom Standort-Stammdatensatz erfasst werden |
| Eingang-DATUM | Datum des Posteingangs |
| Received From | Person oder Stelle, von der die Abrechnung einging |
| Abschluss-DATUM | Datum, an dem der Fall geschlossen wurde |
| Gruppiert | **Vom Fachteam bestätigt:** zeigt an, wie viele tatsächliche Einzel-NKA hinter einer Fall-ID stecken, da manchmal mehrere Abrechnungen zu einem Fall gebündelt werden; ist die Verknüpfung zur Rechnungsstellung im Modul Buchhaltung |
| Created / Updated / Closed Date und By | Metadaten zu Erstellung, Änderung und Abschluss |
| Auftrags-ID | **Vom Fachteam bestätigt:** für die Neuentwicklung nicht relevant, kann entfallen |

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Bei der Neuanlage einer Abrechnung sollen Status automatisch auf Neu und das WV-Datum automatisch auf zwei Wochen nach Anlage gesetzt werden. Beim Hochladen der Abrechnung soll außerdem eine automatische Texterkennung die Felder Gesamtkosten, Vorauszahlungen und Ergebnis auslesen und befüllen. Ein Doppelklick auf Bearbeiter bei MDT oder Counterpart soll künftig automatisch Outlook mit einer vordefinierten E-Mail öffnen. Counterpart soll außerdem nicht mehr jedes Jahr neu erfasst werden, sondern automatisch aus dem Fall des Vorjahres für denselben Standort übernommen werden, mit der Möglichkeit, ihn bei einem Wechsel der Verwaltung anzupassen. **Vom Fachteam bestätigt:** Für die Felder ca. Werte Fehler und Ersparnis soll es ausdrücklich keine automatische Texterkennung geben, diese bleiben manuell auszufüllen.

### 3.4 Dokument

Aus dem Dialog Dateien hinzufügen ergibt sich, dass jedes Dokument mindestens folgende Informationen trägt, nämlich Datum, eine Richtungskennung (E für eingehend, A für ausgehend), eine Kategorie (unter anderem NKA, Widerspruch, Prüfungsergebnis, E-Mail MDT, HKA, 1. Erinnerung, 2. Erinnerung, Freigabe MDT) sowie den Dateinamen. Die Benennung folgt dem Muster JJJJ-MM-TT, Richtung, Kategorie Jahr, Ort, MDT, Standortnummer.pdf. Für eine Neuentwicklung empfiehlt sich, diese Struktur als eigene Felder statt als reinen Dateinamen zu speichern.

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Die Ablage auf Laufwerk Z soll künftig automatisch nach demselben, oben beschriebenen Namens- und Ordnerschema erfolgen, statt wie bisher manuell benannt und einsortiert zu werden. **Vom Fachteam bestätigt:** Das Schema selbst bleibt unverändert, es soll nur automatisiert statt manuell angewendet werden.

### 3.5 Kommentar

Aus dem Kommentare-Reiter der Fallhistorie ergibt sich ein einfaches Modell aus Datum, Verfasser, Freitext und der Möglichkeit zu antworten.

### 3.6 ADH-Mitarbeiterliste

Im DOM nachgewiesen ist eine Liste interner ADH-Mitarbeitender mit Kürzel und Namen, unter anderem ADH, AH-Alexandra Henning, JA-Jens Arntzen, JB-Jan Becker, JR-Joana Ruck, NR-Natascha Rupp, NZ-Natascha Zibulski, TA-Tina Assadi, TR-Thomas Rupp, sowie eine größere Zahl weiterer Kürzel mit dem Präfix "xy" vor dem Namen. **Vom Fachteam bestätigt:** Die mit "xy" gekennzeichneten Personen sind keine aktuellen Mitarbeitenden mehr. Die Stammdatenliste soll unverändert in die Neuentwicklung übernommen werden. Dieselbe Mitarbeiterliste wird, wie sich bei der Durchsicht des Aufgabenmoduls gezeigt hat, dort für die Felder Zugewiesen an, Followers und Ersteller wiederverwendet, siehe Abschnitt 8.

Berechtigungen sind laut Fachteam jeder einzelnen Nutzerin und jedem einzelnen Nutzer zugewiesen und im Modul Info-Center unter Usermanagement einsehbar, siehe Abschnitt 9.1 für das dort dokumentierte Datenmodell.

### 3.7 Historie / Activity-Log

Jede Änderung an einem Fall, jede hochgeladene Datei, jeder Kommentar und jedes zugehörige Aufgabenereignis wird als einzelner, chronologischer Eintrag mit Zeitstempel, handelnder Person, Kategorie und Klartextbeschreibung gespeichert und in der Vorgangshistorie als Zeitleiste dargestellt. Genau dasselbe Zeitleisten-Prinzip, mit denselben Symbolen für Kommentar, Dokument, Bearbeitung und Status-Änderung, findet sich im DOM bestätigt auch in der Vorgangshistorie einer einzelnen Aufgabe wieder, siehe Abschnitt 8.

## 4. Seitenaufbau der Fallliste (Betriebskosten)

Die Startseite des Moduls ist eine einzige Listenansicht mit drei senkrecht angeordneten Bereichen, einem ausklappbaren Filterbereich, einer Werkzeugleiste über der Tabelle und der eigentlichen Tabelle. Der Filterbereich zeigt bis zu zehn Filterfelder (WV-Datum, MDT, Status, Zugewiesen an, Bearbeiter bei MDT, Standort Nr., Ort, BKA-Jahr, Counterpart, Eingangsdatum, Datum Abschluss), von denen jedes einzeln über ein x aus der Ansicht entfernt werden kann, mit einer enthält-nicht-Option zur Negierung, einer Reset-Funktion und einer Speichern-Funktion für die aktuelle Filterkonfiguration.

Die Werkzeugleiste bietet Auswählen (Umschalten zwischen Zeilen-, Spalten- und Zellenauswahl), Export, Drucken, Kopieren, Sichtbarkeit der Spalten, Anzeigen (Alle BKA anzeigen, Abgeschlossene BKA ausblenden, Archivierte BKA anzeigen) sowie Neue Abrechnung.

Jede Tabellenzeile hat zwei sichtbare Symbole und ein verstecktes Kontextmenü. Das erste Symbol, ein blauer Kreis, klappt eine Schnellansicht mit den Feldern Draufleger, Ersparnis, Gesamtkosten, Vorauszahlungen, Ergebnis, Eingangsdatum, Änderung und Eigentümer direkt unterhalb der Zeile auf. Das zweite Symbol, eine Sprechblase, öffnet einen Rich-Text-Dialog, um den Fall mit Kommentar an eine bestimmte Person im internen Chat-Bereich zu teilen. Dieser Chat-Bereich ist eine eigene Seitenleiste mit den Reitern Chat, Gespeichert und Ungelesen sowie einer Suche; jeder geteilte Fall oder jede geteilte Aufgabe erscheint dort als eigene Karte mit Kennung (etwa Fall-ID, Mandant, Standort und Jahr), Kommentartext, Datum und Verfasser. Ein Rechtsklick auf eine beliebige Zelle der Zeile öffnet das eigentliche Fallmenü, ein Doppelklick löst dagegen keine Aktion aus und markiert nur Text.

### 4.1 Fallmenü (Rechtsklick)

| Menüpunkt | Verhalten |
| --- | --- |
| Daten bearbeiten | öffnet das vollständige Bearbeitungsformular des Falls, siehe Abschnitt 3.3 |
| Ordner öffnen | öffnet die zum Standort gehörende Ordnerstruktur im Dateimanager, mit den Unterordnern SV (Schriftverkehr), NKA & Belege und MV (Mietvertrag) |
| Aufgaben anzeigen | öffnet eine auf den Fall gefilterte Aufgabenliste, siehe Abschnitt 8 für das dahinterliegende Modul |
| Datenblatt | zeigt eine kompakte, nicht editierbare Zusammenfassung der Kerndaten |
| Dateien hinzufügen | öffnet Upload und Verwaltung aller Dokumente des Falls |
| Schriftsatz erstellen | Dialog mit Letter Type und Reviewer zur Erzeugung eines Schreibens aus einer Vorlage, siehe Abschnitt 7 |
| Vorgang abschließen | **Vom Fachteam bestätigt:** öffnet einen Bestätigungsdialog "Trotzdem abschließen für [Mandant] [Standort] [Jahr]?" mit einer Pflichtabfrage der Nettoersparnis (sofern noch nicht eingetragen) und einer Übersicht offener, verknüpfter Aufgaben mit den Optionen View List und Close All. Nach Bestätigung wird der Status auf abgeschlossen gesetzt; der Fall kann danach nicht mehr inhaltlich bearbeitet werden, es können nur noch Dokumente hochgeladen werden |
| NKA Löschen | **Vom Fachteam bestätigt:** kein echtes Löschen, sondern eine Archivierung; die NKA wird bei der Rechnungsstellung an den Mandanten nicht mehr berücksichtigt |
| Vorgangshistorie öffnen | zeigt die vollständige Zeitleiste des Falls, filterbar nach Alle, Kommentare, Dokumente, Status, Wiedervorlage |
| Prüfbogen | in der bestehenden Oberfläche vorhanden, für die erste Phase der Neuentwicklung aber nicht vorgesehen, siehe Anhang A |

## 5. Auf einen Blick, was sich durch die Klärungsrunden geändert hat

Gegenüber der ersten Fassung dieses Dokuments haben sich mehrere wesentliche Einordnungen geändert. Die Farblogik der Fallliste ist inzwischen vollständig bekannt und in Abschnitt 6 als lückenloses Regelwerk dokumentiert, einschließlich der Werte für 3. Erinnerung, 4. Erinnerung und abgeschlossen. Die Bedeutung der Vertragsfelder Grundgebühr, Anrechnen und Häufigkeit beim Mandanten ist geklärt, ebenso die Herkunft der Ortsdaten aus dem zentralen Standortmanagement im Info-Center. Der ursprünglich vorgesehene, neunteilige Prüfbogen wurde dagegen aus dem Umfang der ersten Rebuild-Phase herausgenommen, weil er für den Start zu komplex ist. Er ist ohnehin in der bisherigen Umsetzung nie fertig entwickelt worden und wird in der Praxis nicht genutzt; seine Beschreibung bleibt als Anhang A für eine mögliche spätere Erweiterung erhalten, ist für die jetzt anstehende Entwicklung aber nicht bindend. Neu hinzugekommen ist dafür das Aufgabenmodul, das auf ausdrücklichen Wunsch direkt mit in die Neuentwicklung aufgenommen werden soll, weil die Fallliste an zwei Stellen fest darauf verweist, siehe Abschnitt 8. Ebenfalls neu aufgenommen ist das gesamte Info-Center mit seinen sechs Menüpunkten Usermanagement, Kundenmanagement, Reports, Kontaktdatenbank, Standortmanagement und Einstellungen, siehe Abschnitt 9, wodurch sich unter anderem die Berechtigungsstruktur der Nutzerinnen und Nutzer, der dritte, bislang nicht dokumentierte Reiter Leistungskatalog im MDT-Bearbeitungsdialog sowie der bisher nur dem Namen nach bekannte, eigenständige Bereich Standortmanagement klären ließen. Neu hinzugekommen ist außerdem die Entscheidung, einen der beiden doppelten IT-Einträge im Leistungskatalog aus Abschnitt 9.3 im Rebuild zu entfernen. Ebenfalls geklärt sind inzwischen die konkrete Löschung der Leistungskatalog-Einträge ID 34 und ID 44, die Herkunft des Ortsfelds aus dem zentralen Standortmanagement sowie feste Wertelisten für Branche und Zuordnung in der Kontaktdatenbank; die über Add Field frei anlegbaren Zusatzfelder im Standort-Bearbeitungsdialog bleiben dagegen bewusst frei und ohne festen Datentyp. Neu hinzugekommen ist außerdem ein vollständiger Abgleich mit dem vom Fachteam vorgelegten Anforderungskatalog aus dem ClickUp/Trello/Teams-Vergleich, siehe Abschnitt 12; er zeigt neben vielen bereits erfüllten Punkten auch mehrere konkrete Lücken im heutigen Verhalten sowie mit dem Matching-Bereich für Flächenangebote und Suchprofile einen vom Fachteam bestätigten, komplett neuen Funktionsbereich für Treaty, der über das bisher dokumentierte Standortmanagement weit hinausgeht. Die anstelle der unklaren User Groups A bis H vorgeschlagenen Berechtigungsgruppen sind inzwischen vom Fachteam auf zwei Gruppen vereinfacht worden, siehe Abschnitt 11, und mehrere der in Abschnitt 12 aufgefallenen Lücken sind inzwischen als konkrete Anforderungen für den Rebuild entschieden, unter anderem zur automatischen Kopplung von Aufgaben und Betriebskostenabrechnungen, zur automatischen Texterkennung, zur Outlook-Verknüpfung und zur Übernahme des Counterparts aus dem Vorjahr. Neu hinzugekommen ist außerdem die Live-Untersuchung des Moduls Buchhaltung, siehe Abschnitt 13, wodurch sich die sechs Punkte zur Rechnungserstellung in Abschnitt 12.5 weitgehend klären ließen. Bei derselben Untersuchung wurde zusätzlich das in der ersten Fassung übersehene Modul Verträge gefunden, das die Mietmanagement-Anforderungen aus Abschnitt 12.4 weitgehend abdeckt und in Abschnitt 14 dokumentiert ist.

Der Kern des Betriebskostenmoduls bleibt damit die Fallliste mit ihrer Farblogik, dem Status-Workflow, den Dokumenten und dem Schriftsatz-Generator, ergänzt um das eigenständige, aber eng angebundene Aufgabenmodul und die im Info-Center gepflegten Stammdaten. Der Prüfbogen ist für den ersten Entwicklungsschritt bewusst ausgeklammert.

## 6. Status-Workflow und Farblogik

### 6.1 Statuswerte

Im DOM bestätigt sind genau elf Statuswerte: 1. Erinnerung, 2. Erinnerung, 3. Erinnerung, 4. Erinnerung, AW eingegangen MDT, AW eingegangen VWT, NEU, abgeschlossen, in Bearbeitung, warte auf Dritten, warte auf MDT, warte auf Verwalter. AW steht für Antwort, VWT steht für Verwaltung, jeweils vom Fachteam bestätigt.

### 6.2 Farblogik (vom Fachteam bestätigt)

Grundlage ist eine Arbeitswoche zu 5 Arbeitstagen. Jeder Status hat eine feste Gesamtfrist in Arbeitstagen, gerechnet ab dem Zeitpunkt, an dem der Fall in diesen Status gewechselt ist. Innerhalb dieser Frist ist die Zeile zunächst grün, dann gelb, und ab einem bestimmten Tag rot. Der Status abgeschlossen erhält keine Farbe mehr.

| Status | Frist gesamt | Grün | Gelb | Rot |
| --- | --- | --- | --- | --- |
| NEU | 10 Arbeitstage | Tag 1–5 | Tag 6–10 | ab Tag 11 |
| in Bearbeitung (aktuell) | 10 Arbeitstage | Tag 1–5 | Tag 6–10 | ab Tag 11 |
| AW eingegangen MDT | 5 Arbeitstage | Tag 1 | Tag 2–5 | ab Tag 6 |
| AW eingegangen VWT | 10 Arbeitstage | Tag 1–5 | Tag 6–10 | ab Tag 11 |
| warte auf MDT | 10 Arbeitstage | Tag 1–10 | Tag 11–13 | ab Tag 14 |
| warte auf Verwalter | 20 Arbeitstage | Tag 1–10 | Tag 11–13 | ab Tag 14 |
| warte auf Dritten | 10 Arbeitstage | Tag 1–10 | Tag 11–13 | ab Tag 14 |
| 1. Erinnerung | 20 Arbeitstage | Tag 1–20 | Tag 21–23 | ab Tag 24 |
| 2. Erinnerung | 10 Arbeitstage | Tag 1–10 | Tag 11–13 | ab Tag 14 |
| 3. Erinnerung | 10 Arbeitstage | Tag 1–10 | Tag 11–13 | ab Tag 14 |
| 4. Erinnerung | 10 Arbeitstage | Tag 1–10 | Tag 11–13 | ab Tag 14 |
| abgeschlossen | keine Farbe | –   | –   | –   |

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Der Status in Bearbeitung soll künftig nur noch 7 Arbeitstage Gesamtfrist erhalten, aufgeteilt in 5 Tage grün, 2 Tage gelb und ab Tag 8 rot. Das ist ausdrücklich eine gewünschte Änderung für den Rebuild und keine Beschreibung des heutigen Verhaltens. **Vom Fachteam entschieden:** Das WV-Datum des Falls soll künftig automatisch anhand des Status fortgeschrieben werden, nicht nur die Farbe.

## 7. Schriftsatz-Generator

Der Dialog Schriftsatz erstellen bietet ein Auswahlfeld Letter Type. **Vom Fachteam bestätigt, vollständige Liste:** Widerspruch, 1. Erinnerung, 2. Erinnerung, 3. Erinnerung, 4. Erinnerung, Zusendung Originale MDT, Weitergabe Rechtsabteilung, Abschlussschreiben, Antwortschreiben. Zusätzlich gibt es ein Auswahlfeld Reviewer, **vom Fachteam bestätigt dieselbe Mitarbeiterliste wie in Abschnitt 3.6, allerdings eingeschränkt auf aktuell aktive Mitarbeitende ohne die xy-gekennzeichneten ehemaligen Kolleginnen und Kollegen**, sowie die Aktionen Create Letter, die das Dokument aus einer Vorlage erzeugt, und View Folder, **vom Fachteam bestätigt derselbe Ordner wie bei der Funktion Ordner öffnen** im Fallmenü.

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Zwei bisher in Treaty fehlende Funktionen sollen für den Rebuild ergänzt werden. Zum einen eine automatische Erstellung des Widerspruchs, bei der nur noch ausgewählt wird, welche Kostenposition nicht umlagefähig ist und welcher Paragraph im Mietvertrag zitiert werden soll, während der übrige Text aus einer Standardvorlage stammt. Zum anderen eine Prüfungs-Checkliste je Verwaltung, die wiederkehrende Auffälligkeiten einzelner Hausverwaltungen festhält, etwa dass eine bestimmte Verwaltung immer den Hausmeister pauschal umlegt.

## 8. Aufgabenmodul

### 8.1 Zweck und Verhältnis zum Betriebskostenmodul

Das Aufgabenmodul ist ein eigener Menüpunkt in der linken Navigation und, wie sich bei der Durchsicht gezeigt hat, deutlich breiter angelegt als nur eine Begleitfunktion des Betriebskostenmoduls. Es wird firmenweit für ganz unterschiedliche Vorgänge genutzt, von der Vertrags- und Fristenüberwachung über IT- und Personalprozesse bis zur Expansion, erkennbar an den vorhandenen Aufgaben-Vorlagen wie Neuer Mitarbeiter, Urlaubsantrag, IT Projekt Ablauf oder Standortkriterien Analyse. Eine Aufgabe kann, muss aber nicht mit einem Betriebskosten-Fall verknüpft sein. Bei einer verknüpften Aufgabe sind die Spalten Modul ID#, Modul Name und Modul Status gefüllt, mit dem Modulnamen BKA und dem jeweiligen Status des zugehörigen Falls, siehe Abschnitt 3.3 und Abschnitt 6.1. Bei einer eigenständigen Aufgabe stehen dort Bindestriche. Auf das Betriebskostenmodul wirkt sich das Aufgabenmodul an zwei festen Stellen aus, über den Menüpunkt Aufgaben anzeigen im Fallmenü (Abschnitt 4.1) und über die Aufgabenübersicht im Bestätigungsdialog von Vorgang abschließen (ebenfalls Abschnitt 4.1).

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Beim Anlegen einer neuen Betriebskostenabrechnung soll künftig automatisch eine verknüpfte Aufgabe erzeugt werden, statt wie bisher nur optional manuell verknüpfbar zu sein. Für eine so verknüpfte Aufgabe soll das Widervorlagedatum außerdem automatisch an das Betriebskostenmodul gekoppelt werden und dessen Statuslogik übernehmen, siehe Abschnitt 6.2. Für alle übrigen, nicht mit einer Betriebskostenabrechnung verknüpften Aufgaben bleibt das Widervorlagedatum weiterhin frei einstellbar, wie in Abschnitt 8.2 beschrieben.

**Vom Fachteam bestätigt:** Für die Sichtbarkeit von Aufgaben gibt es zwei Berechtigungsstufen, Personen mit Zugriff auf alle Aufgaben, und Personen, die nur die ihnen selbst zugewiesenen, die ADH zugewiesenen und die Aufgaben sehen, bei denen sie als Follower eingetragen sind. Diese beiden Stufen entsprechen der in Abschnitt 11 beschriebenen Gruppe mit Vollzugriff und der eingeschränkten Gruppe.

### 8.2 Datenmodell der Aufgabe

Aus der Spaltenkonfiguration und den Bearbeitungsdialogen der Aufgabenliste ergeben sich, im DOM bestätigt, folgende Felder.

| Feld | Typ / Beobachtung |
| --- | --- |
| ID  | numerische, automatisch vergebene Aufgaben-ID |
| Titel | Kurzbezeichnung der Aufgabe |
| Beschreibung | mehrzeiliger Freitext |
| MDT | Fremdschlüssel auf denselben Mandantenstamm wie im Betriebskostenmodul; auch ADH selbst ist als MDT wählbar, für rein interne Aufgaben |
| Aufgaben-Typ | Auswahlfeld, im DOM bestätigte, vollständige Liste: Akquise, BK-Check / Korrespondenz ab 01.08.2022, Betriebskosten-Check, Betriebskosten-Korrespondenz, Betriebskostenabrechnung-Erstellung 1, Eigen Orga, Expansion, Extra Time Stundensatz 1, Extra Time Stundensatz 2, IT, Kunden Orga, Laufzeitenüberwachung, Scheduled Report, Team, Vermietung & Untervermietung, Verwaltung, Weiterentwicklung |
| Status | eigener, einfacher Status der Aufgabe selbst, im DOM bestätigt nur zwei Werte: NEU und in Bearbeitung; nicht zu verwechseln mit Modul Status, das den Status eines verknüpften Betriebskosten-Falls zeigt |
| Farbe | String-Enum Rot / Gelb / Grün / leer, im DOM bestätigt; Berechnungsregel vom Fachteam bestätigt, siehe Tabelle unten |
| WV-Datum | Wiedervorlagedatum der Aufgabe |
| Frist-Datum | eigentliches Fälligkeitsdatum; im Bearbeitungsdialog über einen eigenen Button Frist abschließen direkt abschließbar |
| Zugewiesen an | verantwortliche Person, aus derselben ADH-Mitarbeiterliste wie in Abschnitt 3.6, beim Anlegen standardmäßig die eingeloggte Person |
| Followers | mehrere Personen aus derselben Mitarbeiterliste, die über Änderungen informiert werden |
| Ersteller | erfassende Person, ebenfalls aus der Mitarbeiterliste |
| Erstellt am | Anlagedatum |
| Modul ID# / Modul Name / Modul Status | nur bei einer mit einem Betriebskosten-Fall verknüpften Aufgabe gefüllt, siehe Abschnitt 8.1 |
| Standort Nr. / ORT | wie beim verknüpften Fall bzw. Standort |
| Unteraufgabe (Subtask) | beliebig viele Unteraufgaben je Aufgabe, jede mit eigenem Titel, Erledigt-Status und Kommentarfunktion; der Gesamtfortschritt wird als Prozent-Balken über der Liste angezeigt |
| Aufgabenserie | Umschalter, mit dem eine Aufgabe als wiederkehrend markiert wird; bei aktivierter Serie zeigt die Aufgabe eine Liste kommender Erinnerungstermine an, im beobachteten Beispiel halbjährlich rund um ein Laufzeitende |

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Neue Aufgabentypen sollen künftig nur von Personen mit der in Abschnitt 11 beschriebenen Gruppe Vollzugriff angelegt werden können, alle anderen wählen weiterhin nur aus der bestehenden, festen Liste. Ebenso darf eine Betriebskostenabrechnung künftig nur von Personen mit Vollzugriff einem anderen Mitarbeiter neu zugewiesen werden, siehe dazu auch Abschnitt 8.4; das Anlegen neuer Aufgaben und neuer Betriebskostenabrechnungen selbst bleibt dagegen für alle Personen offen.

**Farblogik der Aufgabe (vom Fachteam bestätigt).** Anders als bei den Betriebskosten-Fällen (Abschnitt 6.2) gibt es hier keine feste Gesamtfrist in Arbeitstagen, weil Nutzerinnen und Nutzer Frist-Datum und WV-Datum je Aufgabe frei setzen können. Die Farbe ergibt sich stattdessen aus dem Abstand in Kalendertagen zu diesen beiden Datumsfeldern, wobei jeweils die dringlichere Farbe den Ausschlag gibt.

| Zustand | Frist-Datum | WV-Datum |
| --- | --- | --- |
| Grün | –   | beliebig bis 6 Tage vor dem WV-Datum |
| Gelb | beliebig bis 8 Tage vor dem Frist-Datum | die letzten 5 Tage vor dem WV-Datum |
| Rot und Gelb blinkend | ab 7 Tage vor dem Frist-Datum | –   |
| Rot | ab 1 Tag nach dem Frist-Datum | ab 1 Tag nach dem WV-Datum |

### 8.3 Seitenaufbau der Aufgabenliste

Der Aufbau entspricht in der Grundstruktur der Fallliste des Betriebskostenmoduls. Ein ausklappbarer Filterbereich bietet die Felder MDT, WV-Datum, Frist-Datum, Modul Status, Aufgaben-Typ, Titel, Zugewiesen an, Followers und Standort Nr., ebenfalls mit enthält-nicht-Option und einer Speichern-Funktion für die Filterkonfiguration. Die Werkzeugleiste bietet Export, Sichtbarkeit der Spalten, Anzeigen (mit den Optionen Alle Aufgaben anzeigen und Abgeschlossene Aufgaben ausblenden), Aufgaben Vorlage und Neue Aufgabe. Jede Zeile trägt dieselben zwei Symbole wie in der Fallliste, einen blauen Kreis für eine Schnellansicht mit Titel, Beschreibung, Zugewiesen an, Status, Erstellt am und Ersteller, sowie eine Sprechblase zum Teilen der Aufgabe per Kommentar in denselben Chat-Bereich wie beim Betriebskostenmodul, siehe Abschnitt 4. Bei mindestens einer Aufgabe wurde zusätzlich ein Büroklammer-Symbol beobachtet, das auf vorhandene Anhänge hinweist.

### 8.4 Kontextmenü und Bearbeitungsdialoge

Ein Rechtsklick auf eine Zeile öffnet, im DOM bestätigt, folgendes Kontextmenü.

| Menüpunkt | Verhalten |
| --- | --- |
| Zeiterfassung | startet einen laufenden Timer für die angeklickte Aufgabe; sichtbar als eigenes Widget mit Pause-Funktion, Aufgabentitel und laufender Zeit, das auch beim Wechsel in andere Module bestehen bleibt |
| Aufgabe bearbeiten | öffnet das vollständige Bearbeitungsformular mit MDT, Titel, Aufgaben-Typ, Beschreibung, Unteraufgaben, Followers, WV-Datum, Frist-Datum und dem Aufgabenserie-Umschalter, siehe Abschnitt 8.2 |
| Neu zuweisen | öffnet einen schlanken Dialog mit der schreibgeschützten Beschreibung sowie den Feldern Assigned To und Task Followers |
| Aufgabe abschließen | öffnet eine Bestätigungsabfrage mit Titel, Zugewiesen an, Beschreibung und dem Fortschritt sowie der Liste noch offener Unteraufgaben; die Aufgabe lässt sich auch mit offenen Unteraufgaben abschließen |
| Vorgangshistorie öffnen | zeigt dieselbe Art Zeitleiste wie bei einem Betriebskosten-Fall, mit automatisch erzeugten Einträgen wie Erinnerung an die Frist am [Datum] dieser Aufgabe sowie protokollierten Änderungen an WV-Datum, Frist-Datum und Beschreibung |
| Anhänge | öffnet einen einfachen Upload-Dialog mit Drag-and-drop-Fläche |

Der Dialog Neue Aufgabe fasst zusätzlich eine Vorlagenauswahl, ein MDT-Feld mit der Möglichkeit, direkt daraus einen neuen Mandanten anzulegen, sowie dieselben inhaltlichen Felder wie beim Bearbeiten zusammen. Die Buttons Vorlage speichern, schließen und speichern & schließen schließen den Dialog ab. Eine direkte Verknüpfung zu einem Betriebskosten-Fall oder Standort ist in diesem Dialog nicht vorgesehen, eine neu angelegte Aufgabe ist also zunächst immer eigenständig.

### 8.5 Aufgaben-Vorlagen

Über den Werkzeugleisten-Punkt Aufgaben Vorlage gelangt man auf eine eigene Verwaltungsseite für wiederverwendbare Aufgaben-Vorlagen, mit eigenem Filterbereich (MDT, Aufgaben-Typ, Vorlage Name, Zugriff, Titel, Zugewiesen an, Followers, Ersteller) und eigener Spaltenliste (ID, Name, Zugriff, WV Datum, MDT, Modul ID#, Modul Status, Standort Nr., ORT, Aufgaben-Typ, Titel, Beschreibung, Zugewiesen an, Erstellt am, Ersteller, Followers). Im DOM bestätigt liegen bereits über vierzig Vorlagen vor, überwiegend für allgemeine Geschäftsprozesse wie Neuer Mitarbeiter, Urlaubsantrag, Rechnungsfreigabe oder Kündigungsfrist Mietvertrag, teilweise aber auch mit direktem Betriebskostenbezug wie Detailkostenanalyse NKA oder Qualitätskontrolle BKA. **Vom Fachteam bestätigt:** Aufgaben-Vorlagen kann jede Person nutzen und auch neu anlegen bzw. speichern, das Feld Zugriff schränkt das in der Praxis nicht ein.

## 9. Info-Center

Das Info-Center ist in der linken Navigation ein eigener Menüpunkt, der beim Hinüberfahren mit der Maus, im DOM bestätigt, ein Untermenü mit sechs Einträgen aufklappt, Usermanagement, Kundenmanagement, Reports, Kontaktdatenbank, Standortmanagement und Einstellungen. Usermanagement und Kundenmanagement führen dabei technisch auf dieselbe Seite (Konfigurationsseite mit den drei Akkordeon-Bereichen Users, MDT und Leistungskatalog, die in den Abschnitten 9.1 bis 9.3 beschrieben sind), die übrigen vier Punkte sind eigenständige Seiten, dokumentiert in den Abschnitten 9.4 bis 9.7. Alle diese Bereiche folgen im Kern demselben Aufbau wie Fallliste und Aufgabenliste, eine DataTable mit Filterbereich und, bis auf die Ausnahmen in 9.5 bis 9.7, einem Rechtsklick-Kontextmenü.

### 9.1 Users (Usermanagement)

Der Bereich Users zeigt, im DOM bestätigt, eine Tabelle mit 492 Einträgen und den Spalten ID, Name, Code, MDT, Email und Telefon. Das Rechtsklick-Kontextmenü bietet die Punkte User anzeigen, User hinzufügen, User bearbeiten und Alle offenen Aufgaben vererben. Der letzte Punkt wurde in der Oberfläche selbst nicht ausgelöst, weil seine Bezeichnung auf eine schreibende, unter Umständen nicht ohne Weiteres rückgängig zu machende Sammelaktion hindeutet. **Vom Fachteam bestätigt:** Er überträgt alle offenen Aufgaben einer Person auf eine andere Person.

Der Bearbeitungsdialog Ändern Benutzer ist, im DOM bestätigt, in die Reiter Basic und Vertrag gegliedert.

| Bereich | Feld | Anmerkung |
| --- | --- | --- |
| Basic | Anrede |     |
| Basic | Vorname |     |
| Basic | Nachname |     |
| Basic | Code | Kürzel der Person, siehe auch die ADH-Mitarbeiterliste in Abschnitt 3.6 |
| Basic | User type | Auswahlfeld, im DOM bestätigte, vollständige Werteliste Super Administrator, Administrator, Members, Guest, Customer |
| Basic | User department | Auswahlfeld, im DOM bestätigte, vollständige Werteliste i.A., i.V., ppa.; bezeichnet nicht etwa eine Organisationsabteilung, sondern die Zeichnungsbefugnis für die Korrespondenz |
| Basic | User Groups | Mehrfachauswahlfeld, im DOM bestätigte, vollständige Werteliste Group A bis Group G sowie Group H - Customer |
| Basic | MDT | Fremdschlüssel auf denselben Mandantenstamm wie in Abschnitt 3.1, mit Möglichkeit, direkt aus diesem Formular einen neuen Mandanten anzulegen |
| Basic | Username |     |
| Basic | Password |     |
| Basic | Email |     |
| Basic | CC Email |     |
| Vertrag | Telefon |     |
| Vertrag | Is User Working? | Kontrollkästchen |

Die einzelnen Werte von User Groups sind, auch intern, nicht weiter dokumentiert, siehe Abschnitt 10. **Vom Fachteam bestätigt:** Die Gruppen sind funktional wichtig und sollen im Rebuild erhalten bleiben, welche einzelne Gruppe aber welche konkrete Berechtigung oder Funktion trägt, ist auch dem Fachteam selbst nicht mehr bekannt und lässt sich aus den Bestandsdaten nicht rekonstruieren; sie werden im Rebuild durch die in Abschnitt 11 beschriebene, vom Fachteam bestätigte Zwei-Gruppen-Regelung ersetzt. User department ist dagegen inhaltlich klar, es bezeichnet die Zeichnungsbefugnis (i.A., i.V. oder ppa.), mit der eine Person Schreiben unterzeichnet, keine Organisationseinheit.

An zwei Beispieldatensätzen lässt sich der Zusammenhang zwischen diesen Feldern und der in Abschnitt 3.6 vom Fachteam bestätigten xy-Konvention beobachten. Der Datensatz von Natascha Zibulski (ID 71, Code NZ, MDT ADH) trägt User type Administrator, User department i.V., die Gruppen A, B, D, E, F und G, und Is User Working ist angehakt. Der Datensatz einer mit dem Präfix xy gekennzeichneten, laut Abschnitt 3.6 nicht mehr aktiven Person (ID 11, MDT ADH) trägt dagegen User type Guest, kein User department, keine User Groups, und Is User Working ist nicht angehakt. Das deckt sich mit der Fachteam-Aussage, dass mit xy gekennzeichnete Personen keine aktuellen Mitarbeitenden mehr sind, es handelt sich hier aber um eine eigene Beobachtung an nur zwei Datensätzen, nicht um eine gesonderte Fachteam-Bestätigung dieses konkreten Musters.

Damit lässt sich zusätzlich feststellen, dass die Users-Tabelle des Info-Centers und die in Abschnitt 3.6 beschriebene ADH-Mitarbeiterliste dieselbe zugrundeliegende Tabelle sind. Filtert man Users auf MDT gleich ADH, ergeben sich genau die 82 in Abschnitt 3.6 gemeinten internen Mitarbeitenden; die übrigen 410 der insgesamt 492 Einträge sind externe Ansprechpersonen bei den jeweiligen Mandanten, zum Beispiel bei MDT CLA, BIC oder ALDI_GEI, dort durchgängig mit User type Guest. Für die Neuentwicklung bedeutet das, dass ein einziges Nutzer-Datenmodell sowohl interne Mitarbeitende als auch externe Kontaktpersonen abbilden muss, unterschieden im Wesentlichen über MDT und User type.

### 9.2 MDT-Verwaltung (Kundenmanagement, Listenansicht)

Der Bereich MDT zeigt, im DOM bestätigt, eine Tabelle mit 222 Einträgen und den Spalten ID, Name, Code, User, Addresse und Postfächer. Die Spalte User zeigt dieselbe primäre Ansprechperson, die auch im Bearbeitungsdialog unter dem Feld User in Abschnitt 3.1 hinterlegt ist. Das Rechtsklick-Kontextmenü bietet die Punkte MDT anzeigen, MDT hinzufügen und MDT bearbeiten; MDT bearbeiten öffnet denselben dreireitrigen Dialog Basic, Vertrag, Leistungskatalog, der bereits vollständig in Abschnitt 3.1 beschrieben ist.

### 9.3 Leistungskatalog (Kundenmanagement, globaler Stammdatensatz)

Der Bereich Leistungskatalog zeigt, im DOM bestätigt, eine Tabelle mit 44 Einträgen und den Spalten ID, Module und Beschreibung. Dies ist der zentrale, mandantenübergreifende Stammdatensatz aller Leistungsmodule, aus dem heraus jedem einzelnen Mandanten im Reiter Leistungskatalog seines Bearbeitungsdialogs (Abschnitt 3.1) mit individuellem Preis, Typ und Häufigkeit einzelne Module zugeordnet werden. Das Rechtsklick-Kontextmenü bietet die Punkte Modul hinzufügen und Modul bearbeiten.

| ID  | Modul | Beschreibung |
| --- | --- | --- |
| 1   | Betriebskosten-Check |     |
| 2   | Betriebskosten-Korrespondenz |     |
| 3   | Betriebskosten-Analyse (Benchmarks) |     |
| 4   | Betriebskostenabrechnung-Erstellung 1 | Stundensatz 1 |
| 5   | Wertsicherungs-Check |     |
| 6   | Wertsicherung-Alarmsystem |     |
| 7   | Wertsicherungs-Korrespondenz |     |
| 8   | Digitale Erfassung und Verwaltung Vertragsdaten |     |
| 9   | Laufzeitenüberwachung |     |
| 10  | Vertragsoptimierung & Verhandlung |     |
| 11  | Störungen & Wartungsverträge |     |
| 12  | Vermietung & Untervermietung |     |
| 13  | Angebote |     |
| 14  | Expansion |     |
| 15  | Extra Time Stundensatz 1 | Stundensatz Team (niedriger als Stundensatz 2) |
| 16  | Extra Time Stundensatz 2 | Stundensatz "Senior", höher als Stundensatz 1 |
| 17  | Kunden Orga |     |
| 18  | Desktop Standortanalyse |     |
| 19  | Verwaltung |     |
| 20  | Akquise | Für Akquise und Anbahnung bis zum Vertragsabschluss |
| 21  | Betriebskostenabrechnung-Erstellung 2 | Stundensatz 2 |
| 22  | GGP Stundensatz GF, Prokurist | Geschäftsführer und Prokuristen |
| 23  | GGP Stundensatz Leitende Mitarbeiter |     |
| 24  | GGP Stundensatz PM, Techniker, Bilanzbuchhalter |     |
| 25  | GGP Stundensatz Mietenbuchhalter, Assistenz PM |     |
| 26  | GGP Stundensatz sonstige Assistenten |     |
| 27  | GGP Überstunden werktags 19-8 Uhr | +25% |
| 28  | GGP Überstunden sonn- und feiertags | +100% |
| 29  | Verbrauchsabrechnungen-Check |     |
| 30  | Start-up |     |
| 31  | Service-Paket |     |
| 32  | Scheduled Report |     |
| 33  | IT  |     |
| 34  | IT  |     |
| 35  | Weiterentwicklung |     |
| 36  | Team | Meetings, Einarbeitung, Vorstellungsgespräche, Geburtstagsplanung |
| 37  | Eigen Orga |     |
| 38  | Standort - Strategie |     |
| 39  | Standort - Expansion |     |
| 40  | Standort - Optimierung |     |
| 41  | Standort - Auflösung |     |
| 42  | BK-Check / Korrespondenz ab 01.08.2022 |     |
| 43  | Standortangebote anlegen |     |
| 44  | (kein Name hinterlegt) |     |

Zwei Auffälligkeiten sind im DOM bestätigt und sollten vor einer Übernahme geprüft werden, ähnlich dem in Abschnitt 1 beschriebenen Ausreißer bei BKA-Jahr. Die IDs 33 und 34 tragen beide unverändert den Namen IT, und ID 44 hat gar keinen Namen hinterlegt. Für die Neuentwicklung sollte das Fachteam klären, ob es sich bei den beiden IT-Einträgen um einen echten Dublettenfehler handelt oder ob eine der beiden Zeilen ursprünglich einen anderen Namen tragen sollte, und ob der namenlose 44. Eintrag überhaupt noch in Gebrauch ist.

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Für den Rebuild ist entschieden, dass der Eintrag mit ID 34 (IT) gelöscht wird, sodass nur noch der Eintrag mit ID 33 verbleibt. Ebenfalls entschieden ist, dass der namenlose Eintrag mit ID 44 gelöscht wird.

### 9.4 Standortmanagement

Standortmanagement ist, **vom Fachteam bestätigt und im DOM nachvollzogen**, eine eigenständige Seite im Info-Center und keine Unteransicht der in 9.1 bis 9.3 beschriebenen Konfigurationsseite. Die Listenansicht zeigt, im DOM bestätigt, die Spalten ID, Standort Nr, MDT, MDT Code, Adresse/Postfach, Ort, Property Management und Landlord, mit einem Filterbereich für dieselben Felder. Das Rechtsklick-Kontextmenü bietet die Punkte Standort hinzufügen und Standort bearbeiten.

Der Bearbeitungsdialog ist in zwei Reiter gegliedert, Standortinfo und Kontakte. Der Reiter Standortinfo entspricht inhaltlich genau dem in Abschnitt 3.2 beschriebenen Formular Neue Standort (Standort Nr., MDT, Adresse, Ort, Postfächer, Eigentümer Name, Eigentümer Adresse, Eigentumer Info), ergänzt um einen Button Add Field, mit dem sich, im DOM bestätigt, offenbar zusätzliche, frei benennbare Felder je Standort anlegen lassen. **Vom Fachteam bestätigt:** Diese Zusatzfelder sollen auch im Rebuild frei bleiben, ohne festen Datentyp und ohne festgelegten Geltungsbereich.

Der zweite Reiter, Kontakte, ist neu gegenüber der bisherigen Dokumentation und listet, im DOM bestätigt, die dem Standort zugeordneten externen Ansprechpersonen mit den Spalten Geschäftsbezeichnung, Ansprechpartner, Zuordnung, Start und Ende, ergänzbar über einen Button Kontakt hinzufügen. Die Zuordnung bestimmt dabei die Rolle des Kontakts, im beobachteten Beispiel Property Management; dieselbe Rollenbezeichnung erscheint auch als eigene Spalte in der Standort-Listenansicht, ebenso Landlord, sodass die beiden Listenspalten Property Management und Landlord vermutlich unmittelbar aus den Kontakte-Einträgen mit passender Zuordnung abgeleitet werden. Die hier verwalteten Kontakte stammen dabei ersichtlich aus demselben Stammdatensatz wie die in Abschnitt 9.5 beschriebene Kontaktdatenbank.

### 9.5 Kontaktdatenbank

Die Kontaktdatenbank ist, im DOM bestätigt, eine weitere eigenständige Seite im Info-Center und verwaltet den zentralen, mandantenübergreifenden Stammdatensatz externer Geschäftskontakte, etwa Property-Management-Gesellschaften, Hausverwaltungen oder einzelne Ansprechpersonen, die einem oder mehreren Standorten zugeordnet werden können, siehe Abschnitt 9.4. Die Listenansicht zeigt, im DOM bestätigt, die Spalten ID, Geschäftsbezeichnung, MDT, Branche, Zuordnung, Homepage, Geschäftsadresse und Hauptquartier E-mail, mit weiteren, über die Sichtbarkeit der Spalten einblendbaren Feldern Hauptquartier Telefon, Ansprechpartner, Status, Straße, Straßen Nr., PLZ und Ort, sowie einem entsprechenden Filterbereich. Branche und Zuordnung sind im aktuellen System offenbar Freitext- bzw. autocomplete-gespeiste Felder ohne technisch erzwungene Werteliste, vergleichbar dem in Abschnitt 1 beschriebenen Muster bei anderen Autocomplete-Filtern. Ein Rechtsklick-Kontextmenü wurde hier nicht gefunden, die Zeilen tragen statt dessen ein eigenes Anzeige-Symbol; ein Bearbeitungsdialog wurde nicht geöffnet.

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Für Branche und Zuordnung sollen künftig feste, abschließende Wertelisten statt freier Autocomplete-Eingaben gelten.

**Vom Fachteam bestätigt, vollständige Liste für Branche:** Büro, Logistik, Café, Industrie, Kauf- und Warenhaus, Kleinpreiskaufhaus/Rest, Lebensmittelfachgeschäft, Lebensmitteldiscounter, Supermarkt, Gastro, Sonstiges.

**Vom Fachteam bestätigt, vollständige Liste für Zuordnung:** Asset Management, Bürge, Facility Management, kaufmännische Verwaltung, Mieter, Mietzinsempfänger, Notar, Projektpartner, Property Management, Eigentümer, Rechtsanwalt, Untermieter, Vermieter, Kunde.

### 9.6 Reports

Reports ist, im DOM bestätigt, ein eigenständiges Berichtsmodul mit einem einzelnen Auswahlfeld Report Typ und vier Werten. Vorgefertigte Reports bietet, im DOM bestätigte, vollständige Liste, acht feste Berichte zur Auswahl, Eingegangene Markt im Jahresverlauf, Prüfungen pro Mitarbeiter, Betriebskostenabrechnungs Vollständigskeitskontrolle, Stundenreport, Benutzerbericht, Stundenzusammenfassung, Neu NKA (Diese Woche) und Missing NKA, jeweils einschränkbar auf ein MDT und einen Jahreszeitraum. Vorlagen erlaubt die Auswahl einer gespeicherten Berichtsvorlage. Benutzerdefinierte Reports ist ein eigener Berichtsbaukasten mit den Feldern Modul, Spalte und einem zusätzlichen Filterbereich, aus dem sich eine Vorlage speichern und einer Person zuordnen lässt, mit einer Option Zeitplanbericht einstellen. Planmäßige Berichte schließlich zeigt, im DOM bestätigt, eine Liste bereits eingerichteter, wiederkehrender Berichte mit den Spalten ID, Bericht ID, Aufgaben ID, Vorlage, Erstellt von, Zugeordnet zu, Beschreibung, Erstellt am, Letzter Bericht, Nächster Bericht, WV Datum und Status; die Spalte Aufgaben ID deutet darauf hin, dass ein Zeitplanbericht offenbar automatisch eine Aufgabe im in Abschnitt 8 beschriebenen Aufgabenmodul anlegt oder mit einer solchen verknüpft ist, was aber nicht weiter geprüft wurde.

### 9.7 Einstellungen

Einstellungen ist, im DOM bestätigt, eine eigene, kurze Seite mit zwei Gruppen reiner Konfigurationslinks, Prüfbogen Einstellungen (Prüfbogen Konto Add, Prüfbogen Flache Add, Prüfbogen-Vorlage Einstellung, Prüfbogen Chart-Data) und Fristen Einstellungen (Fristen Default Reminders). Die Prüfbogen-Einstellungen betreffen ausschließlich den in Anhang A beschriebenen, für die erste Rebuild-Phase ausdrücklich nicht vorgesehenen Prüfbogen und sind entsprechend ebenfalls nicht Teil dieser Phase. Fristen Default Reminders gehört zum eigenständigen Fristen-Modul in der linken Navigation, das außerhalb des Betriebskosten-, Aufgaben- und Info-Center-Umfangs dieses Dokuments liegt und hier nicht weiter untersucht wurde.

## 10. Weiterhin offene Punkte

Die allgemeinen Berechtigungsstufen im Info-Center unter Usermanagement sind, über die in Abschnitt 8.1 beschriebene Aufgaben-Sichtbarkeit hinaus, jetzt vollständig geklärt, siehe Abschnitt 9.1 und Abschnitt 11. **Vom Fachteam bestätigt:** Die einzelnen User Groups A bis H selbst sind funktional wichtig gewesen, welche einzelne Gruppe aber welche konkrete Berechtigung oder Funktion getragen hat, ist auch dem Fachteam selbst nicht mehr bekannt und lässt sich aus den Bestandsdaten nicht rekonstruieren; sie werden im Rebuild durch die in Abschnitt 11 beschriebene Zwei-Gruppen-Regelung ersetzt. Der Prüfbogen ist für die erste Rebuild-Phase bewusst nicht eingeplant und bleibt als Anhang A dokumentiert; sollte er später doch aufgenommen werden, sollte das Fachteam vorher die dort beschriebenen Reiter, Felder und Optionslisten noch einmal durchgehen und bestätigen, damit keine unvollständigen oder fehlerhaften Altstände unbesehen übernommen werden. Das in Abschnitt 3.3 nur beiläufig erwähnte Modul Buchhaltung ist inzwischen ebenfalls untersucht und in Abschnitt 13 dokumentiert; offen ist dort nur noch, ob die Buttons Export und Drucken ein PDF beziehungsweise einen Druckdialog erzeugen, siehe Abschnitt 12.5, Nr. 56 und Nr. 58. Bei derselben Live-Untersuchung wurde außerdem das Modul Verträge entdeckt, das in der ersten Fassung dieses Dokuments übersehen wurde und die Mietmanagement-Anforderungen aus Abschnitt 12.4 weitgehend abdeckt, siehe Abschnitt 14. **Vom Fachteam entschieden:** Das Modul Verträge wird Teil des Rebuild-Umfangs, und zur Wertsicherungsklausel sowie zu den Kündigungsfristen sollen künftig automatische Erinnerungen ausgelöst werden, siehe Abschnitt 12.4, Nr. 52, und Abschnitt 14.

## 11. Berechtigungsgruppen für die Neuentwicklung (vom Fachteam bestätigt)

Die bisherigen User Groups A bis H sind, wie in Abschnitt 9.1 und Abschnitt 10 beschrieben, inhaltlich nicht mehr dokumentiert und nicht rekonstruierbar. Ein erster Entwurf dieses Dokuments hatte dafür sechs neue, benannte Berechtigungsgruppen mit einer vollständigen Zugriffsmatrix je Modul vorgeschlagen. **Vom Fachteam bestätigt:** Das war zu kleinteilig, für die Neuentwicklung genügen an Stelle der alten Gruppen zwei klar definierte Berechtigungsgruppen, eine mit Vollzugriff und eine eingeschränkte Gruppe.

Die Gruppe mit Vollzugriff sieht alle Aufgaben, Fälle und Stammdaten und kann alles einstellen und konfigurieren. Nur Personen dieser Gruppe dürfen neue Aufgabentypen anlegen, siehe Abschnitt 8.2, neue Nutzerinnen und Nutzer anlegen, siehe Abschnitt 9.1, und eine Betriebskostenabrechnung einem anderen Mitarbeiter neu zuweisen, siehe Abschnitt 8.4.

Die eingeschränkte Gruppe sieht weiterhin, wie bereits in Abschnitt 8.1 beschrieben, nur die ihr selbst zugewiesenen, die ADH zugewiesenen und die Aufgaben, bei denen sie als Follower eingetragen ist, nicht aber alle Aufgaben. Sie darf keine neuen Nutzerinnen oder Nutzer anlegen und keine Betriebskostenabrechnung neu zuweisen. Aufgaben und neue Betriebskostenabrechnungen selbst anlegen darf dagegen weiterhin jede Person, unabhängig von der Gruppe.

Das bestehende Feld User type, siehe Abschnitt 9.1, bleibt von dieser Regelung unberührt und regelt weiterhin die technische Systemrolle, also ob sich eine Person überhaupt anmelden und administrative Systemfunktionen nutzen kann. Die neue Berechtigungsgruppe ist eine zusätzliche, davon unabhängige Einordnung.

**Anforderung für die Neuentwicklung, noch nicht der aktuelle Stand in Treaty:** Diese Zwei-Gruppen-Regelung ersetzt die bisherigen User Groups A bis H vollständig und ist die Grundlage für die in diesem Dokument mehrfach erwähnten Vollzugriffs-Einschränkungen, etwa beim Anlegen neuer Aufgabentypen (Abschnitt 8.2) und beim Neuzuweisen von Betriebskostenabrechnungen (Abschnitt 8.4).

## 12. Abgleich mit dem Anforderungskatalog (ClickUp/Trello/Teams-Vergleich)

Das Fachteam hat eine eigene Anforderungsliste vorgelegt, die ursprünglich für einen Vergleich zwischen ClickUp, Trello und Microsoft Teams als mögliche Standardwerkzeuge erstellt wurde. Diese Liste selbst enthält keinen Bezug zu Treaty, der Abgleich mit dem in den Abschnitten 1 bis 9 dokumentierten, beobachteten Treaty-Verhalten erfolgt hier zum ersten Mal. Die Liste gliedert sich in zwei große Blöcke, einen für Aufgaben-, Betriebskosten- und Mietmanagement sowie Rechnungserstellung (12.1 bis 12.5) und einen für Standortmanagement und Expansion (12.6). Die Spalte Status bewertet dabei ausschließlich, was in der bisher untersuchten Treaty-Oberfläche beobachtet oder vom Fachteam bestätigt wurde, nicht die grundsätzliche technische Machbarkeit einer Anforderung.

### 12.1 Allgemein

| Nr. | Anforderung | Status | Anmerkung |
| --- | --- | --- | --- |
| 1   | Verknüpfung mit Bestandsmodulen (Teams, Outlook, PDF24 etc.) | Nicht beobachtet | Keine Integration mit externen Programmen im bisher untersuchten Treaty gefunden |
| 2   | Login mit persönlichem Konto | Erfüllt | Jeder Nutzer hat einen eigenen Datensatz mit Username und Password, siehe Abschnitt 9.1 |
| 3   | Manuelle Reports aus Aufgaben | Teilweise erfüllt | Benutzerdefinierte Reports mit freier Modul- und Spaltenauswahl vorhanden, siehe Abschnitt 9.6; ob Aufgaben als Modul wählbar sind, wurde nicht geprüft |
| 4   | Planmäßige Reports als E-Mail versenden | Teilweise erfüllt | Planmäßige Berichte mit Zeitplanbericht-Option vorhanden, siehe Abschnitt 9.6; ob der Versand per E-Mail erfolgt, wurde nicht bestätigt |
| 5   | Zeiterfassung für Aufgaben und nach Aufgabentyp | Erfüllt | Zeiterfassungs-Timer je Aufgabe im DOM bestätigt, siehe Abschnitt 8.4 |
| 6   | Timesheet mit Filterfunktion (MDT, Aufgabenname, Aufgabentyp) | Teilweise erfüllt | Stundenreport und Stundenzusammenfassung vorhanden, siehe Abschnitt 9.6; die genauen Filtermöglichkeiten wurden nicht geprüft |
| 7   | Manuelle Zeiterfassung | Nicht bestätigt | Beobachtet wurde nur der laufende Zeiterfassungs-Timer; ob Zeiten auch ohne Timer nachträglich eingetragen werden können, wurde nicht geprüft |
| 8   | Graphische Visualisierung von Aufgabenkategorien (Stundenreport) | Nicht bestätigt | Stundenreport vorhanden, siehe Abschnitt 9.6; ob er graphisch dargestellt wird, wurde nicht geprüft |
| 9   | Export Zeiterfassung (Excel) | Teilweise erfüllt | Export-Funktion in Werkzeugleisten allgemein vorhanden, siehe Abschnitt 4; speziell für Zeiterfassung nicht geprüft |
| 10  | Beschränkter Zugriff auf verschiedene Aufgaben | Erfüllt | Vom Fachteam bestätigte Zwei-Stufen-Sichtbarkeit, siehe Abschnitt 8.1 |

### 12.2 Aufgabenmanagement

| Nr. | Anforderung | Status | Anmerkung |
| --- | --- | --- | --- |
| 11  | Aufgaben erstellen | Erfüllt | Dialog Neue Aufgabe, siehe Abschnitt 8.4 |
| 12  | Aufgaben Kunden zuordnen | Erfüllt | MDT-Feld der Aufgabe, siehe Abschnitt 8.2 |
| 13  | Aufgaben an Mitarbeiter zuweisen, mit beschränktem Zugriff | Teilweise erfüllt | Zuweisung über Zugewiesen an und Neu zuweisen vorhanden, siehe Abschnitt 8.2 und 8.4. **Vom Fachteam entschieden:** Nur die Gruppe Vollzugriff (Abschnitt 11) darf eine Betriebskostenabrechnung neu zuweisen, das Anlegen von Aufgaben und NKA bleibt für alle offen |
| 14  | Follower zu Aufgaben hinzufügen | Erfüllt | Followers-Feld, siehe Abschnitt 8.2 |
| 15  | Subtasks erstellen mit Zuordnung | Teilweise erfüllt | Unteraufgaben mit Titel, Erledigt-Status und Kommentarfunktion vorhanden, siehe Abschnitt 8.2; eine Zuordnung zu einzelnen Personen je Unteraufgabe wurde nicht beobachtet |
| 16  | Aufgabenvorlagen erstellen | Erfüllt | Abschnitt 8.5 |
| 17  | Aufgabentypen erstellen und festlegen | Nicht bestätigt | Aufgaben-Typ ist im DOM bestätigt eine feste Auswahlliste, siehe Abschnitt 8.2. **Vom Fachteam entschieden:** Neue Typen dürfen künftig nur von der Gruppe Vollzugriff angelegt werden, alle anderen wählen weiterhin nur aus der festen Liste |
| 18  | Widervorlagedatum automatisch anpassen an den Status der Aufgabe | Nicht erfüllt | Laut Fachteam werden Frist-Datum und WV-Datum bei Aufgaben frei gesetzt und nicht automatisch an den Status gekoppelt, siehe Abschnitt 8.2. **Vom Fachteam entschieden:** Nur bei mit einer Betriebskostenabrechnung verknüpften Aufgaben soll das WV-Datum künftig automatisch an das Betriebskostenmodul gekoppelt werden, siehe Abschnitt 8.1, bei allen anderen Aufgaben bleibt es frei einstellbar |
| 19  | Fristen erstellen | Erfüllt | Frist-Datum-Feld, siehe Abschnitt 8.2 |
| 20  | Aufgabenserie | Erfüllt | Abschnitt 8.2 |
| 21  | Aufgabenhistorie | Erfüllt | Vorgangshistorie mit protokollierten Änderungen, siehe Abschnitt 8.4 |
| 22  | Aufgaben filtern | Erfüllt | Filterbereich, siehe Abschnitt 8.3 |
| 23  | Aufgabe erstellen samt ID | Erfüllt | automatisch vergebene Aufgaben-ID, siehe Abschnitt 8.2 |
| 24  | Aufgaben kombinieren | Nicht beobachtet | keine entsprechende Funktion gefunden |
| 25  | Eine selbe Aufgabe an mehrere Personen zuweisen mit derselben ID | Bestätigt nicht vorhanden | **Vom Fachteam bestätigt:** wird nicht benötigt, der bestehende Follower-Mechanismus aus Abschnitt 8.2 deckt den Anwendungsfall bereits ab |
| 26  | Dateien hochladen und einsehen | Erfüllt | Anhänge-Dialog, siehe Abschnitt 8.4 |
| 27  | Automatische Abspeicherung der hochgeladenen Dateien in vorgesehenen Ordnern | Teilweise erfüllt | Für Betriebskosten-Dokumente ist eine Namenskonvention im Dateinamen beobachtet, siehe Abschnitt 3.4. **Vom Fachteam entschieden:** Die Ablage soll künftig automatisch nach demselben, unveränderten Namens- und Ordnerschema erfolgen |
| 28  | Berechtigungen für Aufgaben konfigurieren | Teilweise erfüllt | Grobe Zwei-Stufen-Sichtbarkeit vorhanden, siehe Abschnitt 8.1; das Zugriff-Feld bei Aufgaben-Vorlagen schränkt laut Fachteam in der Praxis aber nichts ein, siehe Abschnitt 8.5. **Vom Fachteam bestätigt:** Eine granularere Konfiguration je Aufgabe ist nicht gewünscht, die Zwei-Gruppen-Regelung aus Abschnitt 11 genügt |
| 29  | Aufgaben jederzeit neu zuweisen können | Erfüllt | Menüpunkt Neu zuweisen, siehe Abschnitt 8.4 |
| 30  | Abschließen | Erfüllt | Menüpunkt Aufgabe abschließen, siehe Abschnitt 8.4 |

### 12.3 Betriebskostenmanagement

| Nr. | Anforderung | Status | Anmerkung |
| --- | --- | --- | --- |
| 31  | Abrechnungen automatisch anlegen samt automatischer Texterkennung | Nicht beobachtet | Neue Abrechnung wird manuell angelegt, siehe Abschnitt 4. **Vom Fachteam entschieden:** Eine automatische Texterkennung soll ergänzt werden, sie soll die Felder Gesamtkosten, Vorauszahlungen und Ergebnis erkennen und befüllen, siehe Abschnitt 3.3 |
| 32  | Abrechnung zuweisen an zuständigen Mitarbeiter | Erfüllt | Feld ADH, siehe Abschnitt 3.3 |
| 33  | Status festlegen, bei Neuanlage automatisch Neu mit WV-Datum in 2 Wochen | Teilweise erfüllt | Status-Feld mit elf Werten vorhanden, siehe Abschnitt 6.1. **Vom Fachteam bestätigt:** Bei Neuanlage sollen Status automatisch auf Neu und WV-Datum automatisch auf zwei Wochen gesetzt werden, siehe Abschnitt 3.3 |
| 34  | Widervorlagedatum automatisch je nach Status, manuell änderbar | Teilweise erfüllt | Die Farblogik nach Status ist vollständig dokumentiert, siehe Abschnitt 6.2. **Vom Fachteam entschieden:** Das WV-Datum soll künftig automatisch anhand des Status fortgeschrieben werden, nicht nur die Farbe, siehe Abschnitt 6.2 |
| 35  | Dateienanhänge hochladen und einsehen | Erfüllt | Abschnitt 3.4 und 4.1 |
| 36  | Automatische Abspeicherung der hochgeladenen Dateien in vorgesehenen Ordnern | Teilweise erfüllt | siehe Nr. 27 |
| 37  | Kommentare an ausgewählte Nutzer senden | Erfüllt | Sprechblasen-Symbol mit Chat-Bereich, siehe Abschnitt 4 |
| 38  | Vorgangshistorie | Erfüllt | Abschnitt 3.7 und 4.1 |
| 39  | Verknüpfung mit Aufgaben, automatische Aufgaben-Erzeugung bei BKA-Neuanlage | Teilweise erfüllt | Die Verknüpfung selbst ist bestätigt, siehe Abschnitt 8.1. **Vom Fachteam bestätigt:** Beim Anlegen einer BKA soll künftig automatisch eine verknüpfte Aufgabe erzeugt werden, siehe Abschnitt 8.1 |
| 40  | Filterfunktion nach Standortnummer, zuständigem Mitarbeiter, Ort etc. | Erfüllt | Filterbereich der Fallliste, siehe Abschnitt 4 |
| 41  | Counterpart dauerhaft je Standort hinterlegen | Nicht erfüllt | Counterpart ist im beobachteten Datenmodell ein Feld je Fall, siehe Abschnitt 3.3. **Vom Fachteam bestätigt:** Counterpart soll künftig automatisch aus dem Fall des Vorjahres übernommen werden, bei einem Wechsel der Verwaltung aber anpassbar bleiben, siehe Abschnitt 3.3 |
| 42  | Ansprechpartner Mandant dauerhaft hinterlegen | Erfüllt | Über das Feld User im MDT-Bearbeitungsdialog bereits als dauerhafte Stammdatenangabe vorhanden, siehe Abschnitt 3.1 |
| 43  | Gesamtkosten, Vorauszahlungen, Guthaben/Nachzahlung, ca. Wertfehler und Ersparnis eintragen, automatisch bei Upload | Teilweise erfüllt | Alle genannten Felder existieren im Fall, siehe Abschnitt 3.3. **Vom Fachteam entschieden:** Gesamtkosten, Vorauszahlungen und Ergebnis, das dem Feld Guthaben/Nachzahlung entspricht, sollen automatisch per Texterkennung befüllt werden, siehe Nr. 31; für ca. Werte Fehler und Ersparnis wurde eine automatische Texterkennung dagegen ausdrücklich abgelehnt, diese bleiben manuell auszufüllen |
| 44  | Verknüpfung E-Mail MDT und Counterpart mit Outlook | Nicht beobachtet | **Vom Fachteam entschieden:** Ein Doppelklick auf Ansprechpartner oder Counterpart soll künftig automatisch Outlook mit vordefinierter E-Mail öffnen, siehe Abschnitt 3.3 |
| 45  | Schriftsätze erstellen, automatisch an Standort angepasste Vorlage | Erfüllt | Schriftsatz-Generator mit Vorlagenerzeugung, siehe Abschnitt 7. **Vom Fachteam bestätigt:** Der bestehende Detailgrad der automatischen Standortanpassung bleibt unverändert, keine weitere Anforderung für den Rebuild |
| 46  | Exporte ziehen | Erfüllt | Werkzeugleiste, siehe Abschnitt 4 |
| 47  | Zeiterfassung für Abrechnungen | Erfüllt | über die Verknüpfung mit dem Aufgabenmodul, siehe Abschnitt 8.1 |
| 48  | Automatische inhaltliche Bewertung (rot, gelb, grün nach Plausibilität) | Nicht erfüllt | Die vorhandene Farblogik bewertet ausschließlich die Fristdringlichkeit nach Status und Arbeitstagen, siehe Abschnitt 6.2. **Vom Fachteam bestätigt:** wird nicht benötigt, die bestehende Farblogik bleibt wie in Abschnitt 6.2 beschrieben ausreichend |
| 49  | Automatische Erstellung Widerspruch | Bestätigt nicht vorhanden | vom Fachteam in der Anforderungsliste selbst als aktuell fehlend benannt. **Vom Fachteam bestätigt:** wird in den Rebuild-Umfang aufgenommen, siehe Abschnitt 7 |
| 50  | Prüfungs-Checkliste je Verwaltung | Bestätigt nicht vorhanden | vom Fachteam in der Anforderungsliste selbst als aktuell fehlend benannt. **Vom Fachteam bestätigt:** wird in den Rebuild-Umfang aufgenommen, siehe Abschnitt 7 |

### 12.4 Mietmanagement

Beide Punkte dieses Blocks betreffen das Modul Verträge, das ebenfalls live in Treaty aufgerufen wurde und vollständig in Abschnitt 14 beschrieben ist. Es wurde in der ersten Fassung dieses Dokuments übersehen, weil es links keinen zum Wort Mietmanagement passenden Menüpunkt gibt.

| Nr. | Anforderung | Status | Anmerkung |
| --- | --- | --- | --- |
| 51  | Mieterhöhungen eintragen | Teilweise erfüllt | Das Feld Staffelmiete im Vertrag erlaubt mehrere Zeilen mit Betrag und Datum, siehe Abschnitt 14; eine darüber hinausgehende, eigenständige Historie einzelner Mieterhöhungen wurde nicht gefunden. **Vom Fachteam entschieden:** Die Staffelmiete allein reicht nicht aus, für den Rebuild wird eine eigene Mieterhöhungs-Historie benötigt |
| 52  | Alarmsystem bei Wertsicherungsklausel und Fristen | Teilweise erfüllt | Der Vertrag führt umfangreiche Datenfelder zur Wertsicherungsklausel und zu Kündigungsfristen und Optionen, siehe Abschnitt 14; eine automatische Erinnerung oder Alarmierung daraus wurde nicht beobachtet. **Vom Fachteam entschieden:** Automatische Erinnerungen zur Wertsicherungsklausel und zu den Kündigungsfristen sollen für den Rebuild ergänzt werden |

### 12.5 Rechnungserstellung

Alle sechs Punkte dieses Blocks betreffen das in Abschnitt 3.3 im Feld Gruppiert nur am Rande erwähnte Modul Buchhaltung. Es wurde für diese Fassung des Dokuments live in Treaty aufgerufen und ist vollständig in Abschnitt 13 beschrieben.

| Nr. | Anforderung | Status | Anmerkung |
| --- | --- | --- | --- |
| 53  | Manuelles Erstellen von Rechnungen | Erfüllt | Dialog Neue Abrechnung mit MDT, Zeitraum, Reisekosten und frei benennbaren Leistungspositionen, siehe Abschnitt 13 |
| 54  | Rechnungsansicht mit 25, 50 oder allen Elementen | Erfüllt | Umschaltbare Anzeige auf 10, 25, 50 oder alle Einträge, siehe Abschnitt 13 |
| 55  | Filtern und Sortieren von Rechnungen nach Zeitraum | Erfüllt | Zeitraumfilter für das Rechnungsdatum sowie sortierbare Spalten, siehe Abschnitt 13 |
| 56  | Exportieren von Rechnungen als PDF | Teilweise erfüllt | Export-Button vorhanden, das aktuell erzeugte Format ließ sich im DOM nicht bestätigen, siehe Abschnitt 13. **Vom Fachteam entschieden:** Der Export soll künftig sowohl als PDF als auch als Excel-Datei möglich sein |
| 57  | Verschiedene Preise und Leistungen erstellen | Teilweise erfüllt | Freie Leistungspositionen mit Menge und Kosten je Rechnung möglich, ein globaler Leistungsstamm wie der Leistungskatalog in Abschnitt 9.3 wurde für Rechnungen nicht gefunden, siehe Abschnitt 13 |
| 58  | Drucken von Rechnungslisten | Nicht bestätigt | Drucken-Button vorhanden, das Ergebnis ließ sich im DOM nicht bestätigen, siehe Abschnitt 13 |

### 12.6 Standortmanagement / Expansion

Dieser Block der Anforderungsliste beschreibt eine Matching-Plattform für Flächenangebote und Suchprofile mit Kundenregistrierung, automatischer Exposé-Erstellung und einer prozentualen Matching-Bewertung. Das hat mit dem in Abschnitt 9.4 dokumentierten Standortmanagement des Info-Centers, das lediglich eine interne Stammdatenverwaltung bestehender Standorte ist, inhaltlich nichts zu tun. In der bisher untersuchten Treaty-Oberfläche wurde keine entsprechende Funktion gefunden. **Vom Fachteam bestätigt:** Dieser gesamte Funktionsbereich soll künftig ebenfalls Teil von Treaty werden. Es gibt dafür in Treaty keinen bestehenden Ansatz, er muss komplett neu konzipiert werden und ist damit ein eigenständiger Baustein für die Neuentwicklung, keine Erweiterung eines bestehenden Treaty-Moduls. Die folgende Tabelle übernimmt die Nummerierung des Fachteams so, wie sie in der Ausgangsliste vorlag, dort durchgängig lückenhaft, da dort nicht jede Zeile eine eigene laufende Nummer trägt.

| Nr. | Zugehörigkeit | Anforderung | Erklärung |
| --- | --- | --- | --- |
| 1   | Allgemein | Erstellung von Kundenprofilen | Kunden können sich selbstständig registrieren und erhalten dadurch einen eigenen Account |
| –   | Allgemein | Profil jederzeit bearbeiten können |     |
| 2   | Upload Flächenangebot | Registrierung von Freiflächen mit vorheriger Registrierung | sowohl Kunden als auch ADH sollen Freiflächen im jeweiligen Kundenprofil anlegen und bearbeiten können |
| –   | Upload Flächenangebot | Registrierung von Freiflächen ohne vorherige Registrierung | auch ohne Kundenkonto möglich |
| –   | Upload Flächenangebot | Upload durch vordefinierte Felder oder durch Dokumente mit KI-Erkennung | eine KI soll die vordefinierten Felder aus hochgeladenen Unterlagen per Texterkennung automatisch befüllen und nur nach fehlenden Pflichtfeldern fragen |
| –   | Upload Flächenangebot | Exposé wird automatisch erstellt | inklusive automatisch ergänzter Bilder, zum Beispiel von Google Maps |
| –   | Upload Flächenangebot | Exposé-Vorschau anzeigen | Textfelder bleiben für den Kunden anpassbar |
| –   | Upload Flächenangebot | Exposé herunterladen |     |
| –   | Upload Suchprofil | Registrierung eines Suchprofils mit vorheriger Registrierung | Angaben zu gesuchter Fläche, Lage, Größe etc. |
| –   | Upload Suchprofil | Registrierung eines Suchprofils ohne vorherige Registrierung |     |
| –   | Upload Suchprofil | Upload durch vordefinierte Felder oder durch Dokumente |     |
| –   | Upload Suchprofil | Präferenzen gewichten | bestimmte Kriterien als besonders wichtig markieren |
| –   | Upload Suchprofil | Teammitglieder hinzufügen und Rollen verteilen | zum Beispiel je Region ein anderer Ansprechpartner innerhalb eines Kundenunternehmens |
| –   | Matching | Flächen und Suchprofile matchen | gegenseitiges Vorschlagen bei Kriterienübereinstimmung |
| –   | Matching | Gewichtung nach Prozent | Anzeige des Match-Grads, zum Beispiel 100% oder 98% |
| –   | Matching | Flächen und Suchprofile ansehen können | Vermieter sieht Unternehmen bzw. Suchprofil, Mieter sieht das Exposé |
| 10  | Matching | Wunschkriterien mit Angebotskriterien verknüpfen |     |
| 11  | Matching | Filtern nach Kriterien | zum Beispiel alle passenden Flächen in Hessen mit 100m² |
| –   | Matching | Absagegründe erfassen | soll laut Fachteam in ein lernendes System zur besseren Passung einfließen |
| –   | Kommunikation | Chat im System mit Vorgangshistorie | inklusive automatischer Erinnerung per Mail bei neuer Nachricht |
| –   | Kommunikation | ADH-Hilfe-Button | für Rückfragen während Kommunikation oder Verhandlung |
| –   | Kommunikation | Automatische Erinnerung | wenn ein Angebot vier Wochen lang nicht abgesagt oder favorisiert wurde |
| –   | Kommunikation | Favorisieren von Angeboten |     |
| 13  | Kommunikation | Exposé als Serienmail versenden | insbesondere für Unternehmen, die das System selbst nicht aktiv nutzen |
| 15  | Kommunikation | Automatisches Versenden von Mails | bei passenden Angeboten an inaktive Eigentümer |
| –   | Kommunikation | Termine digital abstimmen | Kalenderzugriff für Besichtigungstermine, laut Fachteam nice to have |
| –   | Datenaufbereitung | Umfeld automatisch erkennen | Wettbewerber und direktes Umfeld, denkbar über eine Kartenintegration |
| –   | Datenaufbereitung | Standortdaten | Laufkundschaft, Einwohnerzahl etc. |
| –   | Sonstiges | Laufzeiten bestehender Mietverträge hinterlegen | nur für ADH sichtbar, auch für außerhalb des Systems angebotene Flächen |
| –   | Sonstiges | Zugriffe beschränken | ADH sieht alles; von ADH neu hochgeladene Flächen sind zunächst privat, bis sie freigegeben werden |

## 13. Modul Buchhaltung (Rechnungserstellung)

Das Modul Buchhaltung ist, im DOM bestätigt, ein eigener Menüpunkt in der linken Navigation und wurde für diese Fassung des Dokuments erstmals live in Treaty aufgerufen, unter der internen Bezeichnung Rechnungsprogramm. Es deckt die in Abschnitt 12.5 aufgeführten Anforderungen zur Rechnungserstellung ab und ist die in Abschnitt 3.3 im Feld Gruppiert erwähnte Verknüpfung zur Rechnungsstellung.

Die Listenansicht zeigt, im DOM bestätigt, eine Tabelle mit den Spalten ID, Rechnungsdatum, MDT, Status, Start date, End date, Rechnungsnummer, Zahlungsziel, Datum letzte Änderung, Rechnungsbetrag Gesamt, Grundgebühr und Reisekosten, mit einem Zeitraumfilter für das Rechnungsdatum, einem MDT-Filter, einem Suchfeld sowie sortierbaren Spalten. Die Anzeige lässt sich auf 10, 25, 50 oder alle Einträge umstellen. Status ist ein Auswahlfeld mit den im DOM bestätigten Werten generiert, versendet, bezahlt und storniert.

Das Rechtsklick-Kontextmenü einer Zeile bietet die Punkte View Rechnung, New Rechnung, Edit Rechnung, Generate Invoice, Senden Rechnung, Rechnung Storno und Rechnung Löschen. View Rechnung öffnet eine reine Anzeige mit weiteren, in der Liste nicht sichtbaren Feldern, nämlich Kappungsgrenze Reisekosten, Total Created Cases, Geprüfte BKA's, offene Filialen, abgeschlossene Filialen, Stundenaufwand, Summe Ersparnisse und Stundensatz. New Rechnung öffnet den Dialog Neue Abrechnung mit einem Zeitraum für das Rechnungsdatum, einem MDT-Feld, einem Reisekosten-Feld sowie drei freien Zeilen mit je einem Freitext-, einem Mengen- und einem Kostenfeld, über die sich einzelne Leistungspositionen frei benennen und bepreisen lassen. Ein globaler, mandantenübergreifender Leistungsstamm wie der Leistungskatalog in Abschnitt 9.3 wurde für Rechnungspositionen nicht gefunden.

Die Werkzeugleiste über der Tabelle bietet zusätzlich Auswählen mit einem Untermenü Select all, Deselect all, Select rows, Select columns und Select cells, sowie die Buttons Export und Drucken. Beide Buttons wurden angeklickt, ohne dass sich im sichtbaren Seitenbereich eine Rückmeldung zeigte, weshalb offenbleibt, ob dabei ein Download oder ein Druckdialog ausgelöst wird und in welchem Format, insbesondere ob der Export ein PDF erzeugt. Ein separater Kachelbereich Generate mit den Feldern MDT und Häufigkeit (Werteliste Monat, Quartal, Jahr, Einmalig) deutet auf eine periodische, automatisierte Rechnungserstellung hin; diese Funktion wurde nicht ausgelöst, um keine echten Rechnungsdaten in der laufenden Umgebung zu erzeugen, ihre genaue Wirkung ist damit nicht bestätigt. **Vom Fachteam bestätigt:** Diese Funktion soll unverändert erhalten bleiben, für den Rebuild ist an ihr nichts zu ändern.

## 14. Modul Verträge (Mietmanagement)

Das Modul Verträge ist, im DOM bestätigt, ein eigener Menüpunkt in der linken Navigation, unter der internen Bezeichnung ContractManagement. Es wurde in der ersten Fassung dieses Dokuments übersehen, weil links kein Menüpunkt Mietmanagement existiert, und deckt die in Abschnitt 12.4 aufgeführten Anforderungen weitgehend ab. **Vom Fachteam entschieden:** Das Modul Verträge wird Teil des Rebuild-Umfangs, siehe auch Abschnitt 10. Die Listenansicht Vertrag Liste zeigt, im DOM bestätigt, die Spalten ID, MDT, Vertrag_VN, Vertrag_VG, Vertrag Status, Standort#, Ort und Vermieter, mit einem Filter für MDT und Standort Nr., einem Suchfeld, sortierbaren Spalten und einer auf 10, 20, 50 oder alle Einträge umschaltbaren Anzeige. Die Werkzeugleiste bietet Auswählen, Export, Drucken, Kopieren und Neuer Vertrag. Vertrag Status ist ein Auswahlfeld mit den im DOM bestätigten Werten vorgeschlagen, aktiv, ProForma, gekündigt und archiviert. Das Rechtsklick-Kontextmenü einer Zeile bietet nur den einen Punkt Edit Vertrag.

Der Bearbeitungsdialog ist in sechs Reiter gegliedert, Basic, Fristen Mgmt, Miete, Indexierung, Rechnung und Klauseln. Der Reiter Basic enthält MDT Code, Standort#, Vertrag (VN), Standort# (VG), Vertrag (VG), Vertrag Status, Verwendung (Werteliste Restaurant, Lager, Stellplatz, Werbefläche), Lage und MF, Parkplatz, MF Gesamt, Mietzweck (Werteliste Einzelhandel, Café/Imbiss, Gastro allgemein, Restaurant nach VAPIANO-Konzept, Lager, Stellplatz, Werbefläche), Nutzungsbeschränkungen und Übergabe.

Der Reiter Fristen Mgmt enthält Optionen LZ mit Laufzeit in Jahren und Frist in Monaten, Optionen als Anzahl, eine Liste einzelner Options-Zeitfenster mit Von, Bis und Ausübung, Bedingungen, Rücktrittsrecht (Ja/Nein, Wer mit der Werteliste Mieter, Vermieter, Mieter/Vermieter, Bis, Bemerkungen), automatische Verlängerung (Ja/Nein, Laufzeit, aktiv Ja/Nein) sowie die Kündigungsfrist mit der Werteliste 1, 3, 6, 9, 12, 18 und 24 Monate, dem Bezugspunkt KÜ Frist zum mit der Werteliste täglich, Monatsende, Quartalsende, Halbjahresende, Jahresende und Laufzeitende, einem Feld KÜ ausgeübt (Ja/Nein) mit Datum sowie separaten Sonderkündigungsrechten für Vermieter (SoKü VG) und Mieter (SoKü VN), jeweils mit Bis-Datum und Ausübungsvermerk. **Vom Fachteam entschieden:** Aus der Kündigungsfrist sollen künftig automatische Erinnerungen ausgelöst werden, siehe Abschnitt 12.4, Nr. 52.

Der Reiter Miete enthält die vertragliche Miete pro Monat mit einem Indexiert-Schalter, eine sonstige Miete ebenfalls mit Indexiert-Schalter, die Währung (Werteliste Euro, Schweizerfranken, Tschechische Kronen, Dänische Krone, Zloty, Pfund Sterling), eine Umsatzmiete mit Prozentsatz, Meldungsrhythmus, Brutto/Netto-Angabe, Umsatzwert und Anmerkungen, eine Staffelmiete mit einer oder mehreren Zeilen aus Betrag und Datum sowie Anmerkungen, das Datum, seit dem die IST-Miete gilt, den Mietzahlungsbeginn, die vertragliche und die IST-Nebenkostenvorauszahlung mit Indexiert-Schalter, die vertragliche und die IST-Heizkostenvorauszahlung, eine Nebenkostenpauschale mit Indexiert-Schalter und Deckelung, einen Werbekostenbeitrag mit Indexiert-Schalter, Centermanagement-Kosten mit Indexiert-Schalter, sonstige Zahlungen mit Indexiert-Schalter, Zahlungsbeginn und Zahlungsrhythmus der Nebenkosten, eine Mietsubvention sowie eine Mietsicherheit mit Art (Barkaution, Bürgschaft, Sparbuch/Wertpapier, Verpfändungserklärung) und Betrag. **Vom Fachteam entschieden:** Die Staffelmiete allein reicht für Mieterhöhungen nicht aus, für den Rebuild wird eine eigene Mieterhöhungs-Historie benötigt, siehe Abschnitt 12.4, Nr. 51.

Der Reiter Indexierung bildet die Wertsicherungsklausel ab, mit Veränderung in Prozent und in Punkten, Anpassung um ein Basisjahr, dem angewandten Index, der Häufigkeit möglicher Anpassungen (Werteliste jährlich, halbjährlich, vierteljährlich, monatlich, immer), dem Bezugsmonat für die Anpassung, der ersten möglichen Anpassung mit dem dabei aktuellen VPI sowie der letzten Anpassung mit Datum und angewandtem Index. **Vom Fachteam entschieden:** Aus der Wertsicherungsklausel sollen künftig automatische Erinnerungen ausgelöst werden, siehe Abschnitt 12.4, Nr. 52.

Der Reiter Rechnung ist, im DOM bestätigt, ohne Inhalt, er zeigt keine Felder. Beim ersten Aufruf des Reiters wurden stattdessen kurzzeitig die Felder des Reiters Klauseln sichtbar, bis sich die Ansicht auf die tatsächlich leere Rechnung-Seite aktualisierte; dieses Verhalten wurde reproduziert und ist damit ein im DOM bestätigter technischer Befund, ähnlich den in Abschnitt 1 beschriebenen Auffälligkeiten. **Vom Fachteam bestätigt:** Der Reiter soll leer bleiben, für den Rebuild ist hier kein Inhalt vorzusehen.

Der Reiter Klauseln enthält Konkurrenzschutz (Ja/Nein) mit einem Umkreis aus der Werteliste 1km, 2km, 3km, 5km, 10km, 15km, 20km, 25km, 30km und 50km, Sortimentsschutz (Ja/Nein) mit Bemerkungen, Betriebspflicht (Ja/Nein) mit Bemerkungen, Untervermietung (Ja/Nein) mit Bemerkungen, Verkehrssicherungspflicht (Ja/Nein), Schönheitsreparaturen (Ja/Nein), Instandhaltung (Ja/Nein) mit Bemerkungen, Instandsetzung (Ja/Nein) mit Bemerkungen, Kosten im Einzelfall, Kosten im Jahr und ein Freitextfeld für allgemeine Anmerkungen. Im DOM zusätzlich bestätigt, auf derselben Seite aber nicht ohne Scrollen sichtbar, sind eine Zahlungsweise (Bankeinzug, Überweisung), ein Zahlungsempfänger aus einer Werteliste mit unter anderem Vermieter, Mieter, Untermieter, administrative Verwaltung, kaufmännische Verwaltung, Property Management, Facility Management, Mietzinsempfänger und Zahlungsempfänger Nebenkosten, sowie je ein Ja/Nein-Feld für Kleinreparaturklausel, Rückbauverpflichtung, Umsatzsteuerpflicht und die Zuordnung von Wartung und Reparatur zum Mieter.

Der eigene Menüpunkt Mieten in der linken Navigation wurde ebenfalls aufgerufen; seine Seite ist, im DOM bestätigt, vollständig ohne Inhalt, außer der Titelzeile Mieten selbst. **Vom Fachteam entschieden:** Die Seite soll vorerst unverändert bleiben.

## Anhang A: Der Prüfbogen (nicht Teil der ersten Rebuild-Phase)

Der Prüfbogen ist in der bestehenden Oberfläche als eigene, dem Fall zugeordnete Struktur mit neun Reitern vorhanden und über den entsprechenden Menüpunkt im Fallmenü erreichbar, siehe Abschnitt 4.1. **Vom Fachteam bestätigt:** Der Prüfbogen wurde nie fertig entwickelt und wird in der Praxis nicht genutzt. Auf ausdrücklichen Wunsch ist er für den ersten Schritt der Neuentwicklung zu komplex und bleibt deshalb außen vor. Die folgende Beschreibung dokumentiert lediglich, was in der bestehenden Oberfläche an Feldern und Reitern bereits angelegt ist, für den Fall, dass der Prüfbogen zu einem späteren Zeitpunkt doch aufgegriffen werden soll. Da er nie fertiggestellt wurde, ist davon auszugehen, dass einzelne Abläufe, etwa die genaue Verknüpfung der Reports mit den übrigen Reitern, im Fachteam noch einmal durchgesprochen und ergänzt werden müssten, bevor sie übernommen werden.

Der vorhandene Prüfbogen ist über neun Reiter gegliedert. Er verwendet für seine Auswahlfelder benannte, offenbar pro Prüfpunkt fest hinterlegte Optionslisten mit Namen wie prufbogen_opts_1 bis mindestens prufbogen_opts_53, im DOM bestätigt.

**Datengrundlage.** Acht Auswahlfelder verknüpfen die für die Prüfung notwendigen Belege: Mietvertrag, Nachträge, Betriebskostenabrechnung, Belege, Kontenübersichten, Heizkostenabrechnung, Vorjahresabrechnung, Kunden Angabe Vorauszahlungen, mit Optionslisten rund um Vollständigkeitsstufen wie Vollständig, Unvollständig fehlende Seiten oder Fehlt.

**Mietvertragsprüfung.** Neun Felder zu den vertraglichen Grundlagen, unter anderem Form der Abrechnung, Anspruchsgrundlage im MV, Umlageschlüssel-Regelung, Erstellungsfrist, Nachforderungsausschlussfrist.

**Formelle Richtigkeit.** Dreizehn Felder zu den formalen Mindestanforderungen einer Abrechnung, unter anderem Adressierung, Firmierung Verwalter, Objektadresse, Rechnungsnummer, Abrechnungszeitraum, Mwst Ausweisung, mit bewertenden Optionslisten wie Korrekt / Falsch / Fehlerhaft.

**Anspruchsgrundlagenprüfung.** Eine editierbare Positionstabelle mit den Spalten Position, Gesamtkosten, Konto, AGL (Anspruchsgrundlage, vom Fachteam bestätigt), Gründe, Konsequenz, mit laufender Summe der beanstandeten Beträge.

**Flächenschlüssel.** Erfasst Mietfläche und Umlageschlüssel, mit einem zweiten Unterreiter für eine mögliche Korrektur.

**Heizkostenprüfung.** Kopf-Felder zu Heizungsart und Kostenverteilung, plus eine eigene Positionstabelle wie bei der Anspruchsgrundlagenprüfung.

**Rechnerische Richtigkeit.** Rechnet die Gesamtkosten anhand des Flächenschlüssels nach, inklusive Ampel-Kennzeichnung je Kostenposition.

**Detailanalyse.** Eine feste Liste einzelner Prüfpunkte wie Abzug bei Vollwartungsverträgen, Eichung Zähler gültig oder Erklärung Kostensteigerungen über 20 Prozent.

**Reports.** Vier Aktionen, Enter Data to generate BSB (Betriebskostenstatusbericht, vom Fachteam bestätigt), Auswertung, Widerspruch und Create Task.
