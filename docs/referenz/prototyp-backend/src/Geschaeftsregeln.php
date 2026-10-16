<?php
declare(strict_types=1);

namespace Treaty;

use DateTimeImmutable;

/**
 * Portierung der fachlichen Kernregeln aus part5_bk.js (WV-Datum-Regel bei Statuswechsel,
 * Farbenlehre/Ampel) und part6c_office.js (Rechnungsberechnung). Gilt laut Quellcode-Kommentar
 * gleichermaßen für Betriebskosten und Mieten (computeBkWvDatum() wird dort trotz des "Bk"-Namens
 * von beiden Modulen genutzt).
 */
final class Geschaeftsregeln
{
    // Farbenlehre je Status: Arbeitstage seit dem letzten Statuswechsel (aenderung), NICHT
    // Kalendertage bis zum WV-Datum - das WV-Datum folgt einer eigenen, unabhängigen Regel
    // (siehe STATUS_WV_RULES) und ist deshalb kein verlässlicher Farb-Anker.
    public const COLOR_THRESHOLDS = [
        'NEU' => ['gruenBis' => 5, 'gelbBis' => 10],
        'in Bearbeitung' => ['gruenBis' => 1, 'gelbBis' => 5],
        'AW eingegangen MDT' => ['gruenBis' => 1, 'gelbBis' => 5],
        'AW eingegangen VWT' => ['gruenBis' => 5, 'gelbBis' => 10],
        'warte auf MDT' => ['gruenBis' => 10, 'gelbBis' => 13],
        'warte auf Verwalter' => ['gruenBis' => 10, 'gelbBis' => 13],
        'warte auf Dritten' => ['gruenBis' => 10, 'gelbBis' => 13],
        '1. Erinnerung' => ['gruenBis' => 20, 'gelbBis' => 23],
        '2. Erinnerung' => ['gruenBis' => 10, 'gelbBis' => 13],
        '3. Erinnerung' => ['gruenBis' => 10, 'gelbBis' => 13],
        '4. Erinnerung' => ['gruenBis' => 10, 'gelbBis' => 13],
    ];

    // WV-Datum-Regel je Status bei Statuswechsel: Arbeitstage (Mo-Fr) ab dem Wechseltag, bei
    // manchen Status zusätzlich auf den nächsten Donnerstag gelegt. Passend zur allgemeinen
    // ADH-Regel, dass gesetzte Fristen stets auf einen Donnerstag fallen.
    public const STATUS_WV_RULES = [
        'NEU' => ['tage' => 10, 'donnerstag' => false],
        'in Bearbeitung' => ['tage' => 5, 'donnerstag' => false],
        'AW eingegangen MDT' => ['tage' => 5, 'donnerstag' => false],
        'AW eingegangen VWT' => ['tage' => 10, 'donnerstag' => false],
        'warte auf MDT' => ['tage' => 10, 'donnerstag' => false],
        'warte auf Verwalter' => ['tage' => 20, 'donnerstag' => true],
        'warte auf Dritten' => ['tage' => 10, 'donnerstag' => false],
        '1. Erinnerung' => ['tage' => 20, 'donnerstag' => true],
        '2. Erinnerung' => ['tage' => 10, 'donnerstag' => true],
        '3. Erinnerung' => ['tage' => 10, 'donnerstag' => true],
        '4. Erinnerung' => ['tage' => 15, 'donnerstag' => true],
    ];

    public static function addBusinessDays(DateTimeImmutable $from, int $n): DateTimeImmutable
    {
        $d = $from;
        $added = 0;
        while ($added < $n) {
            $d = $d->modify('+1 day');
            $dow = (int) $d->format('N'); // 1=Mo ... 7=So
            if ($dow < 6) {
                $added++;
            }
        }
        return $d;
    }

    public static function nextThursdayOnOrAfter(DateTimeImmutable $dt): DateTimeImmutable
    {
        $dow = (int) $dt->format('N'); // 1=Mo ... 7=So, Donnerstag=4
        $diff = (4 - $dow + 7) % 7;
        return $dt->modify("+{$diff} days");
    }

    /**
     * Neues WV-Datum bei Statuswechsel, oder null wenn der Status keine eigene Regel hat
     * (z. B. "abgeschlossen" - siehe applyWvDatumFuerStatus).
     */
    public static function computeWvDatum(string $status, DateTimeImmutable $from): ?string
    {
        $rule = self::STATUS_WV_RULES[$status] ?? null;
        if ($rule === null) {
            return null;
        }
        $d = self::addBusinessDays($from, $rule['tage']);
        if ($rule['donnerstag']) {
            $d = self::nextThursdayOnOrAfter($d);
        }
        return $d->format('Y-m-d');
    }

    /**
     * Liefert das neue WV-Datum für einen (neuen) Status, oder null wenn der Fall damit kein
     * WV-Datum mehr hat (abgeschlossen).
     */
    public static function wvDatumFuerStatus(string $status, DateTimeImmutable $from): ?string
    {
        if ($status === 'abgeschlossen') {
            return null;
        }
        return self::computeWvDatum($status, $from) ?? null;
    }

    /** Arbeitstage NACH fromDate (Tag 1 = erster Arbeitstag danach) bis heute. */
    public static function businessDaysSince(string $fromDate, ?DateTimeImmutable $today = null): int
    {
        $today = $today ?? new DateTimeImmutable('today');
        $d = (new DateTimeImmutable($fromDate))->modify('+1 day');
        $count = 0;
        while ($d <= $today) {
            $dow = (int) $d->format('N');
            if ($dow < 6) {
                $count++;
            }
            $d = $d->modify('+1 day');
        }
        return $count;
    }

    /** Ampelfarbe ("green"|"yellow"|"red") nach Farbenlehre. */
    public static function ampel(string $status, string $aenderung, ?DateTimeImmutable $today = null): string
    {
        if ($status === 'abgeschlossen') {
            return 'green';
        }
        $t = self::COLOR_THRESHOLDS[$status] ?? self::COLOR_THRESHOLDS['warte auf MDT'];
        $days = self::businessDaysSince($aenderung, $today);
        if ($days <= $t['gruenBis']) {
            return 'green';
        }
        if ($days <= $t['gelbBis']) {
            return 'yellow';
        }
        return 'red';
    }

    /**
     * Rechnungsbasis für einen Mandanten im Zeitraum [von, bis] (jeweils ISO-Datum), portiert aus
     * computeRechnungBasis() (part6c_office.js). $leistungen: aktive Leistungskatalog-Positionen des
     * Mandanten [{modul, type, price, aktiv}]. $gruppierteFaelle: abgeschlossene, gruppierte
     * Betriebskosten-Fälle des Mandanten im Zeitraum [{gruppierterWert}]. $zeitEintraege:
     * abrechenbare Zeitbuchungen im Zeitraum [{aufgabenTyp, minuten}]. $ersparnisSumme: Summe
     * ersparnis abgeschlossener BK-Fälle des Mandanten im Zeitraum.
     */
    public static function rechnungsbasis(array $leistungen, array $gruppierteFaelle, array $zeitEintraege, float $ersparnisSumme): array
    {
        $pauschaleFix = round(array_sum(array_map(
            fn($l) => $l['aktiv'] && $l['type'] === 'Pauschale' ? (float) $l['price'] : 0.0,
            $leistungen
        )), 2);

        $pruefgebuehrPositionen = array_values(array_filter($leistungen, fn($l) => $l['aktiv'] && $l['type'] === 'Prüfgebühr'));
        $pruefgebuehrFix = round(array_sum(array_map(fn($l) => (float) $l['price'], $pruefgebuehrPositionen)), 2);
        $pruefgebuehrSatz = $pruefgebuehrPositionen ? (float) $pruefgebuehrPositionen[0]['price'] : 0.0;

        $pruefgebuehrGruppiert = round(array_sum(array_map(
            fn($f) => ((float) ($f['gruppierterWert'] ?? 0)) * $pruefgebuehrSatz,
            $gruppierteFaelle
        )), 2);
        $pruefgebuehrIstGruppiert = count($gruppierteFaelle) > 0;
        $pruefungspauschale = $pruefgebuehrIstGruppiert ? $pruefgebuehrGruppiert : $pruefgebuehrFix;

        $grundgebuehr = round($pauschaleFix + $pruefungspauschale, 2);

        $zeithonorar = 0.0;
        foreach ($zeitEintraege as $z) {
            $l = null;
            foreach ($leistungen as $cand) {
                if ($cand['modul'] === $z['aufgabenTyp'] && $cand['aktiv'] && $cand['type'] === 'Stundensatz') {
                    $l = $cand;
                    break;
                }
            }
            if ($l !== null) {
                $zeithonorar += ($z['minuten'] / 60) * (float) $l['price'];
            }
        }
        $zeithonorar = round($zeithonorar, 2);

        $erfolgsLeistung = null;
        foreach ($leistungen as $l) {
            if ($l['aktiv'] && $l['type'] === '%') {
                $erfolgsLeistung = $l;
                break;
            }
        }
        $erfolgshonorarSatz = $erfolgsLeistung ? (float) $erfolgsLeistung['price'] : 0.0;
        $erfolgshonorar = round($ersparnisSumme * $erfolgshonorarSatz / 100, 2);

        return [
            'grundgebuehr' => $grundgebuehr,
            'pauschaleFix' => $pauschaleFix,
            'pruefgebuehrFix' => $pruefgebuehrFix,
            'pruefgebuehrSatz' => $pruefgebuehrSatz,
            'pruefungspauschale' => $pruefungspauschale,
            'pruefgebuehrIstGruppiert' => $pruefgebuehrIstGruppiert,
            'gruppierteAnzahlFaelle' => count($gruppierteFaelle),
            'zeithonorar' => $zeithonorar,
            'ersparnisSumme' => round($ersparnisSumme, 2),
            'erfolgshonorarSatz' => $erfolgshonorarSatz,
            'erfolgshonorar' => $erfolgshonorar,
        ];
    }

    /**
     * Reisekosten-Deckelung + Gesamtbetrag, portiert aus dem Rechnungs-Anlegen-Dialog
     * (part6c_office.js): Reisekosten werden auf die vertragliche Kappungsgrenze des Mandanten
     * gedeckelt (reisekostenIst > kappung -> gedeckelt, abgerechnet wird min(ist, kappung)).
     */
    public static function rechnungGesamt(float $grundgebuehr, float $zeithonorar, float $reisekostenIst, float $kappung, float $erfolgshonorar): array
    {
        $reisekosten = min($reisekostenIst, $kappung);
        $gedeckelt = $reisekostenIst > $kappung;
        $gesamt = round($grundgebuehr + $zeithonorar + $reisekosten + $erfolgshonorar, 2);
        return [
            'reisekostenIst' => round($reisekostenIst, 2),
            'reisekosten' => round($reisekosten, 2),
            'reisekostenKappung' => round($kappung, 2),
            'reisekostenGedeckelt' => $gedeckelt,
            'gesamtbetrag' => $gesamt,
        ];
    }
}
