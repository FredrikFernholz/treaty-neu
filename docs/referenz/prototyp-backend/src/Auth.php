<?php
declare(strict_types=1);

namespace Treaty;

use PDO;

/**
 * Session-basierte Anmeldung. Der Prototyp (mockdata.py) kennt keine echten Passwörter - für dieses
 * Backend werden alle Mitarbeiter-Konten daher mit dem Seed-Skript (database/seed.php) und einem
 * dokumentierten Demo-Passwort angelegt (siehe README.md). Ein Administrator kann Passwörter über
 * die Nutzerverwaltung (Zusatzrechte sind hiervon unberührt) später ändern.
 */
final class Auth
{
    public static function start(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            $cfg = require __DIR__ . '/../config/config.php';
            session_set_cookie_params([
                'lifetime' => $cfg['session_lifetime'],
                'path' => '/',
                'samesite' => 'Lax',
            ]);
            session_start();
        }
    }

    public static function login(string $emailOrKuerzel, string $password): ?array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT * FROM mitarbeiter WHERE (email = :e OR kuerzel = :k) AND aktiv = 1 LIMIT 1'
        );
        $stmt->execute(['e' => $emailOrKuerzel, 'k' => strtoupper($emailOrKuerzel)]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            return null;
        }
        $_SESSION['mitarbeiter_id'] = (int) $row['id'];
        return self::toApi($row);
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }

    /** Aktuell angemeldeter Mitarbeiter inkl. Zusatzrechte, oder null wenn nicht angemeldet. */
    public static function current(): ?array
    {
        if (empty($_SESSION['mitarbeiter_id'])) {
            return null;
        }
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT * FROM mitarbeiter WHERE id = :id AND aktiv = 1 LIMIT 1');
        $stmt->execute(['id' => $_SESSION['mitarbeiter_id']]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        return self::toApi($row);
    }

    public static function requireAuth(): array
    {
        $m = self::current();
        if ($m === null) {
            Response::error('Nicht angemeldet.', 401);
        }
        return $m;
    }

    /** Bricht mit 403 ab, wenn der aktuelle Mitarbeiter keinen Zugriff auf $bereichKey hat. */
    public static function requireBereich(string $bereichKey): array
    {
        $m = self::requireAuth();
        if (!Rechte::hatZugriffMitarbeiter($bereichKey, $m)) {
            Response::error('Kein Zugriff auf diesen Bereich.', 403);
        }
        return $m;
    }

    private static function toApi(array $row): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT bereich_key FROM mitarbeiter_zusatzrechte WHERE mitarbeiter_id = :id');
        $stmt->execute(['id' => $row['id']]);
        $zusatzrechte = $stmt->fetchAll(PDO::FETCH_COLUMN);

        return [
            'id' => (int) $row['id'],
            'k' => $row['kuerzel'],
            'name' => $row['name'],
            'email' => $row['email'],
            'berechtigung' => $row['berechtigung'],
            'zeichnung' => $row['zeichnung'],
            'bezeichnung' => $row['bezeichnung'],
            'aktiv' => (bool) $row['aktiv'],
            'zusatzrechte' => $zusatzrechte,
        ];
    }
}
