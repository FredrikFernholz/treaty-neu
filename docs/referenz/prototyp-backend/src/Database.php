<?php
declare(strict_types=1);

namespace Treaty;

use PDO;
use PDOException;

/**
 * PDO-Singleton. Schlankes PHP ohne Framework, siehe README.md für die Begründung
 * dieser Architekturentscheidung.
 */
final class Database
{
    private static ?PDO $instance = null;

    public static function pdo(): PDO
    {
        if (self::$instance === null) {
            $cfg = require __DIR__ . '/../config/config.php';
            $db = $cfg['db'];
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                $db['host'],
                $db['port'],
                $db['name'],
                $db['charset']
            );
            try {
                self::$instance = new PDO($dsn, $db['user'], $db['pass'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $e) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['error' => 'Datenbankverbindung fehlgeschlagen.']);
                exit;
            }
        }
        return self::$instance;
    }
}
