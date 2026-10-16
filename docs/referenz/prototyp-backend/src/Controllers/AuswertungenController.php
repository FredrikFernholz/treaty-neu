<?php
declare(strict_types=1);

namespace Treaty\Controllers;

use Treaty\Auth;
use Treaty\Response;

/**
 * Info-Center - Auswertungen: aggregierte Kennzahlen über alle Mandanten/Mitarbeiter hinweg,
 * daher nur für Administrator bzw. per Zusatzrecht "auswertungen" zugänglich (RECHTEMATRIX).
 * Deckt die drei im PRD genannten Auswertungsarten ab: Fallstatistiken, Finanzkennzahlen,
 * Auslastung. Die je Bericht frei konfigurierbaren, gespeicherten Spaltenberichte (Excel-/
 * PDF-Export mit Auswahldialog) bleiben Sache der Frontend-Variante, die auf diesen Rohdaten
 * aufsetzt - hier liefert das Backend nur die zugrunde liegenden aggregierten Zahlen.
 */
final class AuswertungenController extends BaseController
{
    public function fallstatistiken(array $args, array $body): void
    {
        Auth::requireBereich('auswertungen');
        $pdo = $this->pdo();

        $bkStatus = $pdo->query(
            "SELECT status, COUNT(*) anzahl FROM betriebskosten WHERE archiviert = 0 GROUP BY status"
        )->fetchAll();
        $mietenStatus = $pdo->query(
            "SELECT status, COUNT(*) anzahl FROM mieten WHERE archiviert = 0 GROUP BY status"
        )->fetchAll();
        $bkProMandant = $pdo->query(
            "SELECT m.name mandant, COUNT(*) anzahl FROM betriebskosten b JOIN mandanten m ON m.id = b.mandant_id
             WHERE b.archiviert = 0 GROUP BY m.name ORDER BY anzahl DESC"
        )->fetchAll();
        $aufgabenStatus = $pdo->query(
            "SELECT status, COUNT(*) anzahl FROM aufgaben GROUP BY status"
        )->fetchAll();

        Response::json(['data' => [
            'betriebskostenNachStatus' => $bkStatus,
            'mietenNachStatus' => $mietenStatus,
            'betriebskostenProMandant' => $bkProMandant,
            'aufgabenNachStatus' => $aufgabenStatus,
        ]]);
    }

    public function finanzkennzahlen(array $args, array $body): void
    {
        Auth::requireBereich('auswertungen');
        $von = $_GET['von'] ?? date('Y-01-01');
        $bis = $_GET['bis'] ?? date('Y-12-31');
        $pdo = $this->pdo();

        $stmt = $pdo->prepare(
            "SELECT COALESCE(SUM(ersparnis), 0) ersparnisSumme, COALESCE(SUM(ergebnis), 0) ergebnisSumme,
                    COUNT(*) abgeschlosseneFaelle
             FROM betriebskosten WHERE status = 'abgeschlossen' AND aenderung BETWEEN :von AND :bis"
        );
        $stmt->execute(['von' => $von, 'bis' => $bis]);
        $bk = $stmt->fetch();

        $rStmt = $pdo->prepare(
            "SELECT status, COUNT(*) anzahl, COALESCE(SUM(gesamtbetrag), 0) summe
             FROM rechnungen WHERE erstellt_am BETWEEN :von AND :bis GROUP BY status"
        );
        $rStmt->execute(['von' => $von, 'bis' => $bis]);
        $rechnungen = $rStmt->fetchAll();

        Response::json(['data' => [
            'zeitraum' => ['von' => $von, 'bis' => $bis],
            'betriebskosten' => [
                'ersparnisSumme' => (float) $bk['ersparnisSumme'],
                'ergebnisSumme' => (float) $bk['ergebnisSumme'],
                'abgeschlosseneFaelle' => (int) $bk['abgeschlosseneFaelle'],
            ],
            'rechnungenNachStatus' => array_map(fn($r) => [
                'status' => $r['status'], 'anzahl' => (int) $r['anzahl'], 'summe' => (float) $r['summe'],
            ], $rechnungen),
        ]]);
    }

    public function auslastung(array $args, array $body): void
    {
        Auth::requireBereich('auswertungen');
        $von = $_GET['von'] ?? date('Y-m-01');
        $bis = $_GET['bis'] ?? date('Y-m-t');
        $stmt = $this->pdo()->prepare(
            "SELECT mitarbeiter_kuerzel, COUNT(*) buchungen, COALESCE(SUM(minuten), 0) minutenGesamt,
                    COALESCE(SUM(CASE WHEN abrechenbar THEN minuten ELSE 0 END), 0) minutenAbrechenbar
             FROM zeitbuchungen WHERE datum BETWEEN :von AND :bis GROUP BY mitarbeiter_kuerzel ORDER BY minutenGesamt DESC"
        );
        $stmt->execute(['von' => $von, 'bis' => $bis]);
        $rows = array_map(fn($r) => [
            'mitarbeiterKuerzel' => $r['mitarbeiter_kuerzel'], 'buchungen' => (int) $r['buchungen'],
            'minutenGesamt' => (int) $r['minutenGesamt'], 'minutenAbrechenbar' => (int) $r['minutenAbrechenbar'],
        ], $stmt->fetchAll());
        Response::json(['data' => ['zeitraum' => ['von' => $von, 'bis' => $bis], 'proMitarbeiter' => $rows]]);
    }
}
