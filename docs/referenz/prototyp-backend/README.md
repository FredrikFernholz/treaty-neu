# Prototyp-Backend (nur Referenz)

Dieser Ordner enthält einen PHP-Port des Klick-Prototyps von Treaty 2.0, geliefert am 13.10.2026 als `treaty-backend.tar.gz`. Er dient nur zum Nachschlagen. Der Code wird nicht ausgeführt und nicht 1:1 nach Treaty 2.0 übertragen. Im Projekt gibt es kein PHP.

Nützlich sind:

- `src/Geschaeftsregeln.php` (Arbeitstage, Donnerstagsregel, WV-Datum, Ampeln, Serien, Zahlungsziel)
- `src/Vertragsregeln.php` (Fristen und Erinnerungen im Vertragsmanagement)
- `src/Konstanten.php` (Status, Auswahllisten, Tabellenwerte)
- `database/schema.sql` (Tabellen und Felder des Prototyps; beim Vertragsmanagement hat es laut PRD Vorrang vor der Felddokumentation)
- `database/mockdata.json` und `database/vertraege_mock.json` (Mock-Daten)

Ohne Bedeutung für Treaty 2.0 sind `src/Controllers/`, `src/Auth.php`, `src/Router.php`, `src/Database.php`, `src/Response.php`, `public/`, `bin/` und `config/`.

Wo Werte im Prototyp von `docs/entscheidungen.md` abweichen, gilt `entscheidungen.md`. Ein Beispiel ist die 4. Erinnerung, die im Prototyp 15 Arbeitstage hat und in Treaty 2.0 entschieden 10.

**Achtung, Zugangsdaten.** Die Seed-Daten (`database/seed.php`) setzen für alle Konten das Demo-Passwort `treaty2026`, und `config/config.php` enthält das Entwicklungspasswort `treaty_dev_pw` als Rückfallwert. Keines davon darf jemals in Treaty 2.0 übernommen werden, weder in Seeds noch in Tests oder `.env`-Vorlagen.

Die ursprüngliche README des Archivs liegt unverändert als `README_prototyp.md` daneben.
