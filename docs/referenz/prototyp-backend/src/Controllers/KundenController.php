<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Rechte;
use Treaty\Response;
use PDO;

/**
 * Kundenverwaltung (Mandanten) inkl. Kontakte und individuell zugeordnetem Leistungskatalog
 * (mandant_leistungen). Die eigentliche Verwaltung (Anlegen/Ändern von Vertrags-/Preisdaten) ist
 * nur für Administrator bzw. per Zusatzrecht "kunden" zugänglich (siehe RECHTEMATRIX).
 *
 * index()/show() sind bewusst für JEDEN angemeldeten Mitarbeiter erreichbar: im Prototyp sind
 * Mandantenname, -kürzel, Kontakte (für "Bearbeiter bei MDT") und die je Mandant aktiven
 * Aufgabentypen (für aufgabenTypenFuerMdt(), part3_core.js) globale Referenzdaten, die jede
 * Berechtigungsstufe beim Anlegen von Aufgaben/Betriebskosten/Mieten braucht - nur die
 * eigentlichen Vertrags-/Preisdaten (reisekostenKappung, vertragStatus, Leistungspreise) sind
 * fachlich sensibel. Ohne "kunden"-Zugriff liefert dieser Endpunkt daher eine reduzierte Sicht
 * ohne diese Felder; mit Zugriff den vollständigen Datensatz wie bisher.
 */
final class KundenController extends BaseController
{
    private const WRITABLE = [
        'name' => 'name', 'kuerzel' => 'kuerzel', 'adresse' => 'adresse',
        'ansprechpartner' => 'ansprechpartner', 'email' => 'email', 'telefon' => 'telefon',
        'kundeSeit' => 'kunde_seit', 'vertragBeginn' => 'vertrag_beginn',
        'vertragLaufzeit' => 'vertrag_laufzeit', 'vertragKuendigungsfrist' => 'vertrag_kuendigungsfrist',
        'vertragStatus' => 'vertrag_status', 'reisekostenKappung' => 'reisekosten_kappung',
    ];

    public function index(array $args, array $body): void
    {
        $m = Auth::requireAuth();
        $voll = Rechte::hatZugriffMitarbeiter('kunden', $m);
        $stmt = $this->pdo()->query('SELECT * FROM mandanten ORDER BY name ASC');
        $rows = $stmt->fetchAll();
        Response::json(['data' => array_map($voll ? [$this, 'toApi'] : [$this, 'toApiTrimmed'], $rows)]);
    }

    public function show(array $args, array $body): void
    {
        $m = Auth::requireAuth();
        $row = $this->findOrFail((int) $args['id']);
        $voll = Rechte::hatZugriffMitarbeiter('kunden', $m);
        Response::json(['data' => $voll ? $this->toApi($row) : $this->toApiTrimmed($row)]);
    }

    public function create(array $args, array $body): void
    {
        Auth::requireBereich('kunden');
        $this->requireFields($body, ['name']);
        $cols = []; $vals = []; $params = [];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $cols[] = $col; $vals[] = ":$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        $sql = 'INSERT INTO mandanten (' . implode(',', $cols) . ') VALUES (' . implode(',', $vals) . ')';
        $this->pdo()->prepare($sql)->execute($params);
        $id = (int) $this->pdo()->lastInsertId();
        Response::json(['data' => $this->toApi($this->findOrFail($id))], 201);
    }

    public function update(array $args, array $body): void
    {
        Auth::requireBereich('kunden');
        $row = $this->findOrFail((int) $args['id']);
        $sets = []; $params = ['id' => $row['id']];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        if ($sets) {
            $this->pdo()->prepare('UPDATE mandanten SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    // ---------- Kontakte ----------
    public function addKontakt(array $args, array $body): void
    {
        Auth::requireBereich('kunden');
        $row = $this->findOrFail((int) $args['id']);
        $this->requireFields($body, ['name']);
        $this->pdo()->prepare('INSERT INTO mandant_kontakte (mandant_id, name, email) VALUES (:mid, :name, :email)')
            ->execute(['mid' => $row['id'], 'name' => $body['name'], 'email' => $body['email'] ?? null]);
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))], 201);
    }

    public function deleteKontakt(array $args, array $body): void
    {
        Auth::requireBereich('kunden');
        $this->pdo()->prepare('DELETE FROM mandant_kontakte WHERE id = :id AND mandant_id = :mid')
            ->execute(['id' => (int) $args['kontaktId'], 'mid' => (int) $args['id']]);
        Response::noContent();
    }

    // ---------- Leistungskatalog-Zuordnung ----------
    /** Ersetzt die komplette Leistungszuordnung eines Mandanten (aktiv + individueller Preis). */
    public function setLeistungen(array $args, array $body): void
    {
        Auth::requireBereich('kunden');
        $row = $this->findOrFail((int) $args['id']);
        $pdo = $this->pdo();
        $pdo->prepare('DELETE FROM mandant_leistungen WHERE mandant_id = :id')->execute(['id' => $row['id']]);
        $ins = $pdo->prepare('INSERT INTO mandant_leistungen (mandant_id, leistungskatalog_id, aktiv, price) VALUES (:mid, :lid, :aktiv, :price)');
        foreach (($body['leistungen'] ?? []) as $l) {
            $ins->execute([
                'mid' => $row['id'], 'lid' => (int) $l['leistungskatalogId'],
                'aktiv' => !empty($l['aktiv']) ? 1 : 0, 'price' => $l['price'] ?? 0,
            ]);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM mandanten WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Mandant nicht gefunden.', 404);
        }
        return $row;
    }

    private function toApi(array $row): array
    {
        $pdo = $this->pdo();
        $kStmt = $pdo->prepare('SELECT id, name, email FROM mandant_kontakte WHERE mandant_id = :id ORDER BY name ASC');
        $kStmt->execute(['id' => $row['id']]);
        $kontakte = array_map(fn($k) => ['id' => (int) $k['id'], 'name' => $k['name'], 'email' => $k['email']], $kStmt->fetchAll());

        $lStmt = $pdo->prepare(
            'SELECT ml.leistungskatalog_id, ml.aktiv, ml.price, lk.modul, lk.type, lk.haeufigkeit
             FROM mandant_leistungen ml JOIN leistungskatalog lk ON lk.id = ml.leistungskatalog_id
             WHERE ml.mandant_id = :id'
        );
        $lStmt->execute(['id' => $row['id']]);
        $leistungen = array_map(fn($l) => [
            'leistungskatalogId' => (int) $l['leistungskatalog_id'], 'modul' => $l['modul'],
            'type' => $l['type'], 'haeufigkeit' => $l['haeufigkeit'],
            'aktiv' => (bool) $l['aktiv'], 'price' => (float) $l['price'],
        ], $lStmt->fetchAll());

        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'kuerzel' => $row['kuerzel'],
            'adresse' => $row['adresse'],
            'ansprechpartner' => $row['ansprechpartner'],
            'email' => $row['email'],
            'telefon' => $row['telefon'],
            'kundeSeit' => $row['kunde_seit'],
            'vertragBeginn' => $row['vertrag_beginn'],
            'vertragLaufzeit' => $row['vertrag_laufzeit'],
            'vertragKuendigungsfrist' => $row['vertrag_kuendigungsfrist'],
            'vertragStatus' => $row['vertrag_status'],
            'reisekostenKappung' => (float) $row['reisekosten_kappung'],
            'kontakte' => $kontakte,
            'leistungen' => $leistungen,
        ];
    }

    /** Reduzierte Sicht für Mitarbeiter ohne "kunden"-Zugriff, siehe Klassendoku. */
    private function toApiTrimmed(array $row): array
    {
        $pdo = $this->pdo();
        $kStmt = $pdo->prepare('SELECT id, name, email FROM mandant_kontakte WHERE mandant_id = :id ORDER BY name ASC');
        $kStmt->execute(['id' => $row['id']]);
        $kontakte = array_map(fn($k) => ['id' => (int) $k['id'], 'name' => $k['name'], 'email' => $k['email']], $kStmt->fetchAll());

        $lStmt = $pdo->prepare(
            'SELECT lk.modul FROM mandant_leistungen ml JOIN leistungskatalog lk ON lk.id = ml.leistungskatalog_id
             WHERE ml.mandant_id = :id AND ml.aktiv = 1'
        );
        $lStmt->execute(['id' => $row['id']]);

        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'kuerzel' => $row['kuerzel'],
            'kontakte' => $kontakte,
            'aktiveAufgabentypen' => $lStmt->fetchAll(PDO::FETCH_COLUMN),
        ];
    }
}
