<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Response;

/** Zentrale Stammdaten-Liste aller Aufgabentypen mit Standardpreis/-typ/-häufigkeit. */
final class LeistungskatalogController extends BaseController
{
    public function index(array $args, array $body): void
    {
        Auth::requireBereich('leistungskatalog');
        $stmt = $this->pdo()->query('SELECT * FROM leistungskatalog ORDER BY modul ASC');
        Response::json(['data' => array_map([$this, 'toApi'], $stmt->fetchAll())]);
    }

    /**
     * Neues Modul im Leistungskatalog anlegen (siehe openLeistungskatalogForm(), part7_init.js -
     * fehlte in der ersten Backend-Fassung, obwohl die Nutzerverwaltungs-Oberfläche das "Neues Modul
     * anlegen"-Formular schon vorsah).
     */
    public function create(array $args, array $body): void
    {
        Auth::requireBereich('leistungskatalog');
        $this->requireFields($body, ['modul', 'type', 'haeufigkeit']);
        $stmt = $this->pdo()->prepare(
            'INSERT INTO leistungskatalog (modul, price, type, haeufigkeit) VALUES (:modul, :price, :type, :haeufigkeit)'
        );
        $stmt->execute([
            'modul' => $body['modul'], 'price' => $body['price'] ?? 0,
            'type' => $body['type'], 'haeufigkeit' => $body['haeufigkeit'],
        ]);
        $id = (int) $this->pdo()->lastInsertId();
        $stmt2 = $this->pdo()->prepare('SELECT * FROM leistungskatalog WHERE id = :id');
        $stmt2->execute(['id' => $id]);
        Response::json(['data' => $this->toApi($stmt2->fetch())], 201);
    }

    public function update(array $args, array $body): void
    {
        Auth::requireBereich('leistungskatalog');
        $sets = []; $params = ['id' => (int) $args['id']];
        foreach (['price' => 'price', 'type' => 'type', 'haeufigkeit' => 'haeufigkeit'] as $api => $col) {
            if (!array_key_exists($api, $body)) continue;
            $sets[] = "$col = :$col"; $params[$col] = $body[$api];
        }
        if ($sets) {
            $this->pdo()->prepare('UPDATE leistungskatalog SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
        }
        $stmt = $this->pdo()->prepare('SELECT * FROM leistungskatalog WHERE id = :id');
        $stmt->execute(['id' => $args['id']]);
        $row = $stmt->fetch();
        if (!$row) { Response::error('Leistungskatalog-Position nicht gefunden.', 404); }
        Response::json(['data' => $this->toApi($row)]);
    }

    private function toApi(array $row): array
    {
        return [
            'id' => (int) $row['id'], 'modul' => $row['modul'], 'price' => (float) $row['price'],
            'type' => $row['type'], 'haeufigkeit' => $row['haeufigkeit'],
        ];
    }
}
