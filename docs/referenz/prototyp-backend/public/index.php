<?php
declare(strict_types=1);

// Schlankes PHP ohne Framework/Composer: eigener, minimaler Autoloader statt
// vendor/autoload.php - Namensraum Treaty\ -> src/, Treaty\Controllers\ -> src/Controllers/.
spl_autoload_register(function (string $class): void {
    $prefix = 'Treaty\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/../src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

use Treaty\Auth;
use Treaty\Response;
use Treaty\Router;
use Treaty\Controllers\AuthController;
use Treaty\Controllers\BetriebskostenController;
use Treaty\Controllers\MietenController;
use Treaty\Controllers\VertraegeController;
use Treaty\Controllers\AufgabenController;
use Treaty\Controllers\VorlagenController;
use Treaty\Controllers\KundenController;
use Treaty\Controllers\LeistungskatalogController;
use Treaty\Controllers\ZeiterfassungController;
use Treaty\Controllers\RechnungenController;
use Treaty\Controllers\NutzerController;
use Treaty\Controllers\StandorteController;
use Treaty\Controllers\CounterpartsController;
use Treaty\Controllers\AuswertungenController;

$cfg = require __DIR__ . '/../config/config.php';

// CORS: die separate Frontend-Variante läuft auf einer anderen Origin als dieses Backend (siehe
// README.md, Abschnitt zur Artifact-Sandboxing-Einschränkung).
header('Access-Control-Allow-Origin: ' . $cfg['cors_origin']);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

Auth::start();

set_exception_handler(function (\Throwable $e): void {
    error_log($e->getMessage() . "\n" . $e->getTraceAsString());
    Response::error('Interner Serverfehler.', 500);
});

$router = new Router();

// Auth
$router->post('/auth/login', [AuthController::class, 'login']);
$router->post('/auth/logout', [AuthController::class, 'logout']);
$router->get('/auth/me', [AuthController::class, 'me']);

// Betriebskosten
$router->get('/betriebskosten', [BetriebskostenController::class, 'index']);
$router->get('/betriebskosten/{id}', [BetriebskostenController::class, 'show']);
$router->post('/betriebskosten', [BetriebskostenController::class, 'create']);
$router->put('/betriebskosten/{id}', [BetriebskostenController::class, 'update']);
$router->delete('/betriebskosten/{id}', [BetriebskostenController::class, 'archive']);

// Mieten
$router->get('/mieten', [MietenController::class, 'index']);
$router->get('/mieten/{id}', [MietenController::class, 'show']);
$router->post('/mieten', [MietenController::class, 'create']);
$router->put('/mieten/{id}', [MietenController::class, 'update']);
$router->delete('/mieten/{id}', [MietenController::class, 'archive']);

// Vertragsmanagement (die feste Route "erinnerungen-faellig" muss vor "{id}" stehen)
$router->get('/vertraege/erinnerungen-faellig', [VertraegeController::class, 'erinnerungenFaellig']);
$router->get('/vertraege', [VertraegeController::class, 'index']);
$router->get('/vertraege/{id}', [VertraegeController::class, 'show']);
$router->post('/vertraege', [VertraegeController::class, 'create']);
$router->put('/vertraege/{id}', [VertraegeController::class, 'update']);
$router->put('/vertraege/{id}/notizen', [VertraegeController::class, 'setNotizen']);
$router->delete('/vertraege/{id}', [VertraegeController::class, 'archive']);

// Aufgaben
$router->get('/aufgaben', [AufgabenController::class, 'index']);
$router->get('/aufgaben/{id}', [AufgabenController::class, 'show']);
$router->post('/aufgaben', [AufgabenController::class, 'create']);
$router->put('/aufgaben/{id}', [AufgabenController::class, 'update']);
$router->delete('/aufgaben/{id}', [AufgabenController::class, 'delete']);
$router->put('/aufgaben/{id}/subtasks', [AufgabenController::class, 'setSubtasks']);

// Aufgaben-Vorlagen
$router->get('/vorlagen', [VorlagenController::class, 'index']);
$router->post('/vorlagen', [VorlagenController::class, 'create']);
$router->put('/vorlagen/{id}', [VorlagenController::class, 'update']);
$router->delete('/vorlagen/{id}', [VorlagenController::class, 'delete']);

// Kunden (Mandanten)
$router->get('/kunden', [KundenController::class, 'index']);
$router->get('/kunden/{id}', [KundenController::class, 'show']);
$router->post('/kunden', [KundenController::class, 'create']);
$router->put('/kunden/{id}', [KundenController::class, 'update']);
$router->post('/kunden/{id}/kontakte', [KundenController::class, 'addKontakt']);
$router->delete('/kunden/{id}/kontakte/{kontaktId}', [KundenController::class, 'deleteKontakt']);
$router->put('/kunden/{id}/leistungen', [KundenController::class, 'setLeistungen']);

// Leistungskatalog
$router->get('/leistungskatalog', [LeistungskatalogController::class, 'index']);
$router->post('/leistungskatalog', [LeistungskatalogController::class, 'create']);
$router->put('/leistungskatalog/{id}', [LeistungskatalogController::class, 'update']);

// Zeiterfassung
$router->get('/zeitbuchungen', [ZeiterfassungController::class, 'index']);
$router->post('/zeitbuchungen', [ZeiterfassungController::class, 'create']);
$router->put('/zeitbuchungen/{id}', [ZeiterfassungController::class, 'update']);
$router->delete('/zeitbuchungen/{id}', [ZeiterfassungController::class, 'delete']);

// Rechnungen
$router->get('/rechnungen', [RechnungenController::class, 'index']);
$router->get('/rechnungen/{id}', [RechnungenController::class, 'show']);
$router->post('/rechnungen/basis', [RechnungenController::class, 'basis']);
$router->post('/rechnungen', [RechnungenController::class, 'create']);
$router->put('/rechnungen/{id}', [RechnungenController::class, 'update']);

// Nutzerverwaltung
$router->get('/mitarbeiter', [NutzerController::class, 'index']);
$router->get('/mitarbeiter/{id}', [NutzerController::class, 'show']);
$router->post('/mitarbeiter', [NutzerController::class, 'create']);
$router->put('/mitarbeiter/{id}', [NutzerController::class, 'update']);
$router->put('/mitarbeiter/{id}/zusatzrechte', [NutzerController::class, 'setZusatzrechte']);
$router->get('/rechtematrix', [NutzerController::class, 'rechtematrix']);

// Standorte / Kontaktdatenbank
$router->get('/standorte', [StandorteController::class, 'index']);
$router->post('/standorte', [StandorteController::class, 'create']);
$router->put('/standorte/{id}', [StandorteController::class, 'update']);
$router->get('/counterparts', [CounterpartsController::class, 'index']);
$router->post('/counterparts', [CounterpartsController::class, 'create']);
$router->post('/counterparts/{id}/kontakte', [CounterpartsController::class, 'addKontakt']);

// Auswertungen
$router->get('/auswertungen/fallstatistiken', [AuswertungenController::class, 'fallstatistiken']);
$router->get('/auswertungen/finanzkennzahlen', [AuswertungenController::class, 'finanzkennzahlen']);
$router->get('/auswertungen/auslastung', [AuswertungenController::class, 'auslastung']);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
// Führendes Skript-Verzeichnis (z. B. bei Aufruf über /treaty-backend/public/index.php) abschneiden,
// damit derselbe Router unabhängig vom Dokument-Root-Pfad funktioniert.
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
if ($scriptDir !== '/' && str_starts_with($path, $scriptDir)) {
    $path = substr($path, strlen($scriptDir));
}
$router->dispatch($_SERVER['REQUEST_METHOD'], $path);
