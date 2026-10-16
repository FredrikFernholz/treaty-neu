<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Geschaeftsregeln;
use Treaty\Response;
use DateTimeImmutable;
use PDO;

/**
 * Office - Buchhaltung (Rechnungsprogramm). Portiert computeRechnungBasis()/den
 * Rechnung-Anlegen-Dialog aus part6c_office.js: Grundgebühr (Pauschale- + Prüfgebühr-Positionen,
 * bei gruppierten abgeschlossenen BK-Fällen im Zeitraum als Wert × Satz statt fixem Betrag),
 * Zeithonorar aus abrechenbaren Zeitbuchungen, Erfolgshonorar aus der Ersparnis abgeschlossener
 * BK-Fälle, Reisekosten gedeckelt auf die vertragliche Kappungsgrenze des Mandanten. Nur für
 * Administrator bzw. per Zusatzrecht "buchhaltung" zugänglich.
 */
final class RechnungenController extends BaseController
{
    public function index(array $args, array $body): void
    {
        Auth::requireBereich('buchhaltung');
        [$page, $pageSize, $offset] = $this->pagination();
        $where = ['1=1']; $params = [];
        if (!empty($_GET['mandantId'])) { $where[] = 'mandant_id = :mid'; $params['mid'] = (int) $_GET['mandantId']; }
        if (!empty($_GET['status'])) { $where[] = 'status = :status'; $params['status'] = $_GET['status']; }
        $whereSql = implode(' AND ', $where);

        $pdo = $this->pdo();
        $countStmt = $pdo->prepare("SELECT COUNT(*) c FROM rechnungen WHERE $whereSql");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetch()['c'];

        $stmt = $pdo->prepare("SELECT * FROM rechnungen WHERE $whereSql ORDER BY erstellt_am DESC LIMIT :lim OFFSET :off");
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
        Auth::requireBereich('buchhaltung');
        Response::json(['data' => $this->toApi($this->findOrFail((int) $args['id']))]);
    }

    /** Vorschau der Rechnungsbasis vor dem eigentlichen Anlegen (zweistufiger Dialog im Prototyp). */
    public function basis(array $args, array $body): void
    {
        Auth::requireBereich('buchhaltung');
        $this->requireFields($body, ['mandantId', 'von', 'bis']);
        $basis = $this->berechneBasis((int) $body['mandantId'], $body['von'], $body['bis']);
        Response::json(['data' => $basis]);
    }

    public function create(array $args, array $body): void
    {
        Auth::requireBereich('buchhaltung');
        $this->requireFields($body, ['mandantId', 'von', 'bis', 'haeufigkeit', 'zahlungsziel']);
        $mandantId = (int) $body['mandantId'];
        $basis = $this->berechneBasis($mandantId, $body['von'], $body['bis']);

        $mStmt = $this->pdo()->prepare('SELECT reisekosten_kappung FROM mandanten WHERE id = :id');
        $mStmt->execute(['id' => $mandantId]);
        $kappung = (float) ($mStmt->fetch()['reisekosten_kappung'] ?? 0);
        $reisekostenIst = (float) ($body['reisekostenIst'] ?? 0);
        $rk = Geschaeftsregeln::rechnungGesamt($basis['grundgebuehr'], $basis['zeithonorar'], $reisekostenIst, $kappung, $basis['erfolgshonorar']);

        $nummer = $this->naechsteNummer();
        $today = (new DateTimeImmutable('today'))->format('Y-m-d');

        $stmt = $this->pdo()->prepare(
            'INSERT INTO rechnungen (nummer, mandant_id, zeitraum_von, zeitraum_bis, haeufigkeit, erstellt_am,
                zahlungsziel, grundgebuehr, zeithonorar, reisekosten_ist, reisekosten, reisekosten_kappung,
                ersparnis_summe, erfolgshonorar_satz, erfolgshonorar, gesamtbetrag, status)
             VALUES (:nummer, :mid, :von, :bis, :haeufigkeit, :erstellt_am, :zahlungsziel, :grundgebuehr,
                :zeithonorar, :reisekosten_ist, :reisekosten, :reisekosten_kappung, :ersparnis_summe,
                :erfolgshonorar_satz, :erfolgshonorar, :gesamtbetrag, :status)'
        );
        $stmt->execute([
            'nummer' => $nummer, 'mid' => $mandantId, 'von' => $body['von'], 'bis' => $body['bis'],
            'haeufigkeit' => $body['haeufigkeit'], 'erstellt_am' => $today, 'zahlungsziel' => $body['zahlungsziel'],
            'grundgebuehr' => $basis['grundgebuehr'], 'zeithonorar' => $basis['zeithonorar'],
            'reisekosten_ist' => $rk['reisekostenIst'], 'reisekosten' => $rk['reisekosten'],
            'reisekosten_kappung' => $rk['reisekostenKappung'], 'ersparnis_summe' => $basis['ersparnisSumme'],
            'erfolgshonorar_satz' => $basis['erfolgshonorarSatz'], 'erfolgshonorar' => $basis['erfolgshonorar'],
            'gesamtbetrag' => $rk['gesamtbetrag'], 'status' => 'Entwurf',
        ]);
        $id = (int) $this->pdo()->lastInsertId();
        Response::json(['data' => $this->toApi($this->findOrFail($id))], 201);
    }

    /** Manuelle Nachbearbeitung der Beträge sowie Statuswechsel (Entwurf -> Versendet -> Bezahlt). */
    public function update(array $args, array $body): void
    {
        Auth::requireBereich('buchhaltung');
        $row = $this->findOrFail((int) $args['id']);
        $grundgebuehr = (float) ($body['grundgebuehr'] ?? $row['grundgebuehr']);
        $zeithonorar = (float) ($body['zeithonorar'] ?? $row['zeithonorar']);
        $reisekosten = (float) ($body['reisekosten'] ?? $row['reisekosten']);
        $erfolgshonorar = (float) ($body['erfolgshonorar'] ?? $row['erfolgshonorar']);
        $gesamtbetrag = round($grundgebuehr + $zeithonorar + $reisekosten + $erfolgshonorar, 2);
        $status = $body['status'] ?? $row['status'];
        $zahlungsziel = $body['zahlungsziel'] ?? $row['zahlungsziel'];

        $this->pdo()->prepare(
            'UPDATE rechnungen SET grundgebuehr=:g, zeithonorar=:z, reisekosten=:r, erfolgshonorar=:e,
                gesamtbetrag=:gb, status=:s, zahlungsziel=:zz WHERE id=:id'
        )->execute([
            'g' => $grundgebuehr, 'z' => $zeithonorar, 'r' => $reisekosten, 'e' => $erfolgshonorar,
            'gb' => $gesamtbetrag, 's' => $status, 'zz' => $zahlungsziel, 'id' => $row['id'],
        ]);
        Response::json(['data' => $this->toApi($this->findOrFail((int) $row['id']))]);
    }

    private function berechneBasis(int $mandantId, string $von, string $bis): array
    {
        $pdo = $this->pdo();

        $lStmt = $pdo->prepare(
            'SELECT lk.modul, lk.type, ml.aktiv, ml.price FROM mandant_leistungen ml
             JOIN leistungskatalog lk ON lk.id = ml.leistungskatalog_id WHERE ml.mandant_id = :id'
        );
        $lStmt->execute(['id' => $mandantId]);
        $leistungen = $lStmt->fetchAll();

        $gStmt = $pdo->prepare(
            "SELECT gruppierter_wert FROM betriebskosten
             WHERE mandant_id = :id AND status = 'abgeschlossen' AND gruppiert = 1
               AND aenderung >= :von AND aenderung <= :bis"
        );
        $gStmt->execute(['id' => $mandantId, 'von' => $von, 'bis' => $bis]);
        $gruppierteFaelle = $gStmt->fetchAll();

        $zStmt = $pdo->prepare(
            'SELECT aufgaben_typ AS aufgabenTyp, minuten FROM zeitbuchungen
             WHERE mandant_id = :id AND abrechenbar = 1 AND datum >= :von AND datum <= :bis'
        );
        $zStmt->execute(['id' => $mandantId, 'von' => $von, 'bis' => $bis]);
        $zeitEintraege = $zStmt->fetchAll();

        $eStmt = $pdo->prepare(
            "SELECT COALESCE(SUM(ersparnis), 0) s FROM betriebskosten
             WHERE mandant_id = :id AND status = 'abgeschlossen' AND aenderung >= :von AND aenderung <= :bis"
        );
        $eStmt->execute(['id' => $mandantId, 'von' => $von, 'bis' => $bis]);
        $ersparnisSumme = (float) $eStmt->fetch()['s'];

        return Geschaeftsregeln::rechnungsbasis($leistungen, $gruppierteFaelle, $zeitEintraege, $ersparnisSumme);
    }

    private function naechsteNummer(): string
    {
        $jahr = (new DateTimeImmutable('today'))->format('Y');
        $prefix = "RE-$jahr-";
        $stmt = $this->pdo()->prepare("SELECT nummer FROM rechnungen WHERE nummer LIKE :p");
        $stmt->execute(['p' => $prefix . '%']);
        $max = 0;
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $nummer) {
            $n = (int) substr($nummer, strlen($prefix));
            $max = max($max, $n);
        }
        return $prefix . str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
    }

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM rechnungen WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Rechnung nicht gefunden.', 404);
        }
        return $row;
    }

    private function toApi(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'nummer' => $row['nummer'],
            'mandantId' => (int) $row['mandant_id'],
            'zeitraumVon' => $row['zeitraum_von'],
            'zeitraumBis' => $row['zeitraum_bis'],
            'haeufigkeit' => $row['haeufigkeit'],
            'erstelltAm' => $row['erstellt_am'],
            'zahlungsziel' => $row['zahlungsziel'],
            'grundgebuehr' => (float) $row['grundgebuehr'],
            'zeithonorar' => (float) $row['zeithonorar'],
            'reisekostenIst' => (float) $row['reisekosten_ist'],
            'reisekosten' => (float) $row['reisekosten'],
            'reisekostenKappung' => (float) $row['reisekosten_kappung'],
            'reisekostenGedeckelt' => (bool) $row['reisekosten_gedeckelt'],
            'ersparnisSumme' => (float) $row['ersparnis_summe'],
            'erfolgshonorarSatz' => (float) $row['erfolgshonorar_satz'],
            'erfolgshonorar' => (float) $row['erfolgshonorar'],
            'gesamtbetrag' => (float) $row['gesamtbetrag'],
            'status' => $row['status'],
        ];
    }
}
