# Merkposten Treaty 2.0

Offene technische Punkte, die bewusst zurückgestellt sind. Sie sind keine Entscheidungen (dafür gibt es `entscheidungen.md`), sondern Erinnerungen, was später anzugehen ist. Erledigte Punkte werden mit Datum und Verweis auf den Commit als erledigt markiert, nicht gelöscht.

## Offen

### Größe des Frontend-Bundles (seit 15.10.2026, Schritt 1.5)

Vite warnt beim Build, dass die JavaScript-Datei größer als 500kB ist (rund 1MB, gzip rund 340kB). Ursache ist, dass Element Plus vollständig eingebunden wird (`app.use(ElementPlus)` in `frontend/src/main.ts`). Für ein internes Werkzeug ist das derzeit unkritisch.

Mögliche Lösungen sind das Aufteilen nach Seiten mit `import()` im Router oder das gezielte Einbinden einzelner Element-Plus-Komponenten. Letzteres bräuchte zusätzliche Pakete (unplugin), was nach den Regeln in CLAUDE.md vorher abzustimmen wäre. Sinnvoll anzugehen, sobald mehrere Fachmodule als eigene Seiten bestehen.

### Zod im Frontend (seit 15.10.2026, Schritt 1.6)

Das Frontend nutzt Zod bisher nur indirekt über die gemeinsamen Schemas in `backend/src/shared`. Zod ist dort als Abhängigkeit des Backends eingetragen, nicht des Frontends, damit beide Seiten garantiert dieselbe Zod-Version verwenden. Die deutschen Fehlermeldungen (`z.config(z.locales.de())`) sind nur im Backend eingeschaltet (`backend/src/config.ts`).

Zu klären, sobald das Frontend Formulareingaben mit Zod prüft, ist zweierlei. Erstens, wo die deutsche Sprachdatei im Frontend eingeschaltet wird, etwa in `frontend/src/main.ts`. Zweitens, ob Zod dafür als eigene Abhängigkeit des Frontends eingetragen werden soll. Dabei ist zu beachten, dass `z.config` nur für die Zod-Kopie wirkt, über die es aufgerufen wird. Würden Frontend und `shared` verschiedene Kopien laden, griffe die Einstellung für die Schemas in `shared` nicht.
