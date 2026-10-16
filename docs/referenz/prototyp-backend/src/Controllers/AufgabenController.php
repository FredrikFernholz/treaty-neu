<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Konstanten;
use Treaty\Rechte;
use Treaty\Response;
use DateTimeImmutable;
use PDO;

/**
 * Modul Aufgaben. Sichtbarkeit folgt sichtbareAufgaben() aus dem Prototyp (part3_core.js):
 * Administrator sieht alle, Sachbearbeiter/in nur die ihr/ihm selbst oder "ADH" (alle)
 * zugewiesenen. bk_id/mieten_id schließen sich gegenseitig aus (siehe chk_af_bk_xor_mieten im
 * Schema) - modul_name wird beim Anlegen passend dazu automatisch gesetzt.
 */
final class AufgabenController extends BaseController
{
    private const WRITABLE = [
        'fristDatum' => 'frist_datum', 'fristTitel' => 'frist_titel', 'wvDatum' => 'wv_datum',
        'mandantId' => 'mandant_id', 'modulStatus' => 'modul_status', 'standortNr' => 'standort_nr',
        'ort' => 'ort', 'aufgabenTyp' => 'aufgaben_typ', 'titel' => 'titel',
        'beschreibung' => 'beschreibung', 'zugewiesenAn' => 'zugewiesen_an', 'status' => 'status',
    ];

    public function index(array $args, array $body): void
    {
        $m = Auth::requireBereich('aufgaben');
        [$page, $pageSize, $offset] = $this->pagination();

        $where = ['1=1']; $params = [];
        $sichtbar = Rechte::aufgabenSichtbarkeitBedingung($m);
        if ($sichtbar !== null) {
            $where[] = 'zugewiesen_an IN (:za1, :za2)';
            $params['za1'] = $sichtbar[0]; $params['za2'] = $sichtbar[1];
        }
        if (!empty($_GET['status'])) { $where[] = 'status = :status'; $params['status'] = $_GET['status']; }
        if (!empty($_GET['zugewiesenAn'])) { $where[] = 'zugewiesen_an = :za'; $params['za'] = $_GET['zugewiesenAn']; }
        if (!empty($_GET['bkId'])) { $where[] = 'bk_id = :bkId'; $params['bkId'] = (int) $_GET['bkId']; }
        if (!empty($_GET['mietenId'])) { $where[] = 'mieten_id = :mietenId'; $params['mietenId'] = (int) $_GET['mietenId']; }
        $whereSql = implode(' AND ', $where);

        $pdo = $this->pdo();
        $countStmt = $pdo->prepare("SELECT COUNT(*) c FROM aufgaben WHERE $whereSql");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch()['c'];

        $stmt = $pdo->prepare("SELECT * FROM aufgaben WHERE $whereSql ORDER BY wv_datum ASC LIMIT :lim OFFSET :off");
        foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
        $stmt->bindValue('lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        Response::json([
            'data' => array_map([$this, 'toApi'], $stmt->fetchAll()),
            'page' => $page, 'pageSize' => $pageSize, 'total' => $total,
        ]);
    }

    public function show(array $args, array $body): void
    {
        Auth::requireBereich('aufgaben');
        Response::json(['data' => $this->toApi($this->findOrFail((int) $args['id']))]);
    }

    public function create(array $args, array $body): void
    {
        $m = Auth::requireBereich('aufgaben');
        $this->requireFields($body, ['aufgabenTyp', 'titel', 'zugewiesenAn']);
        if (!empty($body['bkId']) && !empty($body['mietenId'])) {
            Response::error('Eine Aufgabe kann nicht gleichzeitig einer NKA und einer Mietanpassungsprüfung zugeordnet werden.', 422);
        }
        $today = new DateTimeImmutable('today');
        $modulName = !empty($body['bkId']) ? 'BKA' : (!empty($body['mietenId']) ? 'Miete' : '-');

        $cols = ['wv_datum', 'ersteller', 'erstellt_am', 'modul_name', 'bk_id', 'mieten_id'];
        $vals = [':wv_datum', ':ersteller', ':erstellt_am', ':modul_name', ':bk_id', ':mieten_id'];
        $params = [
            'wv_datum' => $body['wvDatum'] ?? $today->format('Y-m-d'),
            'ersteller' => $m['k'],
            'erstellt_am' => $today->format('Y-m-d'),
            'modul_name' => $modulName,
            'bk_id' => $body['bkId'] ?? null,
            'mieten_id' => $body['mietenId'] ?? null,
        ];
        foreach (self::WRITABLE as $apiKey => $col) {
            // wvDatum/bkId/mietenId sind oben bereits in den Spalten, sonst "Column specified twice".
            if (in_array($apiKey, ['wvDatum', 'bkId', 'mietenId'], true) || !array_key_exists($apiKey, $body)) continue;
            $cols[] = $col; $vals[] = ":$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        $sql = 'INSERT INTO aufgaben (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ')';
        $this->pdo()->prepare($sql)->execute($params);
        $id = (int) $this->pdo()->lastInsertId();

        if (!empty($body['follower']) && is_array($body['follower'])) {
            $this->setFollower($id, $body['follower']);
        }
        Response::json(['data' => $this->toApi($this->findOrFail($id))], 201);
    }

    public function update(array $args, array $body): void
    {
        Auth::requireBereich('aufgaben');
        $row = $this->findOrFail((int) $args['id']);

        $sets = []; $params = ['id' => $row['id']];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        if ($sets) {
            $sql = 'UPDATE aufgaben SET ' . implode(', ', $sets) . ' WHERE id = :id';
            $this->pdo()->prepare($sql)->execute($params);
        }
        if (array_key_exists('follower', $body) && is_array($body['follower'])) {
            $this->setFollower((int) $row['id'], $body['follower']);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    public function delete(array $args, array $body): void
    {
        Auth::requireBereich('aufgaben');
        $row = $this->findOrFail((int) $args['id']);
        $this->pdo()->prepare('DELETE FROM aufgaben WHERE id = :id')->execute(['id' => $row['id']]);
        Response::noContent();
    }

    /** Unterpunkte (Subtasks) einer Aufgabe komplett ersetzen (einfachste konsistente Semantik). */
    public function setSubtasks(array $args, array $body): void
    {
        Auth::requireBereich('aufgaben');
        $row = $this->findOrFail((int) $args['id']);
        $pdo = $this->pdo();
        $pdo->prepare('DELETE FROM aufgaben_subtasks WHERE aufgabe_id = :id')->execute(['id' => $row['id']]);
        $ins = $pdo->prepare('INSERT INTO aufgaben_subtasks (aufgabe_id, titel, erledigt, position) VALUES (:aid, :titel, :erledigt, :pos)');
        foreach (($body['subtasks'] ?? []) as $i => $s) {
            $ins->execute(['aid' => $row['id'], 'titel' => $s['titel'], 'erledigt' => !empty($s['erledigt']) ? 1 : 0, 'pos' => $i]);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    private function setFollower(int $aufgabeId, array $kuerzelListe): void
    {
        $pdo = $this->pdo();
        $pdo->prepare('DELETE FROM aufgaben_follower WHERE aufgabe_id = :id')->execute(['id' => $aufgabeId]);
        $ins = $pdo->prepare('INSERT IGNORE INTO aufgaben_follower (aufgabe_id, mitarbeiter_kuerzel) VALUES (:id, :k)');
        foreach ($kuerzelListe as $k) {
            $ins->execute(['id' => $aufgabeId, 'k' => $k]);
        }
    }

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM aufgaben WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Aufgabe nicht gefunden.', 404);
        }
        return $row;
    }

    private function toApi(array $row): array
    {
        $pdo = $this->pdo();
        $fStmt = $pdo->prepare('SELECT mitarbeiter_kuerzel FROM aufgaben_follower WHERE aufgabe_id = :id');
        $fStmt->execute(['id' => $row['id']]);
        $follower = $fStmt->fetchAll(PDO::FETCH_COLUMN);

        $sStmt = $pdo->prepare('SELECT id, titel, erledigt, position FROM aufgaben_subtasks WHERE aufgabe_id = :id ORDER BY position ASC');
        $sStmt->execute(['id' => $row['id']]);
        $subtasks = array_map(fn($s) => [
            'id' => (int) $s['id'], 'titel' => $s['titel'], 'erledigt' => (bool) $s['erledigt'], 'position' => (int) $s['position'],
        ], $sStmt->fetchAll());

        return [
            'id' => (int) $row['id'],
            'fristDatum' => $row['frist_datum'],
            'fristTitel' => $row['frist_titel'],
            'wvDatum' => $row['wv_datum'],
            'mandantId' => $row['mandant_id'] !== null ? (int) $row['mandant_id'] : null,
            'modulName' => $row['modul_name'],
            'modulStatus' => $row['modul_status'],
            'standortNr' => $row['standort_nr'],
            'ort' => $row['ort'],
            'aufgabenTyp' => $row['aufgaben_typ'],
            'titel' => $row['titel'],
            'beschreibung' => $row['beschreibung'],
            'zugewiesenAn' => $row['zugewiesen_an'],
            'ersteller' => $row['ersteller'],
            'status' => $row['status'],
            'erstelltAm' => $row['erstellt_am'],
            'bkId' => $row['bk_id'] !== null ? (int) $row['bk_id'] : null,
            'mietenId' => $row['mieten_id'] !== null ? (int) $row['mieten_id'] : null,
            'follower' => $follower,
            'subtasks' => $subtasks,
        ];
    }
}
