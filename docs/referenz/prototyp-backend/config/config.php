<?php
declare(strict_types=1);

/**
 * Zentrale Konfiguration. In Produktion über Umgebungsvariablen überschreibbar,
 * damit Zugangsdaten nicht im Repository landen (siehe README.md).
 */
return [
    'db' => [
        'host' => getenv('TREATY_DB_HOST') ?: '127.0.0.1',
        'port' => getenv('TREATY_DB_PORT') ?: '3306',
        'name' => getenv('TREATY_DB_NAME') ?: 'treaty',
        'user' => getenv('TREATY_DB_USER') ?: 'treaty',
        'pass' => getenv('TREATY_DB_PASS') ?: 'treaty_dev_pw',
        'charset' => 'utf8mb4',
    ],
    // Session-Lebensdauer in Sekunden (8 Stunden Arbeitstag).
    'session_lifetime' => 8 * 3600,
    // CORS: Ursprung der separaten Frontend-Variante. In Produktion auf die tatsächliche
    // Domain einschränken statt "*".
    'cors_origin' => getenv('TREATY_CORS_ORIGIN') ?: '*',
];
