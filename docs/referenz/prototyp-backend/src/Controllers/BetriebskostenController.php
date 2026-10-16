<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Geschaeftsregeln;
use Treaty\Response;
use DateTimeImmutable;
use PDO;

/**
 * Modul Betriebskosten. Statuswechsel lösen die WV-Datum-Neuberechnung nach Farbenlehre aus
 * (applyBkWvDatumFuerStatus() im Prototyp, part5_bk.js) und setzen "aenderung" auf heute - Basis
 * der Ampel (Geschaeftsregeln::ampel()). "Löschen" archiviert nur (kein echtes DELETE), passend zur
 * bestätigten Fachlogik ("Fall wird archiviert, nicht gelöscht").
 */
final class BetriebskostenController extends BaseController
{
    private const WRITABLE = [
        'wvDatum' => 'wv_datum', 'mandantId' => 'mandant_id', 'standortId' => 'standort_id',
        'ort' => 'ort', 'bkaJahr' => 'bka_jahr', 'bkaDatum' => 'bka_datum', 'nzDatum' => 'nz_datum',
        'abschlussDatum' => 'abschluss_datum', 'counterpartId' => 'counterpart_id',
        'ansprechpersonVwt' => 'ansprechperson_vwt', 'ansprechpersonVwtEmail' => 'ansprechperson_vwt_email',
        'adhKuerzel' => 'adh_kuerzel', 'bearbeiterMdt' => 'bearbeiter_mdt',
        'bearbeiterMdtEmail' => 'bearbeiter_mdt_email', 'caWerteFehler' => 'ca_werte_fehler',
        'draufleger' => 'draufleger', 'ersparnis' => 'ersparnis', 'gesamtkosten' => 'gesamtkosten',
        'vorauszahlungen' => 'vorauszahlungen', 'eingangDatum' => 'eingang_datum',
        'eigentuemer' => 'eigentuemer', 'eigentuemerAdresse' => 'eigentuemer_adresse',
        'eigentuemerInfo' => 'eigentuemer_info', 'markt' => 'markt', 'gruppiert' => 'gruppiert',
        'gruppierterWert' => 'gruppierter_wert', 'stromverbrauch' => 'stromverbrauch',
        'gasverbrauch' => 'gasverbrauch',
    ];

    public function index(array $args, array $body): void
    {
        Auth::requireBereich('betriebskosten');
        [$page, $pageSize, $offset] = $this->pagination();

        $where = ['archiviert = :archiviert'];
        $params = ['archiviert' => (int) (($_GET['archiviert'] ?? '0') === '1')];
        if (!empty($_GET['mandantId'])) { $where[] = 'mandant_id = :mandantId'; $params['mandantId'] = (int) $_GET['mandantId']; }
        if (!empty($_GET['status'])) { $where[] = 'status = :status'; $params['status'] = $_GET['status']; }
        if (!empty($_GET['bkaJahr'])) { $where[] = 'bka_jahr = :bkaJahr'; $params['bkaJahr'] = (int) $_GET['bkaJahr']; }
        $whereSql = implode(' AND ', $where);

        $pdo = $this->pdo();
        $countStmt = $pdo->prepare('SELECT COUNT(*) c FROM betriebskosten WHERE ' . $whereSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch()['c'];

        $stmt = $pdo->prepare("SELECT * FROM betriebskosten WHERE $whereSql ORDER BY wv_datum ASC LIMIT :lim OFFSET :off");
        foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
        $stmt->bindValue('lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = array_map([$this, 'toApi'], $stmt->fetchAll());

        Response::json(['data' => $rows, 'page' => $page, 'pageSize' => $pageSize, 'total' => $total]);
    }

    public function show(array $args, array $body): void
    {
        Auth::requireBereich('betriebskosten');
        $row = $this->findOrFail((int) $args['id']);
        Response::json(['data' => $this->toApi($row)]);
    }

    public function create(array $args, array $body): void
    {
        $m = Auth::requireBereich('betriebskosten');
        $this->requireFields($body, ['mandantId', 'ort', 'bkaJahr', 'status', 'gesamtkosten', 'vorauszahlungen']);

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
        $sql = 'INSERT INTO betriebskosten (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ')';
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        $id = (int) $this->pdo()->lastInsertId();
        Response::json(['data' => $this->toApi($this->findOrFail($id))], 201);
    }

    public function update(array $args, array $body): void
    {
        Auth::requireBereich('betriebskosten');
        $row = $this->findOrFail((int) $args['id']);
        $today = new DateTimeImmutable('today');

        $sets = []; $params = ['id' => $row['id']];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        // Statuswechsel: WV-Datum neu nach Farbenlehre, "aenderung" auf heute - nur bei TATSÄCHLICHEM
        // Wechsel (nicht bei jedem Speichern des Datenblatts), analog applyBkWvDatumFuerStatus().
        if (array_key_exists('status', $body) && $body['status'] !== $row['status']) {
            $neuerStatus = $body['status'];
            $sets[] = 'status = :status'; $params['status'] = $neuerStatus;
            $sets[] = 'aenderung = :aenderung'; $params['aenderung'] = $today->format('Y-m-d');
            if (!array_key_exists('wvDatum', $body)) {
                // wvDatumFuerStatus() liefert bei "abgeschlossen" bewusst null zurueck (eine
                // abgeschlossene NKA hat kein WV-Datum mehr) - das wird hier auch tatsaechlich so
                // gespeichert, nicht auf den alten Wert zurueckgefallen.
                $sets[] = 'wv_datum = :wv_datum_auto';
                $params['wv_datum_auto'] = Geschaeftsregeln::wvDatumFuerStatus($neuerStatus, $today);
                if ($neuerStatus === 'abgeschlossen' && !array_key_exists('abschlussDatum', $body)) {
                    $sets[] = 'abschluss_datum = :abschluss_datum_auto';
                    $params['abschluss_datum_auto'] = $today->format('Y-m-d');
                }
            }
        }
        if (!$sets) {
            Response::json(['data' => $this->toApi($row)]);
        }
        $sql = 'UPDATE betriebskosten SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $this->pdo()->prepare($sql)->execute($params);
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    /** Fachlich: NKA Löschen archiviert nur, siehe openNkaLoeschenConfirm() im Prototyp. */
    public function archive(array $args, array $body): void
    {
        Auth::requireBereich('betriebskosten');
        $row = $this->findOrFail((int) $args['id']);
        $this->pdo()->prepare('UPDATE betriebskosten SET archiviert = 1 WHERE id = :id')->execute(['id' => $row['id']]);
        Response::json(['ok' => true]);
    }

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM betriebskosten WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Betriebskosten-Fall nicht gefunden.', 404);
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
            'bkaJahr' => (int) $row['bka_jahr'],
            'bkaDatum' => $row['bka_datum'],
            'nzDatum' => $row['nz_datum'],
            'abschlussDatum' => $row['abschluss_datum'],
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
            'gesamtkosten' => (float) $row['gesamtkosten'],
            'vorauszahlungen' => (float) $row['vorauszahlungen'],
            'ergebnis' => (float) $row['ergebnis'],
            'eingangDatum' => $row['eingang_datum'],
            'aenderung' => $row['aenderung'],
            'eigentuemer' => $row['eigentuemer'],
            'eigentuemerAdresse' => $row['eigentuemer_adresse'],
            'eigentuemerInfo' => $row['eigentuemer_info'],
            'markt' => $row['markt'],
            'gruppiert' => (bool) $row['gruppiert'],
            'gruppierterWert' => (int) $row['gruppierter_wert'],
            'stromverbrauch' => $row['stromverbrauch'],
            'gasverbrauch' => $row['gasverbrauch'],
            'archiviert' => (bool) $row['archiviert'],
        ];
        $out['ampel'] = Geschaeftsregeln::ampel($row['status'], $row['aenderung']);
        return $out;
    }
}
