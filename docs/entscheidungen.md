# Entscheidungen Treaty 2.0

Hier werden fachliche und technische Entscheidungen festgehalten, die PRD und Konzeption offenlassen oder die von ihnen abweichen. Jeder Eintrag nennt Datum, Anlass, Entscheidung und Auswirkung. Spätere Änderungen an einer Entscheidung werden als neuer Eintrag ergänzt, der alte bleibt stehen.

## 15.10.2026, Anmeldung per Kürzel, E-Mail Pflicht und eindeutig

**Anlass.** Konzeption Abschnitt 9 beschreibt Passwortregeln, Sperren und Sitzungen, legt aber nicht fest, mit welchem Merkmal sich ein Nutzer anmeldet. Die Tabelle `benutzer` (Konzeption 6.2) führt sowohl ein Kürzel als auch eine E-Mail-Adresse.

**Entscheidung.** Die Anmeldung erfolgt mit dem Kürzel und dem Passwort. Die E-Mail-Adresse ist trotzdem ein Pflichtfeld und muss eindeutig sein.

**Auswirkung.** In der Datenbank sind `kuerzel` und `email` beide `NOT NULL` und mit einer Eindeutigkeitsregel versehen (Migration `0000_benutzer`). Das Kürzel ist nach der Anlage nicht mehr änderbar und damit ein stabiles Anmeldemerkmal. Die Anmeldemaske in Ausbaustufe 1 fragt nach Kürzel und Passwort.
