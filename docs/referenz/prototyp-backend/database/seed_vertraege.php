<?php
declare(strict_types=1);

/**
 * Seed-Skript für das Vertragsmanagement. Läuft nach database/seed.php (Mandanten, Standorte und
 * Hausverwaltungen müssen bereits vorhanden sein) und lädt die elf frei erfundenen Musterverträge
 * aus database/vertraege_mock.json, dieselben wie im Klick-Prototyp. Namensbasierte Referenzen
 * (Mandant, Standortnummer, (Unter-)Vermieter) werden in Fremdschlüssel aufgelöst.
 *
 * Aufruf: php database/seed_vertraege.php [Pfad zu vertraege_mock.json]
 * Ein erneuter Aufruf legt die Musterverträge nicht doppelt an, solange die Tabelle nicht leer ist.
 */

require __DIR__ . '/../config/config.php';
spl_autoload_register(function (string $class): void {
    $prefix = 'Treaty\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $path = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($path)) require $path;
});

use Treaty\Database;
use Treaty\Controllers\VertraegeController;

$jsonPath = $argv[1] ?? __DIR__ . '/vertraege_mock.json';
if (!is_file($jsonPath)) {
    fwrite(STDERR, "vertraege_mock.json nicht gefunden unter $jsonPath\n");
    exit(1);
}
$rows = json_decode(file_get_contents($jsonPath), true);
if (!is_array($rows)) {
    fwrite(STDERR, "vertraege_mock.json konnte nicht gelesen werden.\n");
    exit(1);
}

$pdo = Database::pdo();
if ((int) $pdo->query('SELECT COUNT(*) FROM vertraege')->fetchColumn() > 0) {
    echo "Tabelle vertraege ist nicht leer, es wird nichts eingefügt.\n";
    exit(0);
}

$mandanten = $pdo->query('SELECT name, id FROM mandanten')->fetchAll(PDO::FETCH_KEY_PAIR);
$standorte = $pdo->query('SELECT nr, id FROM standorte')->fetchAll(PDO::FETCH_KEY_PAIR);
$counterparts = $pdo->query('SELECT name, id FROM counterparts')->fetchAll(PDO::FETCH_KEY_PAIR);

$ctl = new VertraegeController();
$n = 0;
foreach ($rows as $r) {
    if (!isset($mandanten[$r['mdt']])) {
        fwrite(STDERR, "Mandant unbekannt, Zeile übersprungen: {$r['mdt']}\n");
        continue;
    }
    $r['mandantId'] = $mandanten[$r['mdt']];
    $r['standortId'] = $standorte[$r['standortNr']] ?? null;
    $r['counterpartId'] = $counterparts[$r['vermieter']] ?? null;
    unset($r['mdt'], $r['standortNr'], $r['vermieter']);
    $ctl->anlegen($r);
    $n++;
}
echo "$n Musterverträge angelegt.\n";
