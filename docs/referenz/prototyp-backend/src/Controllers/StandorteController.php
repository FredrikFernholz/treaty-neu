<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Response;

final class StandorteController extends BaseController
{
    public function index(array $args, array $body): void
    {
        Auth::requireAuth();
        $where = '1=1'; $params = [];
        if (!empty($_GET['mandantId'])) { $where = 'mandant_id = :mid'; $params['mid'] = (int) $_GET['mandantId']; }
        $stmt = $this->pdo()->prepare("SELECT * FROM standorte WHERE $where ORDER BY nr ASC");
        $stmt->execute($params);
        Response::json(['data' => array_map([$this, 'toApi'], $stmt->fetchAll())]);
    }

    public function create(array $args, array $body): void
    {
        Auth::requireAuth();
        $this->requireFields($body, ['nr', 'ort']);
        $stmt = $this->pdo()->prepare(
            'INSERT INTO standorte (nr, ort, plz, mandant_id, adresse) VALUES (:nr, :ort, :plz, :mid, :adresse)'
        );
        $stmt->execute([
            'nr' => $body['nr'], 'ort' => $body['ort'], 'plz' => $body['plz'] ?? null,
            'mid' => $body['mandantId'] ?? null, 'adresse' => $body['adresse'] ?? null,
        ]);
        $id = (int) $this->pdo()->lastInsertId();
        $stmt2 = $this->pdo()->prepare('SELECT * FROM standorte WHERE id = :id');
        $stmt2->execute(['id' => $id]);
        Response::json(['data' => $this->toApi($stmt2->fetch())], 201);
    }

    public function update(array $args, array $body): void
    {
        Auth::requireAuth();
        $sets = []; $params = ['id' => (int) $args['id']];
        foreach (['nr' => 'nr', 'ort' => 'ort', 'plz' => 'plz', 'mandantId' => 'mandant_id', 'adresse' => 'adresse'] as $api => $col) {
            if (!array_key_exists($api, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $body[$api];
        }
        if ($sets) {
            $this->pdo()->prepare('UPDATE standorte SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
        }
        $stmt = $this->pdo()->prepare('SELECT * FROM standorte WHERE id = :id');
        $stmt->execute(['id' => $args['id']]);
        $row = $stmt->fetch();
        if (!$row) { Response::error('Standort nicht gefunden.', 404); }
        Response::json(['data' => $this->toApi($row)]);
    }

    private function toApi(array $row): array
    {
        return [
            'id' => (int) $row['id'], 'nr' => $row['nr'], 'ort' => $row['ort'], 'plz' => $row['plz'],
            'mandantId' => $row['mandant_id'] !== null ? (int) $row['mandant_id'] : null,
            'adresse' => $row['adresse'],
        ];
    }
}
