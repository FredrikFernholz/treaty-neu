<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Konstanten as K;
use Treaty\Response;
use Treaty\Vertragsregeln;
use DateTimeImmutable;
use PDO;

/**
 * Modul Vertragsmanagement (Vertragsdatenbank mit Datenblatt und Vertragskarte).
 *
 * Ein Vertrag besteht aus den Stammfeldern in "vertraege" und fünf Unterlisten, die im API-Payload
 * als Felder des Vertrags mitgeschickt werden (Flächen, Staffeln, Ansprechpartner, Notizen, Frist-
 * Erinnerungen). Beim Speichern ersetzt eine mitgeschickte Unterliste die bisherige vollständig,
 * eine nicht mitgeschickte bleibt unverändert. Mietende, Optionsfrist, Kündigungsfrist und nächste
 * Indexanpassung werden nicht gespeichert, sondern in Vertragsregeln berechnet und unter
 * "abgeleitet" mitgeliefert.
 */
final class VertraegeController extends BaseController
{
    private const T_STR = 'str', T_BOOL = 'bool', T_INT = 'int', T_DEC = 'dec', T_DATE = 'date', T_MONTH = 'month';

    /** API-Feld => [Spalte, Typ, erlaubte Werte (nur Auswahlfelder)]. */
    private const FELDER = [
        'status' => ['status', self::T_STR, K::VERTRAG_STATUS],
        'vertragsart' => ['vertragsart', self::T_STR, K::VERTRAG_ARTEN],
        'verwendung' => ['verwendung', self::T_STR],
        'mietzweck' => ['mietzweck', self::T_STR],
        'konzession' => ['konzession', self::T_STR],
        'parkplaetze' => ['parkplaetze', self::T_INT],
        'sitzInnen' => ['sitz_innen', self::T_INT],
        'sitzAussen' => ['sitz_aussen', self::T_INT],
        'aussenterrasse' => ['aussenterrasse', self::T_DEC],
        'mietbeginn' => ['mietbeginn', self::T_DATE],
        'laufzeit' => ['laufzeit', self::T_INT],
        'laufzeitEinheit' => ['laufzeit_einheit', self::T_STR, K::VERTRAG_EINHEITEN],
        'optAnzahl' => ['opt_anzahl', self::T_INT],
        'optAusgeuebt' => ['opt_ausgeuebt', self::T_INT],
        'optLZ' => ['opt_lz', self::T_INT],
        'optLZEinheit' => ['opt_lz_einheit', self::T_STR, K::VERTRAG_EINHEITEN],
        'optFristMonate' => ['opt_frist_monate', self::T_INT],
        'optAusuebung' => ['opt_ausuebung', self::T_STR],
        'gekuendigtAm' => ['gekuendigt_am', self::T_DATE],
        'gekuendigtZum' => ['gekuendigt_zum', self::T_DATE],
        'kuendigungsfrist' => ['kuendigungsfrist', self::T_STR, K::VERTRAG_KUENDIGUNGSFRIST],
        'kuendigungVorlaufMonate' => ['kuendigung_vorlauf_monate', self::T_INT],
        'sonderkuendigungVN' => ['sonderkuendigung_vn', self::T_BOOL],
        'sonderkuendigungVG' => ['sonderkuendigung_vg', self::T_BOOL],
        'autoVerlaengerung' => ['auto_verlaengerung', self::T_BOOL],
        'autoVerlWert' => ['auto_verl_wert', self::T_INT],
        'autoVerlEinheit' => ['auto_verl_einheit', self::T_STR, K::VERTRAG_EINHEITEN],
        'mieteNettoPM' => ['miete_netto_pm', self::T_DEC],
        'nkPauschalePM' => ['nk_pauschale_pm', self::T_DEC],
        'nkVorauszahlungPM' => ['nk_vorauszahlung_pm', self::T_DEC],
        'mwst' => ['mwst', self::T_DEC],
        'zahlungsrhythmus' => ['zahlungsrhythmus', self::T_STR, K::VERTRAG_ZAHLUNGSRHYTHMUS],
        'mietsicherheit' => ['mietsicherheit', self::T_BOOL],
        'mietsicherheitBetrag' => ['mietsicherheit_betrag', self::T_DEC],
        'mietsicherheitArt' => ['mietsicherheit_art', self::T_STR, K::VERTRAG_SICHERHEIT_ART],
        'umsatzmiete' => ['umsatzmiete', self::T_BOOL],
        'umsatzmieteProzent' => ['umsatzmiete_prozent', self::T_DEC],
        'staffelmiete' => ['staffelmiete', self::T_BOOL],
        'staffelArt' => ['staffel_art', self::T_STR, K::VERTRAG_STAFFEL_ART],
        'indexierung' => ['indexierung', self::T_BOOL],
        'indexArt' => ['index_art', self::T_STR, K::VERTRAG_INDEX_ART],
        'indexBasis' => ['index_basis', self::T_STR],
        'indexKlausel' => ['index_klausel', self::T_STR, K::VERTRAG_INDEX_KLAUSEL],
        'indexFundstelle' => ['index_fundstelle', self::T_STR],
        'indexSchwelle' => ['index_schwelle', self::T_DEC],
        'indexSchwelleEinheit' => ['index_schwelle_einheit', self::T_STR, K::VERTRAG_INDEX_SCHWELLE_EINHEIT],
        'indexAnpassung' => ['index_anpassung', self::T_STR, K::VERTRAG_INDEX_ANPASSUNG],
        'indexRichtung' => ['index_richtung', self::T_STR, K::VERTRAG_INDEX_RICHTUNG],
        'indexUmfang' => ['index_umfang', self::T_DEC],
        'indexDeckel' => ['index_deckel', self::T_DEC],
        'indexWirkung' => ['index_wirkung', self::T_STR, K::VERTRAG_INDEX_WIRKUNG],
        'indexBasisMonat' => ['index_basis_monat', self::T_MONTH],
        'indexBasisStand' => ['index_basis_stand', self::T_DEC],
        'indexErste' => ['index_erste', self::T_DATE],
        'indexLetzte' => ['index_letzte', self::T_DATE],
        'indexLetzterStand' => ['index_letzter_stand', self::T_DEC],
        'konkurrenzschutz' => ['konkurrenzschutz', self::T_BOOL],
        'betriebspflicht' => ['betriebspflicht', self::T_BOOL],
        'verkehrssicherung' => ['verkehrssicherung', self::T_BOOL],
        'schoenheitsreparaturen' => ['schoenheitsreparaturen', self::T_BOOL],
        'untervermietung' => ['untervermietung', self::T_BOOL],
        'aktuellUntervermietet' => ['aktuell_untervermietet', self::T_BOOL],
        'nkEmpfaenger' => ['nk_empfaenger', self::T_STR],
        'anmerkungen' => ['anmerkungen', self::T_STR],
    ];

    /** Felder, an denen die fachlichen Regeln in fachlichPruefen() hängen. */
    private const REGELFELDER = ['mietbeginn', 'laufzeit', 'autoVerlaengerung', 'autoVerlWert', 'optAnzahl', 'optAusgeuebt',
        'staffelmiete', 'staffeln', 'indexierung', 'indexUmfang'];

    private const AP_FELDER = ['funktion', 'firma', 'anschrift', 'plz', 'ort', 'name', 'vorname', 'telefon', 'mobil', 'email'];

    // ------------------------------------------------------------------ Lesen

    public function index(array $args, array $body): void
    {
        Auth::requireBereich('vertraege');
        [$page, $pageSize, $offset] = $this->pagination();

        $where = ['archiviert = :archiviert'];
        $params = ['archiviert' => (int) (($_GET['archiviert'] ?? '0') === '1')];
        if (!empty($_GET['mandantId'])) { $where[] = 'mandant_id = :mandantId'; $params['mandantId'] = (int) $_GET['mandantId']; }
        if (!empty($_GET['standortId'])) { $where[] = 'standort_id = :standortId'; $params['standortId'] = (int) $_GET['standortId']; }
        if (!empty($_GET['status'])) { $where[] = 'status = :status'; $params['status'] = $_GET['status']; }
        $whereSql = implode(' AND ', $where);

        $pdo = $this->pdo();
        $count = $pdo->prepare('SELECT COUNT(*) c FROM vertraege WHERE ' . $whereSql);
        $count->execute($params);
        $total = (int) $count->fetch()['c'];

        $stmt = $pdo->prepare("SELECT * FROM vertraege WHERE $whereSql ORDER BY id ASC LIMIT :lim OFFSET :off");
        foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
        $stmt->bindValue('lim', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $kinder = $this->kinderLaden(array_map(fn($r) => (int) $r['id'], $rows));
        Response::json([
            'data' => array_map(fn($r) => $this->toApi($r, $kinder), $rows),
            'page' => $page, 'pageSize' => $pageSize, 'total' => $total,
        ]);
    }

    public function show(array $args, array $body): void
    {
        Auth::requireBereich('vertraege');
        $row = $this->findOrFail((int) $args['id']);
        Response::json(['data' => $this->toApi($row, $this->kinderLaden([(int) $row['id']]))]);
    }

    /**
     * Fällige Erinnerungen (Zieltermin heute oder früher, höchstens $tage Tage zurück), Grundlage
     * für einen späteren Versand per Cronjob. Der Versand selbst ist nicht Teil dieses Backends.
     */
    public function erinnerungenFaellig(array $args, array $body): void
    {
        Auth::requireBereich('vertraege');
        Response::json(['data' => self::faelligeErinnerungen($this->pdo(), new DateTimeImmutable('today'), (int) ($_GET['tage'] ?? 7))]);
    }

    /** @return array<int, array<string, mixed>> */
    public static function faelligeErinnerungen(PDO $pdo, DateTimeImmutable $heute, int $tage = 7): array
    {
        $ctl = new self();
        $rows = $pdo->query('SELECT * FROM vertraege WHERE archiviert = 0 AND status NOT IN (\'vorgeschlagen\',\'archiviert\')')->fetchAll();
        $kinder = $ctl->kinderLaden(array_map(fn($r) => (int) $r['id'], $rows));
        $out = [];
        $von = $heute->modify("-$tage day")->format('Y-m-d');
        $bis = $heute->format('Y-m-d');
        foreach ($rows as $row) {
            $v = $ctl->toApi($row, $kinder);
            foreach ($v['fristErinnerungen'] as $art => $liste) {
                $frist = Vertragsregeln::fristDatum($art, $v, $heute);
                foreach ($liste as $e) {
                    $ziel = Vertragsregeln::erinnerungZieldatum($e, $frist);
                    if ($ziel !== null && $ziel >= $von && $ziel <= $bis) {
                        $out[] = [
                            'vertragId' => $v['id'], 'mandantId' => $v['mandantId'], 'standortId' => $v['standortId'],
                            'fristArt' => $art, 'fristDatum' => $frist, 'zieltermin' => $ziel,
                            'kanaele' => $e['kanaele'], 'empfaenger' => $e['empfaenger'], 'kundenKontakte' => $e['kundenKontakte'],
                        ];
                    }
                }
            }
        }
        return $out;
    }

    // ------------------------------------------------------------------ Schreiben

    public function create(array $args, array $body): void
    {
        Auth::requireBereich('vertraege');
        $id = $this->anlegen($body);
        $row = $this->findOrFail($id);
        Response::json(['data' => $this->toApi($row, $this->kinderLaden([$id]))], 201);
    }

    /** Legt einen Vertrag samt Unterlisten an und liefert die neue ID (auch vom Seed-Skript genutzt). */
    public function anlegen(array $body): int
    {
        $this->requireFields($body, ['mandantId']);
        $this->mandantPruefen((int) $body['mandantId']);
        $this->fachlichPruefen($body);

        $pdo = $this->pdo();
        $pdo->beginTransaction();
        try {
            $cols = ['mandant_id', 'standort_id', 'counterpart_id', 'aenderung', 'archiviert', 'ansprechpartner_individuell'];
            $params = [
                'mandant_id' => (int) $body['mandantId'],
                'standort_id' => $this->refId($body, 'standortId'),
                'counterpart_id' => $this->refId($body, 'counterpartId'),
                'aenderung' => $body['aenderung'] ?? (new DateTimeImmutable('today'))->format('Y-m-d'),
                'archiviert' => (($body['status'] ?? 'aktiv') === 'archiviert') ? 1 : 0,
                'ansprechpartner_individuell' => (isset($body['ansprechpartner']) && is_array($body['ansprechpartner'])) ? 1 : 0,
            ];
            foreach (self::FELDER as $apiKey => [$col, $typ]) {
                if (!array_key_exists($apiKey, $body)) { continue; }
                $cols[] = $col;
                $params[$col] = $this->wert($apiKey, $body[$apiKey]);
            }
            $sql = 'INSERT INTO vertraege (' . implode(',', $cols) . ') VALUES (' . implode(',', array_map(fn($c) => ":$c", $cols)) . ')';
            $pdo->prepare($sql)->execute($params);
            $id = (int) $pdo->lastInsertId();
            $this->kinderSchreiben($id, $body);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return $id;
    }

    public function update(array $args, array $body): void
    {
        Auth::requireBereich('vertraege');
        $row = $this->findOrFail((int) $args['id']);
        $id = (int) $row['id'];

        // Fachliche Regeln werden nur geprüft, wenn der Aufruf ein daran beteiligtes Feld enthält. Ein reines
        // Umsetzen des Status (z. B. Aus dem Archiv holen) bleibt damit auch bei älteren Datensätzen möglich.
        if (array_intersect(self::REGELFELDER, array_keys($body))) {
            $this->fachlichPruefen(array_replace($this->toApi($row, $this->kinderLaden([$id])), $body));
        }

        $pdo = $this->pdo();
        $pdo->beginTransaction();
        try {
            $sets = ['aenderung = :aenderung'];
            $params = ['id' => $id, 'aenderung' => (new DateTimeImmutable('today'))->format('Y-m-d')];
            if (array_key_exists('mandantId', $body)) {
                $this->mandantPruefen((int) $body['mandantId']);
                $sets[] = 'mandant_id = :mandant_id'; $params['mandant_id'] = (int) $body['mandantId'];
            }
            if (array_key_exists('standortId', $body)) { $sets[] = 'standort_id = :standort_id'; $params['standort_id'] = $this->refId($body, 'standortId'); }
            if (array_key_exists('counterpartId', $body)) { $sets[] = 'counterpart_id = :counterpart_id'; $params['counterpart_id'] = $this->refId($body, 'counterpartId'); }
            foreach (self::FELDER as $apiKey => [$col]) {
                if (!array_key_exists($apiKey, $body)) { continue; }
                $sets[] = "$col = :$col";
                $params[$col] = $this->wert($apiKey, $body[$apiKey]);
            }
            if (array_key_exists('status', $body)) {
                $sets[] = 'archiviert = :archiviert';
                $params['archiviert'] = $body['status'] === 'archiviert' ? 1 : 0;
            }
            if (array_key_exists('ansprechpartner', $body)) {
                $sets[] = 'ansprechpartner_individuell = :api';
                $params['api'] = is_array($body['ansprechpartner']) ? 1 : 0;
            }
            $pdo->prepare('UPDATE vertraege SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
            $this->kinderSchreiben($id, $body);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        $neu = $this->findOrFail($id);
        Response::json(['data' => $this->toApi($neu, $this->kinderLaden([$id]))]);
    }

    /** Ersetzt alle Bemerkungen (Quelle und Text je Feld) eines Vertrags, z. B. direkt aus dem Datenblatt. */
    public function setNotizen(array $args, array $body): void
    {
        Auth::requireBereich('vertraege');
        $row = $this->findOrFail((int) $args['id']);
        $id = (int) $row['id'];
        if (!isset($body['notizen']) || !is_array($body['notizen'])) {
            Response::error('Feld "notizen" fehlt.', 422);
        }
        $pdo = $this->pdo();
        $pdo->beginTransaction();
        try {
            $this->notizenSchreiben($id, $body['notizen']);
            $pdo->prepare('UPDATE vertraege SET aenderung = :a WHERE id = :id')
                ->execute(['a' => (new DateTimeImmutable('today'))->format('Y-m-d'), 'id' => $id]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Response::json(['data' => $this->toApi($this->findOrFail($id), $this->kinderLaden([$id]))]);
    }

    public function archive(array $args, array $body): void
    {
        Auth::requireBereich('vertraege');
        $row = $this->findOrFail((int) $args['id']);
        $this->pdo()->prepare("UPDATE vertraege SET archiviert = 1, status = 'archiviert', aenderung = :a WHERE id = :id")
            ->execute(['a' => (new DateTimeImmutable('today'))->format('Y-m-d'), 'id' => $row['id']]);
        Response::json(['ok' => true]);
    }

    // ------------------------------------------------------------------ Unterlisten

    private function kinderSchreiben(int $id, array $body): void
    {
        $pdo = $this->pdo();

        if (array_key_exists('flaechen', $body)) {
            $this->liste($body['flaechen'], 'flaechen');
            $pdo->prepare('DELETE FROM vertraege_flaechen WHERE vertrag_id = :id')->execute(['id' => $id]);
            $ins = $pdo->prepare('INSERT INTO vertraege_flaechen (vertrag_id, position, lage, qm, bemerkung) VALUES (:v, :p, :l, :q, :b)');
            foreach (array_values($body['flaechen']) as $i => $f) {
                $lage = trim((string) ($f['lage'] ?? ''));
                $ins->execute(['v' => $id, 'p' => $i, 'l' => $lage !== '' ? $lage : 'Mietfläche', 'q' => $this->zahl($f['qm'] ?? 0, 'Fläche'), 'b' => $this->textOderNull($f['bem'] ?? null)]);
            }
        }

        if (array_key_exists('staffeln', $body)) {
            $this->liste($body['staffeln'], 'staffeln');
            $pdo->prepare('DELETE FROM vertraege_staffeln WHERE vertrag_id = :id')->execute(['id' => $id]);
            $ins = $pdo->prepare('INSERT INTO vertraege_staffeln (vertrag_id, position, wert, startdatum, ausloeser) VALUES (:v, :p, :w, :s, :a)');
            foreach (array_values($body['staffeln']) as $i => $s) {
                $ins->execute(['v' => $id, 'p' => $i, 'w' => $this->zahl($s['wert'] ?? 0, 'Staffelwert'), 's' => $this->datum($s['startdatum'] ?? null, 'Startdatum der Staffel'), 'a' => $this->textOderNull($s['ausloeser'] ?? null)]);
            }
        }

        if (array_key_exists('ansprechpartner', $body)) {
            $pdo->prepare('DELETE FROM vertraege_ansprechpartner WHERE vertrag_id = :id')->execute(['id' => $id]);
            if (is_array($body['ansprechpartner'])) {
                $cols = implode(',', self::AP_FELDER);
                $ph = implode(',', array_map(fn($c) => ":$c", self::AP_FELDER));
                $ins = $pdo->prepare("INSERT INTO vertraege_ansprechpartner (vertrag_id, position, $cols) VALUES (:vertrag_id, :position, $ph)");
                foreach (array_values($body['ansprechpartner']) as $i => $z) {
                    $p = ['vertrag_id' => $id, 'position' => $i];
                    foreach (self::AP_FELDER as $c) { $p[$c] = $this->textOderNull($z[$c] ?? null); }
                    $ins->execute($p);
                }
            }
        }

        if (array_key_exists('notizen', $body)) {
            if (!is_array($body['notizen'])) { Response::error('Feld "notizen" muss ein Objekt sein.', 422); }
            $this->notizenSchreiben($id, $body['notizen']);
        }

        if (array_key_exists('fristErinnerungen', $body)) {
            if (!is_array($body['fristErinnerungen'])) { Response::error('Feld "fristErinnerungen" muss ein Objekt sein.', 422); }
            $pdo->prepare('DELETE FROM vertraege_erinnerungen WHERE vertrag_id = :id')->execute(['id' => $id]);
            $ins = $pdo->prepare('INSERT INTO vertraege_erinnerungen (vertrag_id, frist_art, typ, anzahl, einheit, datum, kanal_email, kanal_chat, empfaenger_kuerzel, kunden_kontakte) VALUES (:v, :art, :typ, :n, :e, :d, :ke, :kc, :emp, :kk)');
            foreach ($body['fristErinnerungen'] as $art => $liste) {
                if (!in_array($art, K::VERTRAG_FRIST_ARTEN, true)) { Response::error("Unbekannte Fristart \"$art\".", 422); }
                $this->liste($liste, 'fristErinnerungen.' . $art);
                foreach ($liste as $e) {
                    $typ = $e['typ'] ?? 'vorher';
                    if (!in_array($typ, ['vorher', 'fest'], true)) { Response::error('Erinnerung mit unbekanntem Typ.', 422); }
                    $einheit = $e['einheit'] ?? 'Wochen';
                    if (!in_array($einheit, K::FRIST_ERINNERUNG_EINHEITEN, true)) { Response::error('Erinnerung mit unbekannter Einheit.', 422); }
                    $datum = $this->datum($e['datum'] ?? null, 'Datum der Erinnerung');
                    if ($typ === 'fest' && $datum === null) { Response::error('Eine feste Erinnerung braucht ein Datum.', 422); }
                    $empf = array_values(array_map('strval', (array) ($e['empfaenger'] ?? [])));
                    $kk = array_values(array_map('strval', (array) ($e['kundenKontakte'] ?? [])));
                    $ins->execute([
                        'v' => $id, 'art' => $art, 'typ' => $typ, 'n' => max(0, (int) ($e['anzahl'] ?? 0)), 'e' => $einheit, 'd' => $datum,
                        'ke' => !empty($e['kanaele']['email']) ? 1 : 0, 'kc' => !empty($e['kanaele']['chat']) ? 1 : 0,
                        'emp' => json_encode($empf, JSON_UNESCAPED_UNICODE), 'kk' => json_encode($kk, JSON_UNESCAPED_UNICODE),
                    ]);
                }
            }
        }
    }

    private function notizenSchreiben(int $id, array $notizen): void
    {
        $pdo = $this->pdo();
        $pdo->prepare('DELETE FROM vertraege_notizen WHERE vertrag_id = :id')->execute(['id' => $id]);
        $ins = $pdo->prepare('INSERT INTO vertraege_notizen (vertrag_id, feld_key, quelle, text) VALUES (:v, :k, :q, :t)');
        foreach ($notizen as $key => $n) {
            $quelle = $this->textOderNull($n['quelle'] ?? null);
            $text = $this->textOderNull($n['text'] ?? null);
            if ($quelle === null && $text === null) { continue; }
            if (!preg_match('/^[A-Za-z0-9_]{1,60}$/', (string) $key)) { Response::error("Ungültiger Feldschlüssel \"$key\".", 422); }
            $ins->execute(['v' => $id, 'k' => (string) $key, 'q' => $quelle, 't' => $text]);
        }
    }

    /** @param int[] $ids */
    private function kinderLaden(array $ids): array
    {
        $out = ['flaechen' => [], 'staffeln' => [], 'ansprechpartner' => [], 'notizen' => [], 'erinnerungen' => []];
        if (!$ids) { return $out; }
        $in = implode(',', array_map('intval', $ids));
        $pdo = $this->pdo();
        foreach ($pdo->query("SELECT * FROM vertraege_flaechen WHERE vertrag_id IN ($in) ORDER BY vertrag_id, position, id") as $r) { $out['flaechen'][(int) $r['vertrag_id']][] = $r; }
        foreach ($pdo->query("SELECT * FROM vertraege_staffeln WHERE vertrag_id IN ($in) ORDER BY vertrag_id, position, id") as $r) { $out['staffeln'][(int) $r['vertrag_id']][] = $r; }
        foreach ($pdo->query("SELECT * FROM vertraege_ansprechpartner WHERE vertrag_id IN ($in) ORDER BY vertrag_id, position, id") as $r) { $out['ansprechpartner'][(int) $r['vertrag_id']][] = $r; }
        foreach ($pdo->query("SELECT * FROM vertraege_notizen WHERE vertrag_id IN ($in)") as $r) { $out['notizen'][(int) $r['vertrag_id']][] = $r; }
        foreach ($pdo->query("SELECT * FROM vertraege_erinnerungen WHERE vertrag_id IN ($in) ORDER BY vertrag_id, id") as $r) { $out['erinnerungen'][(int) $r['vertrag_id']][] = $r; }
        return $out;
    }

    // ------------------------------------------------------------------ Hilfen

    private function findOrFail(int $id): array
    {
        $stmt = $this->pdo()->prepare('SELECT * FROM vertraege WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Vertrag nicht gefunden.', 404);
        }
        return $row;
    }

    private function istJa(mixed $v): bool
    {
        return $v === true || $v === 1 || $v === '1' || $v === 'ja';
    }

    /**
     * Fachliche Regeln, die das Formular der Oberfläche ebenfalls prüft. Sie gelten hier erneut, damit die
     * Schnittstelle unabhängig vom Aufrufer dasselbe Urteil fällt. $v enthält den gesamten Vertrag in API-Schreibweise.
     */
    private function fachlichPruefen(array $v): void
    {
        $z = fn($k) => $this->zahl($v[$k] ?? 0, $k);
        if (empty($v['mietbeginn'])) { Response::error('Bitte einen Mietbeginn angeben.', 422); }
        if ($z('laufzeit') <= 0) { Response::error('Bitte eine Laufzeit angeben.', 422); }
        if ($this->istJa($v['autoVerlaengerung'] ?? false) && $z('autoVerlWert') <= 0) {
            Response::error('Bitte angeben, um wie lange sich der Vertrag automatisch verlängert.', 422);
        }
        if ($z('optAusgeuebt') > $z('optAnzahl')) {
            Response::error('Es können nicht mehr Optionen ausgeübt sein als vorhanden.', 422);
        }
        if ($this->istJa($v['staffelmiete'] ?? false)) {
            $gueltig = false;
            foreach ((array) ($v['staffeln'] ?? []) as $s) {
                if (!is_array($s)) { continue; }
                $hatWert = $this->zahl($s['wert'] ?? 0, 'Staffelwert') > 0;
                $hatZeit = trim((string) ($s['startdatum'] ?? '')) !== '' || trim((string) ($s['ausloeser'] ?? '')) !== '';
                if ($hatWert && $hatZeit) { $gueltig = true; break; }
            }
            if (!$gueltig) { Response::error('Bitte mindestens eine Staffel mit Betrag und Startdatum oder Auslöser eintragen.', 422); }
        }
        if ($this->istJa($v['indexierung'] ?? false)) {
            $u = array_key_exists('indexUmfang', $v) ? $this->zahl($v['indexUmfang'], 'indexUmfang') : 100.0;
            if ($u <= 0 || $u > 100) { Response::error('Die Weitergabe der Änderung muss zwischen 1 und 100 Prozent liegen.', 422); }
        }
    }

    private function mandantPruefen(int $id): void
    {
        $s = $this->pdo()->prepare('SELECT 1 FROM mandanten WHERE id = :id');
        $s->execute(['id' => $id]);
        if (!$s->fetchColumn()) {
            Response::error('Mandant nicht gefunden.', 422);
        }
    }

    private function refId(array $body, string $key): ?int
    {
        return (isset($body[$key]) && $body[$key] !== '') ? (int) $body[$key] : null;
    }

    private function liste(mixed $v, string $name): void
    {
        if (!is_array($v) || (count($v) && array_keys($v) !== range(0, count($v) - 1))) {
            Response::error("Feld \"$name\" muss eine Liste sein.", 422);
        }
    }

    private function textOderNull(mixed $v): ?string
    {
        if ($v === null) { return null; }
        $s = trim((string) $v);
        return $s === '' ? null : $s;
    }

    private function zahl(mixed $v, string $name): float
    {
        if ($v === '' || $v === null) { return 0.0; }
        if (is_string($v)) { $v = str_replace(',', '.', $v); }
        if (!is_numeric($v)) { Response::error("\"$name\" muss eine Zahl sein.", 422); }
        return (float) $v;
    }

    private function datum(mixed $v, string $name): ?string
    {
        if ($v === null || $v === '') { return null; }
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $v);
        if (!$d || $d->format('Y-m-d') !== $v) { Response::error("\"$name\" ist kein gültiges Datum (JJJJ-MM-TT).", 422); }
        return $d->format('Y-m-d');
    }

    /** Prüft und wandelt einen Wert gemäß der Felddefinition. */
    private function wert(string $apiKey, mixed $v): mixed
    {
        [$col, $typ, $erlaubt] = self::FELDER[$apiKey] + [2 => null];
        switch ($typ) {
            case self::T_BOOL:
                if (is_bool($v)) { return $v ? 1 : 0; }
                if ($v === 'ja' || $v === 1 || $v === '1') { return 1; }
                if ($v === 'nein' || $v === 0 || $v === '0' || $v === '' || $v === null) { return 0; }
                Response::error("\"$apiKey\" muss ja oder nein sein.", 422);
            case self::T_INT:
                $z = $this->zahl($v, $apiKey);
                if ($z < 0) { Response::error("\"$apiKey\" darf nicht negativ sein.", 422); }
                return (int) round($z);
            case self::T_DEC:
                return $this->zahl($v, $apiKey);
            case self::T_DATE:
                return $this->datum($v, $apiKey);
            case self::T_MONTH:
                if ($v === null || $v === '') { return null; }
                if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $v)) { Response::error("\"$apiKey\" muss im Format JJJJ-MM angegeben werden.", 422); }
                return (string) $v;
            default:
                if ($erlaubt !== null) {
                    if (!in_array($v, $erlaubt, true)) { Response::error("Ungültiger Wert für \"$apiKey\".", 422); }
                    return $v;
                }
                return $this->textOderNull($v);
        }
    }

    private function toApi(array $row, array $kinder): array
    {
        $id = (int) $row['id'];
        $out = [
            'id' => $id,
            'vertragsId' => $id,
            'mandantId' => (int) $row['mandant_id'],
            'standortId' => $row['standort_id'] !== null ? (int) $row['standort_id'] : null,
            'counterpartId' => $row['counterpart_id'] !== null ? (int) $row['counterpart_id'] : null,
        ];
        foreach (self::FELDER as $apiKey => [$col, $typ]) {
            $v = $row[$col];
            $out[$apiKey] = match ($typ) {
                self::T_BOOL => (bool) $v,
                self::T_INT => (int) $v,
                self::T_DEC => (float) $v,
                self::T_STR => $v ?? '',
                default => $v, // Datum und Monat bleiben null, wenn leer
            };
        }
        $out['aenderung'] = $row['aenderung'];
        $out['archiviert'] = (bool) $row['archiviert'];

        $out['flaechen'] = array_map(fn($f) => ['lage' => $f['lage'], 'qm' => (float) $f['qm'], 'bem' => $f['bemerkung'] ?? ''], $kinder['flaechen'][$id] ?? []);
        $out['staffeln'] = array_map(fn($s) => ['wert' => (float) $s['wert'], 'startdatum' => $s['startdatum'] ?? '', 'ausloeser' => $s['ausloeser'] ?? ''], $kinder['staffeln'][$id] ?? []);
        if ($row['ansprechpartner_individuell']) {
            $out['ansprechpartner'] = array_map(function ($z) {
                $e = [];
                foreach (self::AP_FELDER as $c) { $e[$c] = $z[$c] ?? ''; }
                return $e;
            }, $kinder['ansprechpartner'][$id] ?? []);
        } else {
            $out['ansprechpartner'] = null;
        }
        $notizen = [];
        foreach ($kinder['notizen'][$id] ?? [] as $n) { $notizen[$n['feld_key']] = ['quelle' => $n['quelle'] ?? '', 'text' => $n['text'] ?? '']; }
        $out['notizen'] = (object) $notizen;
        $er = [];
        foreach (K::VERTRAG_FRIST_ARTEN as $art) { $er[$art] = []; }
        foreach ($kinder['erinnerungen'][$id] ?? [] as $e) {
            $er[$e['frist_art']][] = [
                'id' => 'FE-V' . $e['id'], 'typ' => $e['typ'], 'anzahl' => (int) $e['anzahl'], 'einheit' => $e['einheit'], 'datum' => $e['datum'] ?? '',
                'kanaele' => ['email' => (bool) $e['kanal_email'], 'chat' => (bool) $e['kanal_chat']],
                'empfaenger' => json_decode($e['empfaenger_kuerzel'], true) ?: [],
                'kundenKontakte' => json_decode($e['kunden_kontakte'], true) ?: [],
            ];
        }
        $out['fristErinnerungen'] = $er;

        $out['abgeleitet'] = [
            'mietende' => Vertragsregeln::mietende($out),
            'mietendeInkl' => Vertragsregeln::mietendeInkl($out),
            'optionsfristEnde' => Vertragsregeln::optionsfristEnde($out),
            'kuendigungBis' => Vertragsregeln::kuendigungBis($out),
            'indexNaechste' => Vertragsregeln::indexNaechste($out),
            'fristen' => Vertragsregeln::fristen($out),
        ];
        return $out;
    }
}
