<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Response;

/** Kontaktdatenbank: Counterparts (Hausverwaltungen/Gegenseiten) inkl. Ansprechpersonen. */
final class CounterpartsController extends BaseController
{
    public function index(array $args, array $body): void
    {
        Auth::requireBereich('kontaktdatenbank');
        $stmt = $this->pdo()->query('SELECT * FROM counterparts ORDER BY name ASC');
        Response::json(['data' => array_map([$this, 'toApi'], $stmt->fetchAll())]);
    }

    public function create(array $args, array $body): void
    {
        Auth::requireBereich('kontaktdatenbank');
        $this->requireFields($body, ['name']);
        $stmt = $this->pdo()->prepare('INSERT INTO counterparts (name, email, adresse) VALUES (:name, :email, :adresse)');
        $stmt->execute(['name' => $body['name'], 'email' => $body['email'] ?? null, 'adresse' => $body['adresse'] ?? null]);
        $id = (int) $this->pdo()->lastInsertId();
        Response::json(['data' => $this->find($id)], 201);
    }

    public function addKontakt(array $args, array $body): void
    {
        Auth::requireBereich('kontaktdatenbank');
        $this->requireFields($body, ['name']);
        $this->pdo()->prepare('INSERT INTO counterpart_kontakte (counterpart_id, name, email) VALUES (:cid, :name, :email)')
            ->execute(['cid' => (int) $args['id'], 'name' => $body['name'], 'email' => $body['email'] ?? null]);
        Response::json(['data' => $this->find((int) $args['id'])], 201);
    }

    private function find(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM counterparts WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) { Response::error('Counterpart nicht gefunden.', 404); }
        return $this->toApi($row);
    }

    private function toApi(array $row): array
    {
        $stmt = $this->pdo()->prepare('SELECT id, name, email FROM counterpart_kontakte WHERE counterpart_id = :id ORDER BY name ASC');
        $stmt->execute(['id' => $row['id']]);
        return [
            'id' => (int) $row['id'], 'name' => $row['name'], 'email' => $row['email'], 'adresse' => $row['adresse'],
            'kontakte' => array_map(fn($k) => ['id' => (int) $k['id'], 'name' => $k['name'], 'email' => $k['email']], $stmt->fetchAll()),
        ];
    }
}
