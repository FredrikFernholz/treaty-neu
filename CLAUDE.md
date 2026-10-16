# Treaty 2.0 – Neustart: Anweisungen für Claude Code

## Worum es geht

Treaty 2.0 ist die interne Plattform der ADH Deutschland GmbH für Nebenkostenprüfung (Betriebskosten), Miet- und Indexanpassungen (Mieten), Aufgaben, Zeiterfassung, Rechnungen (ZUGFeRD) und Auswertungen.

Es gab bereits einen ersten Umsetzungsversuch. Er wird **nicht** weitergeführt, weil der Code nicht nachvollziehbar ist. Wir beginnen mit leerem Code, aber mit derselben fachlichen und technischen Planung.

**Maßgebliche Unterlagen** (liegen in `docs/`, vor jeder Arbeit lesen):
- `docs/PRD_Treaty_2.0.md` – was Treaty fachlich tut
- `docs/Konzeption_Treaty_2.0.md` – wie es technisch umgesetzt wird (Architektur, Datenmodell, Regeln, Rechte, Ausbaustufen)
- `docs/Treaty_2.0_Felddokumentation.xlsx` – vollständiges Feldmodell je Modul
- `docs/entscheidungen.md` – getroffene Entscheidungen des Nutzers und des Fachteams
- `docs/abgleich.md` – noch offene Widersprüche zwischen den Unterlagen

**Vorrangregel.** `docs/entscheidungen.md` geht allen anderen Dokumenten vor, auch PRD, Konzeption, Felddokumentation, Entwicklerdoku und dieser Datei. Ist ein Widerspruch zwischen Dokumenten dort noch nicht entschieden, wird er als Punkt in `docs/abgleich.md` eingetragen und dem Nutzer vorgelegt. Es gilt **keine** pauschale Regel „neueres Dokument gewinnt“. Konzeption Abschnitt 16 (Entscheidungsbedarf) wird ebenfalls **nicht** eigenmächtig entschieden, sondern dem Nutzer vorgelegt.

---

## Arbeitsweise (wichtig)

Der Nutzer muss jede Zeile verstehen und später selbst warten können. Deshalb:

1. **Kleine Schritte.** Immer nur eine Schicht oder Funktion auf einmal. Keine großen Code-Würfe über viele Dateien.
2. **Nach jedem Schritt anhalten.** Kurz auf Deutsch erklären, was angelegt wurde, warum, und wie man es prüft (Befehl + erwartete Ausgabe). Dann auf Bestätigung warten.
3. **Einfach vor clever.** Keine unnötigen Abstraktionen, keine Bibliotheken außerhalb des festgelegten Stacks ohne Rückfrage.
4. **Erklärende Kommentare** im Code auf Deutsch, dort wo die Fachlogik nicht offensichtlich ist (vor allem in den Geschäftsregeln).
5. **Jede Geschäftsregel bekommt Tests**, bevor sie verwendet wird.
6. **Nichts löschen oder mit sudo verändern, ohne zu fragen.** Insbesondere den Altordner nie löschen.
7. **Fremde Prozesse nie beenden.** Prozesse, die Claude nicht selbst gestartet hat, werden nicht beendet, auch wenn sie einen benötigten Port belegen. Stattdessen den Nutzer fragen.

### Prüfbefehle

- Server, die für einen Prüfschritt im Hintergrund laufen, immer mit `< /dev/null` starten, sonst hält die Shell Vite an und der Port bleibt belegt. Am Ende mit `kill` beenden und prüfen, dass die Ports wieder frei sind (z. B. `ss -ltn | grep -E ':3001 |:5173 '` ohne Ausgabe).
- Für Tests im Browser stattdessen Befehle für zwei Terminals ohne `&` angeben, Backend zuerst. Beendet wird dann jeweils mit Strg+C.
- Immer vollständige Pfade verwenden, nie ein vorheriges `cd` voraussetzen.

---

## Festgelegter Stack

| Bereich | Wahl |
|---|---|
| Laufzeit | Node.js 24 LTS |
| Sprache | TypeScript 6.0 (nicht 7, vue-tsc braucht die JS-Schnittstelle) |
| Paketverwaltung | pnpm mit Workspaces |
| Backend | Fastify, Zod, Drizzle ORM mit mysql2 |
| Datenbank | MySQL 8.0 (nur gegen MySQL testen, nicht MariaDB) |
| Frontend | Vue 3, Vite, Vue Router, Pinia, TanStack Query |
| Komponenten | **Element Plus** mit deutscher Sprachdatei (`element-plus/es/locale/lang/de`) |
| Tests | Vitest (Regeln, Backend), Playwright (Ende-zu-Ende) |
| Logging | pino → journald |
| PDF | Headless Chromium über Playwright (erst ab Stufe 4/5) |
| Auslieferung | Apache als Reverse Proxy, Node lauscht nur auf 127.0.0.1:3000 |

**Kein PHP. Kein PrimeVue, kein `@primeuix`, keine PrimeUI-Pakete.** PrimeVue ab Version 5 ist lizenzpflichtig und hat im ersten Versuch eine Lizenzabfrage ausgelöst.

**Lizenzregel:** Erlaubt sind nur MIT, Apache-2.0, BSD-2/3-Clause, ISC, MPL-2.0 (MPL nur für Build-Werkzeuge). Nach **jeder** Paketinstallation `pnpm licenses list` ausführen und Abweichungen sofort melden. Keine Pakete mit „Community/Commercial“-Doppellizenz oder Lizenzschlüssel.

---

## Pfade und Repository

| Was | Wo |
|---|---|
| **Neues Projekt (hier wird gearbeitet)** | `/home/treaty-neu` |
| Altordner erster Versuch | `/home/ccode/treaty` – **nur lesen, nichts ändern, nichts löschen, nichts übernehmen** |
| GitHub-Repository | `git@github.com:FredrikFernholz/treaty-neu.git` (privat, Zugriff per SSH) |
| Dateiablage im Betrieb | `/var/lib/treaty/dateien` |

Die Konzeption nennt an einigen Stellen noch `/home/ccode/treaty` als Projektordner. Gemeint ist immer `/home/treaty-neu`.

MySQL-Namen des neuen Systems sind die Datenbanken `treaty_neu` und `treaty_neu_test` sowie die Benutzer `treaty_neu_app` (nur Daten) und `treaty_neu_migration` (Schema). Die Namen `treaty`, `treaty_test` und `treaty_app` gehören dem noch laufenden Altsystem und werden nicht angefasst. Wo die Konzeption `treaty_test` nennt, ist `treaty_neu_test` gemeint.

Die Symlinks unter `/var/www/treaty` und die bestehende systemd-Unit zeigen noch auf den Altordner. Sie werden **erst im Betriebsschritt** und nur nach Rückfrage auf `/home/treaty-neu` umgestellt.

### Git-Regeln

- Remote `origin` immer per SSH, nicht per HTTPS.
- Nach jedem abgeschlossenen und vom Nutzer bestätigten Teilschritt: Commit mit kurzer deutscher Nachricht, dann `git push`. Vorher kurz ankündigen.
- Niemals `.env`, Zugangsdaten, Schlüssel, `node_modules` oder `dist` committen. Vor jedem Commit `git status` prüfen.
- Kein `git push --force`, kein Umschreiben der Historie.

## Schritt 0: Sauberer Ausgangspunkt (erledigt)

`/home/treaty-neu` mit Git-Repository (Branch `main`), `.gitignore` (`node_modules`, `dist`, `.env`, `*.log`) und den drei Dokumenten unter `docs/` ist angelegt. Aus dem Altordner wurde kein Code übernommen.

---

## Schritt 1: Grundgerüst (eine Teilaufgabe nach der anderen)

Zielstruktur (Konzeption Abschnitt 5):

```
/home/treaty-neu/
├─ pnpm-workspace.yaml
├─ package.json
├─ docs/
├─ frontend/              Vue-Anwendung, Build nach frontend/dist
├─ backend/
│  ├─ src/
│  │  ├─ server.ts
│  │  ├─ modules/         ein Ordner je Fachmodul
│  │  ├─ worker/
│  │  ├─ shared/
│  │  │  ├─ regeln/       reine Funktionen, keine DB
│  │  │  ├─ schemas/      Zod-Schemas
│  │  │  └─ rechte/       Rechtematrix
│  │  └─ db/              Drizzle-Schema, Migrationen, Seeds
│  └─ migration/
└─ deploy/                apache, systemd, mysql
```

Reihenfolge, jeweils mit Prüfschritt:

1. **Workspace:** `pnpm-workspace.yaml`, Wurzel-`package.json`, gemeinsame `tsconfig.base.json` (strict).
2. **Backend minimal:** Fastify auf `127.0.0.1:3000`, nur Route `GET /api/health` → `{ status: "ok" }`. Start mit `tsx`. Prüfen per `curl`.
3. **Konfiguration:** `.env` (nicht im Repo) + `.env.example`. Werte mit Zod beim Start validieren. Keine Zugangsdaten im Code.
4. **Datenbank:** Drizzle mit mysql2, eigener App-Benutzer ohne Schemarechte, getrennter Migrationsbenutzer. Eine erste Tabelle `benutzer` als Migration. `/api/health` prüft zusätzlich die DB-Verbindung. Testdatenbank `treaty_neu_test` getrennt anlegen (`deploy/mysql/setup.sh`).
5. **Frontend minimal:** Vite + Vue 3 + TypeScript, Element Plus mit deutscher Locale, Vue Router, Pinia, TanStack Query. Eine Startseite ruft `/api/health` auf und zeigt das Ergebnis. Vite-Proxy `/api` → `http://127.0.0.1:3000`.
6. **Gemeinsamer Code:** Frontend bindet `backend/src/shared` per Pfad-Alias ein (nur lesen, keine Kopie). Mit einer Mini-Funktion nachweisen, dass beide Seiten sie nutzen.
7. **Lizenzprüfung** für Frontend und Backend, Ergebnis dem Nutzer zeigen.

---

## Schritt 2: Zentrale Geschäftsregeln (`backend/src/shared/regeln`)

Reine Funktionen ohne Datenbankzugriff, vollständig mit Vitest-Tabellentests abgedeckt (jede Tabellenzeile ein Testfall).

### Pflichtvorgaben für Geld und Datum

- **Geldbeträge niemals als JavaScript-`number` rechnen.** Entweder `decimal.js` oder Ganzzahl in Cent. Variante dem Nutzer kurz vorschlagen und bestätigen lassen, dann überall gleich verwenden. mysql2 liefert DECIMAL als String, das so lassen (`decimalNumbers` nicht aktivieren).
- Kaufmännische Rundung auf 2 Nachkommastellen je Teilsumme, mit Tests für Grenzfälle wie 1,005 und negative Beträge.
- Fachliche Datumswerte (WV-Datum, Frist, Eingang) als reine Kalenderdaten `YYYY-MM-DD`, ohne Uhrzeit.
- „Heute“ immer in der Zeitzone `Europe/Berlin` bestimmen.

### Regeln (Details in Konzeption Abschnitt 7)

- **Arbeitstage:** Mo–Fr, Feiertage spielen keine Rolle (Entscheidung 15.10.2026). Der optionale Feiertagsparameter bleibt, eine Feiertagsliste wird nicht eingebaut. Der Ausgangstag zählt nicht mit.
- **Nächster Donnerstag:** Ist das Datum ein Donnerstag, bleibt es; sonst folgender Donnerstag.
- **WV-Datum bei echtem Statuswechsel** (Arbeitstage nach dem Wechseltag, ggf. auf Donnerstag):

| Status | Arbeitstage | Donnerstag |
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
| 4. Erinnerung | 10 (Entscheidung 15.10.2026, nicht 15) | ja |
| abgeschlossen | kein WV-Datum | – |

- **Ampel eines Falls** (Arbeitstage seit letzter Statusänderung; abgeschlossen immer grün):

| Status | Grün bis | Gelb bis | danach |
|---|---|---|---|
| NEU | 5 | 10 | rot |
| in Bearbeitung, AW eingegangen MDT | 1 | 5 | rot |
| AW eingegangen VWT | 5 | 10 | rot |
| warte auf MDT / Verwalter / Dritten | 10 | 13 | rot |
| 1. Erinnerung | 20 | 23 | rot |
| 2.–4. Erinnerung | 10 | 13 | rot |

- **Neuanlage Fall:** WV-Datum = Anlagetag + 14 Kalendertage, Status NEU.
- **Ampel Aufgabe:** grün ab 6 Tagen bis Termin, gelb 0–5, rot wenn verstrichen.
- **Frist-Anzeige:** neutral bis 7 Tage vorher, dann blinkend, nach Ablauf rot. Frist entsteht nie automatisch.
- **Serien:** täglich / wöchentlich (Wochentag) / monatlich (Tag, begrenzt auf Monatslänge) / jährlich (29.02. → 28.02. in Nicht-Schaltjahren).
- **Zahlungsziel:** Rechnungsdatum beim Festschreiben + 30 Kalendertage, auf Donnerstag (ein Donnerstag bleibt, Entscheidung 16.10.2026).
- **Rechnungsberechnung:** Grundgebühr, Zeithonorar, Erfolgshonorar, Reisekosten mit Kappung; Gesamt = Summe der vier Posten (Konzeption 7, letzter Punkt).

---

## Danach: Ausbaustufen (Konzeption Abschnitt 17)

1. **Grundlagen:** Anmeldung (argon2id, min. 12 Zeichen, Sperre nach Fehlversuchen, serverseitige Sitzungen, Cookie HttpOnly/Secure/SameSite=Strict, Timeout 8 h Inaktivität / 12 h max.), Benutzerverwaltung, Rechtematrix mit additiven Zusatzrechten in `shared/rechte`, Prüfung an jeder Route (403). TOTP erst später, Feld `totp_secret` aber anlegen.
2. **Stammdaten:** Mandanten, Leistungskatalog, Zuordnung je Mandant, Standorte, PLZ-Liste, Hausverwaltungen, Kontakte, Kontaktdatenbank als VIEW.
3. **Betriebskosten und Aufgaben:** inkl. Check-Aufgabe in derselben Transaktion, Historie als Anfügetabelle, Kommentare + WebSocket `/ws`, Dateiablage. Der Prüfbogen wird vorerst nicht umgesetzt (Entscheidung 15.10.2026).
4. **Mieten und Schriftverkehr:** PDF-Briefe, E-Mail-Entwürfe (mailto, .eml mit `X-Unsent: 1`).
   - **Vertragsmanagement** folgt als eigene Ausbaustufe direkt nach Mieten (Entscheidung 15.10.2026). Die Nummern 5 bis 7 bleiben wie in Konzeption Abschnitt 17.
5. **Office:** Zeiterfassung mit Server-Timer, Rechnungen, Festschreiben mit lückenloser Nummer `RE-JAHR-NNNN`, ZUGFeRD EN 16931 (Chromium → Ghostscript PDF/A-3b → pdf-lib, Prüfung mit Mustang-Validator im Build), Storno, CSV (Semikolon, Dezimalkomma, UTF-8 mit BOM).
6. **Auswertungen:** fünf Tabs, Excel-/PDF-Export serverseitig, lange Exporte im Worker.
7. **Migration und Umstellung** (Altsystem nur lesend, in Node).

Jede Stufe endet mit grünen Tests und einer kurzen Zusammenfassung für den Nutzer.

Weitere Wünsche aus Entwicklerdoku und Geschäftsführungsvorgabe (Texterkennung, automatischer Widerspruch, Matching, Kunden-Upload, n8n/make) kommen erst nach dem Grundsystem (Entscheidung 15.10.2026).

---

## Technische Leitplanken

- Geld in DB als `DECIMAL(12,2)`, Zeitpunkte als `DATETIME(3)` in UTC.
- Jede änderbare Tabelle hat `version` (optimistisches Sperren, Konflikt → 409).
- Abgeleitete Werte als generierte Spalten (Ergebnis, Minuten, Gesamtbetrag).
- Fachlich wird kaum gelöscht: archivieren, abschließen, stornieren.
- Listen serverseitig filtern, sortieren, paginieren; abgeschlossene Einträge immer zuletzt (erstes Sortierkriterium in SQL).
- API unter `/api/v1`, REST.
- Langlaufendes (PDF, große Exporte, Erinnerungen, Virenprüfung) **nie** im API-Prozess, sondern im Worker über Tabelle `auftrag` mit `FOR UPDATE SKIP LOCKED`.
- Dateien unter `/var/lib/treaty/dateien` (Verzeichnis muss mit Eigentümer `treaty` angelegt werden, Befehl dem Nutzer vorschlagen), zufällige Schlüssel, SHA-256, Download nur über API mit Rechteprüfung, max. 50 MB.

### Betrieb (erst wenn das Grundgerüst läuft)

- systemd-Dienste `treaty-api` und `treaty-worker` unter Benutzer `treaty`.
- Solange der Code unter `/home/treaty-neu` liegt: **nicht** `ProtectHome=yes` setzen, sonst sieht der Dienst den Code nicht. `ProtectHome=read-only` verwenden und Leserechte für `treaty` sicherstellen.
- Apache-Konfiguration unter `deploy/apache/treaty.conf`: liefert `frontend/dist` aus, SPA-Fallback auf `index.html`, `/api` und `/ws` an 127.0.0.1:3000, `X-Forwarded-Proto`/`Host` setzen, `LimitRequestBody` 50 MB, `ProxyTimeout 300`.
- Nach jedem Frontend-Build prüfen, dass `dist` frisch erzeugt wurde (im ersten Versuch hat ein alter Build eine Lizenzabfrage ausgelöst).

---

## Offene Entscheidungen

Die 20 Punkte aus Konzeption Abschnitt 16 (u. a. Feiertage, GoBD-Storno, Umsatzsteuer, Schutz vor doppelter Abrechnung, Versandweg für Erinnerungen, Betriebsrat) **nicht selbst entscheiden**. Wenn eine Umsetzung davon abhängt: Punkt nennen, Empfehlung aus der Konzeption zitieren, Nutzer entscheiden lassen, Entscheidung in `docs/entscheidungen.md` mit Datum festhalten.

---

## Erster Auftrag

Lies die Dokumente in `docs/` und diese Datei. Fasse in wenigen Sätzen zusammen, was du verstanden hast. Mache weiter mit **Schritt 1** und halte nach jedem Teilschritt an.
