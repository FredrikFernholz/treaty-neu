<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Konstanten;
use Treaty\Rechte;
use Treaty\Response;
use PDO;

/**
 * Nutzerverwaltung. Das Setzen von Zusatzrechten (mitarbeiter_zusatzrechte) ist bewusst NICHT
 * protokollpflichtig (fachlich bestätigt, siehe PRD Abschnitt 3 und die Tabelle im Schema ohne
 * Audit-Spalten) - setLeistungen/setZusatzrechte hier führen daher absichtlich kein
 * "geändert von/am" mit, anders als praktisch jede andere Änderung im System.
 *
 * index() ist bewusst für JEDEN angemeldeten Mitarbeiter erreichbar, nicht nur für die
 * Nutzerverwaltung (Administrator/Zusatzrecht) - im Prototyp ist MITARBEITER ein globaler,
 * ungeschützter Datensatz, der von jeder Berechtigungsstufe für Zuweisungs-Dropdowns
 * ("Zugewiesen an", Follower, Bearbeiter-Auswahl) benötigt wird (part3_core.js:
 * zugewiesenAnOptionen(), zuweisungAnzeigename()). Ohne Nutzerverwaltungs-Zugriff werden daher nur
 * die für solche Dropdowns nötigen, unkritischen Felder ausgeliefert (kein "berechtigung",
 * "aktiv" oder "zusatzrechte") - die eigentliche Verwaltung (Anlegen/Ändern/Zusatzrechte) bleibt
 * wie bisher auf "nutzerverwaltung" beschränkt.
 */
final class NutzerController extends BaseController
{
    private const WRITABLE = [
        'name' => 'name', 'email' => 'email', 'berechtigung' => 'berechtigung',
        'zeichnung' => 'zeichnung', 'bezeichnung' => 'bezeichnung', 'aktiv' => 'aktiv',
    ];

    public function index(array $args, array $body): void
    {
        $m = Auth::requireAuth();
        $voll = Rechte::hatZugriffMitarbeiter('nutzerverwaltung', $m);
        $stmt = $this->pdo()->query('SELECT * FROM mitarbeiter' . ($voll ? '' : ' WHERE aktiv = 1') . ' ORDER BY name ASC');
        $rows = $stmt->fetchAll();
        Response::json(['data' => array_map($voll ? [$this, 'toApi'] : [$this, 'toApiTrimmed'], $rows)]);
    }

    public function show(array $args, array $body): void
    {
        Auth::requireBereich('nutzerverwaltung');
        Response::json(['data' => $this->toApi($this->findOrFail((int) $args['id']))]);
    }

    public function create(array $args, array $body): void
    {
        Auth::requireBereich('nutzerverwaltung');
        $this->requireFields($body, ['kuerzel', 'name', 'email', 'password', 'berechtigung']);
        if (!in_array($body['berechtigung'], Konstanten::BERECHTIGUNGSSTUFEN, true)) {
            Response::error('Ungültige Berechtigungsstufe.', 422);
        }
        $stmt = $this->pdo()->prepare(
            'INSERT INTO mitarbeiter (kuerzel, name, email, password_hash, berechtigung, zeichnung, bezeichnung, aktiv)
             VALUES (:kuerzel, :name, :email, :hash, :berechtigung, :zeichnung, :bezeichnung, :aktiv)'
        );
        $stmt->execute([
            'kuerzel' => strtoupper($body['kuerzel']), 'name' => $body['name'], 'email' => $body['email'],
            'hash' => password_hash($body['password'], PASSWORD_DEFAULT),
            'berechtigung' => $body['berechtigung'], 'zeichnung' => $body['zeichnung'] ?? 'ohne',
            'bezeichnung' => $body['bezeichnung'] ?? null, 'aktiv' => 1,
        ]);
        $id = (int) $this->pdo()->lastInsertId();
        Response::json(['data' => $this->toApi($this->findOrFail($id))], 201);
    }

    public function update(array $args, array $body): void
    {
        Auth::requireBereich('nutzerverwaltung');
        $row = $this->findOrFail((int) $args['id']);
        $sets = []; $params = ['id' => $row['id']];
        foreach (self::WRITABLE as $apiKey => $col) {
            if (!array_key_exists($apiKey, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $this->dbValue($apiKey, $body[$apiKey]);
        }
        if (!empty($body['password'])) {
            $sets[] = 'password_hash = :ph';
            $params['ph'] = password_hash((string) $body['password'], PASSWORD_DEFAULT);
        }
        if ($sets) {
            $this->pdo()->prepare('UPDATE mitarbeiter SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    /**
     * Zusatzrechte eines Mitarbeiters komplett ersetzen. Bewusst ohne jede Protokollierung (siehe
     * Klassendoku) - kein "wer/wann" wird hier oder anderswo für diese Änderung festgehalten.
     */
    public function setZusatzrechte(array $args, array $body): void
    {
        Auth::requireBereich('nutzerverwaltung');
        $row = $this->findOrFail((int) $args['id']);
        $keys = array_values(array_intersect((array) ($body['zusatzrechte'] ?? []), Konstanten::ZUSATZRECHTE_OPTIONEN));

        $pdo = $this->pdo();
        $pdo->prepare('DELETE FROM mitarbeiter_zusatzrechte WHERE mitarbeiter_id = :id')->execute(['id' => $row['id']]);
        $ins = $pdo->prepare('INSERT INTO mitarbeiter_zusatzrechte (mitarbeiter_id, bereich_key) VALUES (:id, :k)');
        foreach ($keys as $k) {
            $ins->execute(['id' => $row['id'], 'k' => $k]);
        }
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    public function rechtematrix(array $args, array $body): void
    {
        Auth::requireBereich('nutzerverwaltung');
        Response::json([
            'rechtematrix' => Konstanten::RECHTEMATRIX,
            'zusatzrechteOptionen' => Konstanten::ZUSATZRECHTE_OPTIONEN,
            'berechtigungsstufen' => Konstanten::BERECHTIGUNGSSTUFEN,
        ]);
    }

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM mitarbeiter WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Mitarbeiter nicht gefunden.', 404);
        }
        return $row;
    }

    private function toApi(array $row): array
    {
        $stmt = $this->pdo()->prepare('SELECT bereich_key FROM mitarbeiter_zusatzrechte WHERE mitarbeiter_id = :id');
        $stmt->execute(['id' => $row['id']]);
        return [
            'id' => (int) $row['id'],
            'k' => $row['kuerzel'],
            'name' => $row['name'],
            'email' => $row['email'],
            'berechtigung' => $row['berechtigung'],
            'zeichnung' => $row['zeichnung'],
            'bezeichnung' => $row['bezeichnung'],
            'aktiv' => (bool) $row['aktiv'],
            'zusatzrechte' => $stmt->fetchAll(PDO::FETCH_COLUMN),
        ];
    }

    private function toApiTrimmed(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'k' => $row['kuerzel'],
            'name' => $row['name'],
            'email' => $row['email'],
            'zeichnung' => $row['zeichnung'],
            'bezeichnung' => $row['bezeichnung'],
        ];
    }
}
