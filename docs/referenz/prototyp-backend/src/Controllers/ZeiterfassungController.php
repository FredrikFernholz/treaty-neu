<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Rechte;
use Treaty\Response;
use PDO;

/**
 * Office - Zeiterfassung. Für jede Berechtigungsstufe zugänglich, zeigt einer Sachbearbeiter/in
 * ohne das Zusatzrecht "zeiterfassung_alle" aber nur die eigenen Zeitbuchungen (siehe
 * zeiterfassungNurEigene() im Prototyp, part3_core.js) - gilt für Liste wie Einzelzugriff, damit
 * sich nicht über eine bekannte ID eine fremde Zeitbuchung einsehen/ändern lässt.
 */
final class ZeiterfassungController extends BaseController
{
    private const WRITABLE = [
        'datum' => 'datum', 'mandantId' => 'mandant_id', 'aufgabeId' => 'aufgabe_id',
        'aufgabenTyp' => 'aufgaben_typ', 'beschreibung' => 'beschreibung',
        'startZeit' => 'start_zeit', 'endeZeit' => 'ende_zeit', 'minuten' => 'minuten',
        'abrechenbar' => 'abrechenbar', 'quelle' => 'quelle',
    ];

    public function index(array $args, array $body): void
    {
        $m = Auth::requireBereich('zeiterfassung');
        [$page, $pageSize, $offset] = $this->pagination();

        $where = ['1=1']; $params = [];
        if (Rechte::zeiterfassungNurEigene($m)) {
            $where[] = 'mitarbeiter_kuerzel = :mk';
            $params['mk'] = $m['k'];
        } elseif (!empty($_GET['mitarbeiterKuerzel'])) {
            $where[] = 'mitarbeiter_kuerzel = :mk';
            $params['mk'] = $_GET['mitarbeiterKuerzel'];
        }
        if (!empty($_GET['von'])) { $where[] = 'datum >= :von'; $params['von'] = $_GET['von']; }
        if (!empty($_GET['bis'])) { $where[] = 'datum <= :bis'; $params['bis'] = $_GET['bis']; }
        if (!empty($_GET['mandantId'])) { $where[] = 'mandant_id = :mid'; $params['mid'] = (int) $_GET['mandantId']; }
        $whereSql = implode(' AND ', $where);

        $pdo = $this->pdo();
        $countStmt = $pdo->prepare("SELECT COUNT(*) c FROM zeitbuchungen WHERE $whereSql");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch()['c'];

        $stmt = $pdo->prepare("SELECT * FROM zeitbuchungen WHERE $whereSql ORDER BY datum DESC LIMIT :lim OFFSET :off");
        foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
        $stmt->bindValue('lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        Response::json([
            'data' => array_map([$this, 'toApi'], $stmt->fetchAll()),
            'page' => $page, 'pageSize' => $pageSize, 'total' => $total,
        ]);
    }

    public function create(array $args, array $body): void
    {
        $m = Auth::requireBereich('zeiterfassung');
        $this->requireFields($body, ['datum', 'aufgabenTyp', 'startZeit', 'endeZeit', 'minuten']);
        // Eine Sachbearbeiter/in ohne Zusatzrecht kann nur für sich selbst buchen, nicht über einen
        // fremden Mitarbeiter-Parameter umbuchen (siehe Klassendoku oben).
        $mitarbeiterKuerzel = Rechte::zeiterfassungNurEigene($m) ? $m['k'] : ($body['mitarbeiterKuerzel'] ?? $m['k']);

        $cols = ['mitarbeiter_kuerzel']; $vals = [':mitarbeiter_kuerzel']; $params = ['mitarbeiter_kuerzel' => $mitarbeiterKuerzel];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $cols[] = $col; $vals[] = ":$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        $sql = 'INSERT INTO zeitbuchungen (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ')';
        $this->pdo()->prepare($sql)->execute($params);
        $id = (int) $this->pdo()->lastInsertId();
        Response::json(['data' => $this->toApi($this->findOrFail($id, $m))], 201);
    }

    public function update(array $args, array $body): void
    {
        $m = Auth::requireBereich('zeiterfassung');
        $row = $this->findOrFail((int) $args['id'], $m);
        $sets = []; $params = ['id' => $row['id']];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        if ($sets) {
            $this->pdo()->prepare('UPDATE zeitbuchungen SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id'], $m))]);
    }

    public function delete(array $args, array $body): void
    {
        $m = Auth::requireBereich('zeiterfassung');
        $row = $this->findOrFail((int) $args['id'], $m);
        $this->pdo()->prepare('DELETE FROM zeitbuchungen WHERE id = :id')->execute(['id' => $row['id']]);
        Response::noContent();
    }

    private function findOrFail(int $id, array $m): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM zeitbuchungen WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Zeitbuchung nicht gefunden.', 404);
        }
        if (Rechte::zeiterfassungNurEigene($m) && $row['mitarbeiter_kuerzel'] !== $m['k']) {
            Response::error('Kein Zugriff auf diese Zeitbuchung.', 403);
        }
        return $row;
    }

    private function toApi(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'datum' => $row['datum'],
            'mitarbeiterKuerzel' => $row['mitarbeiter_kuerzel'],
            'mandantId' => $row['mandant_id'] !== null ? (int) $row['mandant_id'] : null,
            'aufgabeId' => $row['aufgabe_id'] !== null ? (int) $row['aufgabe_id'] : null,
            'aufgabenTyp' => $row['aufgaben_typ'],
            'beschreibung' => $row['beschreibung'],
            'startZeit' => $row['start_zeit'],
            'endeZeit' => $row['ende_zeit'],
            'minuten' => (int) $row['minuten'],
            'abrechenbar' => (bool) $row['abrechenbar'],
            'quelle' => $row['quelle'],
        ];
    }
}
