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
