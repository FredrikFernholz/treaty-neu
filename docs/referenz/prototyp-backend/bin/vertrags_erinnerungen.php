<?php
declare(strict_types=1);

/**
 * Listet die Frist-Erinnerungen der Verträge, deren Zieltermin heute oder in den letzten N Tagen
 * lag (Standard 7), als JSON auf der Standardausgabe. Das Skript versendet nichts, es ist die
 * Grundlage für einen Cronjob, der daraus E-Mails oder Chat-Nachrichten erzeugt.
 *
 * Aufruf: php bin/vertrags_erinnerungen.php [Tage]
 * Beispiel Cron (täglich 7:00 Uhr): 0 7 * * * php /pfad/treaty-backend/bin/vertrags_erinnerungen.php 1
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

$tage = isset($argv[1]) ? max(0, (int) $argv[1]) : 7;
$liste = VertraegeController::faelligeErinnerungen(Database::pdo(), new DateTimeImmutable('today'), $tage);
echo json_encode($liste, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n";
