<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Response;
use PDO;

/**
 * Aufgaben-Vorlagen ("Neue Aufgabe aus Vorlage", part6_af.js). Das Feld "zugriff"
 * ("Alle"/"Nur ich") existiert im Datenmodell des Prototyps, wird dort aber an keiner Stelle zur
 * Sichtbarkeitsfilterung ausgewertet (nur beim Anlegen auf "Alle" gesetzt) - dieser Endpunkt
 * verhält sich bewusst identisch (keine Filterung nach "zugriff"), um denselben Funktionsstand
 * wie der Klick-Prototyp abzubilden statt eine dort nicht vorhandene Einschränkung zu ergänzen.
 */
final class VorlagenController extends BaseController
{
    public function index(array $args, array $body): void
    {
        Auth::requireBereich('aufgaben');
        $stmt = $this->pdo()->query('SELECT * FROM aufgaben_vorlagen ORDER BY name ASC');
        Response::json(['data' => array_map([$this, 'toApi'], $stmt->fetchAll())]);
    }

    public function create(array $args, array $body): void
    {
        $m = Auth::requireBereich('aufgaben');
        $this->requireFields($body, ['name', 'aufgabenTyp', 'titel', 'zugewiesenAn']);
        $stmt = $this->pdo()->prepare(
            'INSERT INTO aufgaben_vorlagen (name, mandant_id, aufgaben_typ, titel, beschreibung, zugewiesen_an, ersteller, zugriff)
             VALUES (:name, :mandantId, :aufgabenTyp, :titel, :beschreibung, :zugewiesenAn, :ersteller, :zugriff)'
        );
        $stmt->execute([
            'name' => $body['name'], 'mandantId' => $body['mandantId'] ?? null,
            'aufgabenTyp' => $body['aufgabenTyp'], 'titel' => $body['titel'],
            'beschreibung' => $body['beschreibung'] ?? null, 'zugewiesenAn' => $body['zugewiesenAn'],
            'ersteller' => $m['k'], 'zugriff' => $body['zugriff'] ?? 'Alle',
        ]);
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
        foreach ([
            'name' => 'name', 'mandantId' => 'mandant_id', 'aufgabenTyp' => 'aufgaben_typ',
            'titel' => 'titel', 'beschreibung' => 'beschreibung', 'zugewiesenAn' => 'zugewiesen_an',
            'zugriff' => 'zugriff',
        ] as $api => $col) {
            if (!array_key_exists($api, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $body[$api];
        }
        if ($sets) {
            $this->pdo()->prepare('UPDATE aufgaben_vorlagen SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
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
        $this->pdo()->prepare('DELETE FROM aufgaben_vorlagen WHERE id = :id')->execute(['id' => $row['id']]);
        Response::noContent();
    }

    private function setFollower(int $vorlageId, array $kuerzelListe): void
    {
        $pdo = $this->pdo();
        $pdo->prepare('DELETE FROM aufgaben_vorlagen_follower WHERE vorlage_id = :id')->execute(['id' => $vorlageId]);
        $ins = $pdo->prepare('INSERT IGNORE INTO aufgaben_vorlagen_follower (vorlage_id, mitarbeiter_kuerzel) VALUES (:id, :k)');
        foreach ($kuerzelListe as $k) {
            $ins->execute(['id' => $vorlageId, 'k' => $k]);
        }
    }

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM aufgaben_vorlagen WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Vorlage nicht gefunden.', 404);
        }
        return $row;
    }

    private function toApi(array $row): array
    {
        $fStmt = $this->pdo()->prepare('SELECT mitarbeiter_kuerzel FROM aufgaben_vorlagen_follower WHERE vorlage_id = :id');
        $fStmt->execute(['id' => $row['id']]);
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'mandantId' => $row['mandant_id'] !== null ? (int) $row['mandant_id'] : null,
            'aufgabenTyp' => $row['aufgaben_typ'],
            'titel' => $row['titel'],
            'beschreibung' => $row['beschreibung'],
            'zugewiesenAn' => $row['zugewiesen_an'],
            'ersteller' => $row['ersteller'],
            'zugriff' => $row['zugriff'],
            'follower' => $fStmt->fetchAll(PDO::FETCH_COLUMN),
        ];
    }
}
