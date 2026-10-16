<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Database;
use PDO;

abstract class BaseController
{
    protected function pdo(): PDO
    {
        return Database::pdo();
    }

    /** Liest page/pageSize aus Query-String, mit sinnvollen Grenzen. */
    protected function pagination(): array
    {
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $pageSize = (int) ($_GET['pageSize'] ?? 25);
        $pageSize = max(1, min(200, $pageSize));
        return [$page, $pageSize, ($page - 1) * $pageSize];
    }

    /**
     * Wert für die Übergabe an PDO aufbereiten. PDO (MySQL, emulierte Prepares) wandelt false in
     * einen leeren String um, was bei TINYINT-Spalten zu "Incorrect integer value ''" führt, daher
     * werden Booleans explizit als 0/1 übergeben. Leere Datumsfelder aus Formularen werden zu NULL.
     */
    protected function dbValue(string $apiKey, mixed $v): mixed
    {
        if (is_bool($v)) {
            return $v ? 1 : 0;
        }
        if ($v === '' && str_ends_with($apiKey, 'Datum')) {
            return null;
        }
        return $v;
    }

    protected function requireFields(array $body, array $fields): void
    {
        $missing = [];
        foreach ($fields as $f) {
            if (!array_key_exists($f, $body) || $body[$f] === '' || $body[$f] === null) {
                $missing[] = $f;
            }
        }
        if ($missing) {
            \Treaty\Response::error('Pflichtfelder fehlen: ' . implode(', ', $missing), 422);
        }
    }
}
