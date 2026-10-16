# Merkposten Treaty 2.0

Offene technische Punkte, die bewusst zurückgestellt sind. Sie sind keine Entscheidungen (dafür gibt es `entscheidungen.md`), sondern Erinnerungen, was später anzugehen ist. Erledigte Punkte werden mit Datum und Verweis auf den Commit als erledigt markiert, nicht gelöscht.

## Offen

### Sichtbarkeit der Aufgaben als Funktion in shared/rechte (seit 16.10.2026, Ausbaustufe 1)

Sachbearbeiter/innen sehen überall nur Aufgaben, die ihnen selbst oder „ADH“ (dem Team) zugewiesen sind oder bei denen sie Follower sind, Administratoren alle (Entscheidung 15.10.2026). Diese Regel kommt als eigene Funktion nach `backend/src/shared/rechte`, sobald A-02 (ein oder mehrere Follower je Aufgabe) geklärt ist, spätestens in Ausbaustufe 3. Durchgesetzt wird sie in den Datenbankabfragen des Aufgabenmoduls, nicht nur in der Oberfläche.

### Löschfrist des Sicherheitsprotokolls (seit 16.10.2026, Ausbaustufe 1)

Einträge im Sicherheitsprotokoll werden nach 90 Tagen gelöscht (Entscheidung 16.10.2026). Das Aufräumen übernimmt der Worker, sobald es ihn gibt, als regelmäßiger Auftrag. Bis dahin wächst die Tabelle ungebremst, was für den Testbetrieb unkritisch ist, vor dem Echtbetrieb aber erledigt sein muss.

### Prüfgebühr und Reisekosten-Kappung in den Stammdaten (seit 16.10.2026, Schritt 2)

Je Mandant darf höchstens eine Prüfgebühr-Position aktiv sein (Entscheidung 16.10.2026). In Ausbaustufe 2 prüft der Dienst beim Aktivieren einer Prüfgebühr-Position für einen Mandanten, dass keine andere aktiv ist, gegebenenfalls zusätzlich über eine Datenbankregel. Die Reisekosten-Kappung wird im Mandanten als optionales Feld geführt (NULL bedeutet keine Kappung), nicht wie im Prototyp als Pflichtfeld mit Vorgabewert 0. Die Rechnungsberechnung wirft bei mehreren Prüfgebühr-Positionen einen Fehler, die Stammdaten sollen das aber schon vorher verhindern.

### WV-Datum von Hand nur bei Betriebskosten auf Montag bis Freitag (seit 16.10.2026, Schritt 2)

Ein von Hand eingetragenes WV-Datum darf bei Betriebskosten nur auf Montag bis Freitag fallen, bei Mieten auch auf ein Wochenende (Entscheidung 16.10.2026). In Ausbaustufe 3 prüft das Backend diese Regel beim Speichern, und die Datumsauswahl im Frontend sperrt bei Betriebskosten Samstag und Sonntag. Die Prüfung allein im Frontend genügt nicht.

### Größe des Frontend-Bundles (seit 15.10.2026, Schritt 1.5)

Vite warnt beim Build, dass die JavaScript-Datei größer als 500kB ist (rund 1MB, gzip rund 340kB). Ursache ist, dass Element Plus vollständig eingebunden wird (`app.use(ElementPlus)` in `frontend/src/main.ts`). Für ein internes Werkzeug ist das derzeit unkritisch.

Mögliche Lösungen sind das Aufteilen nach Seiten mit `import()` im Router oder das gezielte Einbinden einzelner Element-Plus-Komponenten. Letzteres bräuchte zusätzliche Pakete (unplugin), was nach den Regeln in CLAUDE.md vorher abzustimmen wäre. Sinnvoll anzugehen, sobald mehrere Fachmodule als eigene Seiten bestehen.

### Zod im Frontend (seit 15.10.2026, Schritt 1.6)

Das Frontend nutzt Zod bisher nur indirekt über die gemeinsamen Schemas in `backend/src/shared`. Zod ist dort als Abhängigkeit des Backends eingetragen, nicht des Frontends, damit beide Seiten garantiert dieselbe Zod-Version verwenden. Die deutschen Fehlermeldungen (`z.config(z.locales.de())`) sind nur im Backend eingeschaltet (`backend/src/config.ts`).

Zu klären, sobald das Frontend Formulareingaben mit Zod prüft, ist zweierlei. Erstens, wo die deutsche Sprachdatei im Frontend eingeschaltet wird, etwa in `frontend/src/main.ts`. Zweitens, ob Zod dafür als eigene Abhängigkeit des Frontends eingetragen werden soll. Dabei ist zu beachten, dass `z.config` nur für die Zod-Kopie wirkt, über die es aufgerufen wird. Würden Frontend und `shared` verschiedene Kopien laden, griffe die Einstellung für die Schemas in `shared` nicht.
