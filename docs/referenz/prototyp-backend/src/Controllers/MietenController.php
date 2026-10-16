<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Geschaeftsregeln;
use Treaty\Response;
use DateTimeImmutable;
use PDO;

/**
 * Modul Mieten (Mietanpassungsprüfung). Nutzt dieselbe WV-Datum-/Farbenlehre-Regel wie
 * Betriebskosten (computeBkWvDatum() im Prototyp wird laut Quellcode-Kommentar "trotz des
 * Bk-Namens" von beiden Modulen genutzt, siehe Geschaeftsregeln.php).
 */
final class MietenController extends BaseController
{
    private const WRITABLE = [
        'wvDatum' => 'wv_datum', 'mandantId' => 'mandant_id', 'standortId' => 'standort_id',
        'ort' => 'ort', 'dmrAb' => 'dmr_ab', 'counterpartId' => 'counterpart_id',
        'ansprechpersonVwt' => 'ansprechperson_vwt', 'ansprechpersonVwtEmail' => 'ansprechperson_vwt_email',
        'adhKuerzel' => 'adh_kuerzel', 'bearbeiterMdt' => 'bearbeiter_mdt',
        'bearbeiterMdtEmail' => 'bearbeiter_mdt_email', 'caWerteFehler' => 'ca_werte_fehler',
        'draufleger' => 'draufleger', 'ersparnis' => 'ersparnis', 'eingangDatum' => 'eingang_datum',
        'abschlussDatum' => 'abschluss_datum', 'eigentuemer' => 'eigentuemer',
        'eigentuemerAdresse' => 'eigentuemer_adresse', 'eigentuemerInfo' => 'eigentuemer_info',
    ];

    public function index(array $args, array $body): void
    {
        Auth::requireBereich('mieten');
        [$page, $pageSize, $offset] = $this->pagination();

        $where = ['archiviert = :archiviert'];
        $params = ['archiviert' => (int) (($_GET['archiviert'] ?? '0') === '1')];
        if (!empty($_GET['mandantId'])) { $where[] = 'mandant_id = :mandantId'; $params['mandantId'] = (int) $_GET['mandantId']; }
        if (!empty($_GET['status'])) { $where[] = 'status = :status'; $params['status'] = $_GET['status']; }
        $whereSql = implode(' AND ', $where);

        $pdo = $this->pdo();
        $countStmt = $pdo->prepare('SELECT COUNT(*) c FROM mieten WHERE ' . $whereSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch()['c'];

        $stmt = $pdo->prepare("SELECT * FROM mieten WHERE $whereSql ORDER BY wv_datum ASC LIMIT :lim OFFSET :off");
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
        Auth::requireBereich('mieten');
        Response::json(['data' => $this->toApi($this->findOrFail((int) $args['id']))]);
    }

    public function create(array $args, array $body): void
    {
        $m = Auth::requireBereich('mieten');
        $this->requireFields($body, ['mandantId', 'ort', 'dmrAb', 'status']);

        $status = $body['status'];
        $today = new DateTimeImmutable('today');
        $wvDatum = $body['wvDatum'] ?? Geschaeftsregeln::wvDatumFuerStatus($status, $today);

        $cols = ['status', 'aenderung', 'wv_datum', 'adh_kuerzel'];
        $vals = [':status', ':aenderung', ':wv_datum', ':adh_kuerzel'];
        $params = [
            'status' => $status,
            'aenderung' => $today->format('Y-m-d'),
            'wv_datum' => $wvDatum,
            'adh_kuerzel' => $body['adhKuerzel'] ?? $m['k'],
        ];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (in_array($apiKey, ['adhKuerzel', 'wvDatum'], true) || !array_key_exists($apiKey, $body)) continue;
            $cols[] = $col; $vals[] = ":$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        $sql = 'INSERT INTO mieten (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ')';
        $this->pdo()->prepare($sql)->execute($params);
        $id = (int) $this->pdo()->lastInsertId();
        Response::json(['data' => $this->toApi($this->findOrFail($id))], 201);
    }

    public function update(array $args, array $body): void
    {
        Auth::requireBereich('mieten');
        $row = $this->findOrFail((int) $args['id']);
        $today = new DateTimeImmutable('today');

        $sets = []; $params = ['id' => $row['id']];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        if (array_key_exists('status', $body) && $body['status'] !== $row['status']) {
            $neuerStatus = $body['status'];
            $sets[] = 'status = :status'; $params['status'] = $neuerStatus;
            $sets[] = 'aenderung = :aenderung'; $params['aenderung'] = $today->format('Y-m-d');
            if (!array_key_exists('wvDatum', $body)) {
                // Siehe BetriebskostenController::update() - "abgeschlossen" liefert bewusst null
                // (kein WV-Datum mehr) und wird auch tatsaechlich so gespeichert.
                $sets[] = 'wv_datum = :wv_datum_auto';
                $params['wv_datum_auto'] = Geschaeftsregeln::wvDatumFuerStatus($neuerStatus, $today);
                if ($neuerStatus === 'abgeschlossen' && !array_key_exists('abschlussDatum', $body)) {
                    $sets[] = 'abschluss_datum = :abschluss_datum_auto';
                    $params['abschluss_datum_auto'] = $today->format('Y-m-d');
                }
            }
        }
        if ($sets) {
            $sql = 'UPDATE mieten SET ' . implode(', ', $sets) . ' WHERE id = :id';
            $this->pdo()->prepare($sql)->execute($params);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    public function archive(array $args, array $body): void
    {
        Auth::requireBereich('mieten');
        $row = $this->findOrFail((int) $args['id']);
        $this->pdo()->prepare('UPDATE mieten SET archiviert = 1 WHERE id = :id')->execute(['id' => $row['id']]);
        Response::json(['ok' => true]);
    }

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM mieten WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Mieten-Fall nicht gefunden.', 404);
        }
        return $row;
    }

    private function toApi(array $row): array
    {
        $out = [
            'id' => (int) $row['id'],
            'wvDatum' => $row['wv_datum'],
            'mandantId' => (int) $row['mandant_id'],
            'standortId' => $row['standort_id'] !== null ? (int) $row['standort_id'] : null,
            'ort' => $row['ort'],
            'dmrAb' => $row['dmr_ab'],
            'status' => $row['status'],
            'counterpartId' => $row['counterpart_id'] !== null ? (int) $row['counterpart_id'] : null,
            'ansprechpersonVwt' => $row['ansprechperson_vwt'],
            'ansprechpersonVwtEmail' => $row['ansprechperson_vwt_email'],
            'adhKuerzel' => $row['adh_kuerzel'],
            'bearbeiterMdt' => $row['bearbeiter_mdt'],
            'bearbeiterMdtEmail' => $row['bearbeiter_mdt_email'],
            'caWerteFehler' => (float) $row['ca_werte_fehler'],
            'draufleger' => (float) $row['draufleger'],
            'ersparnis' => (float) $row['ersparnis'],
            'eingangDatum' => $row['eingang_datum'],
            'abschlussDatum' => $row['abschluss_datum'],
            'aenderung' => $row['aenderung'],
            'eigentuemer' => $row['eigentuemer'],
            'eigentuemerAdresse' => $row['eigentuemer_adresse'],
            'eigentuemerInfo' => $row['eigentuemer_info'],
            'archiviert' => (bool) $row['archiviert'],
        ];
        $out['ampel'] = Geschaeftsregeln::ampel($row['status'], $row['aenderung']);
        return $out;
    }
}
