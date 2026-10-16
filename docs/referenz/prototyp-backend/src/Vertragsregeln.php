<?php
declare(strict_types=1);

namespace Treaty;

use DateTimeImmutable;

/**
 * Berechnete Termine des Vertragsmanagements, portiert aus part5c_vertraege.js (vtrMietende() und
 * Nachbarn), damit Backend und Oberfläche dieselben Fristen kennen. Eingabe ist jeweils eine
 * Vertragszeile im API-Format (camelCase, Booleans als true/false), siehe VertraegeController.
 *
 * Fachliche Regeln
 * - Mietende = Kündigung zum (wenn gekündigt), sonst Mietbeginn plus Laufzeit minus ein Tag plus
 *   die bereits ausgeübten Optionen. Bei automatischer Verlängerung rückt ein bereits verstrichenes
 *   Ende um jeweils einen Verlängerungszeitraum weiter, bis es wieder in der Zukunft liegt.
 * - Optionsfrist = Mietende minus Optionsfrist in Monaten, solange noch Optionen offen sind.
 * - Kündigung bis = Mietende minus Kündigungsvorlauf, nur bei automatischer Verlängerung.
 * - Nächste Indexanpassung = spätere von "erste Anpassung" und "letzte Anpassung plus Rhythmus".
 * Die vertraglichen Fristen werden bewusst nicht auf einen Donnerstag verschoben.
 */
final class Vertragsregeln
{
    public static function monate(int|float|string|null $wert, ?string $einheit): int
    {
        return (int) round((float) ($wert ?? 0) * ($einheit === 'Monate' ? 1 : 12));
    }

    /** Monatsarithmetik mit Anpassung an die Monatslänge (31.01. plus ein Monat ergibt den 28./29.02.). */
    public static function addMonths(string $iso, int $n): string
    {
        $d = new DateTimeImmutable($iso);
        $tag = (int) $d->format('j');
        $ersterDesMonats = $d->setDate((int) $d->format('Y'), (int) $d->format('n'), 1)->modify(($n >= 0 ? '+' : '') . $n . ' month');
        $letzter = (int) $ersterDesMonats->format('t');
        return $ersterDesMonats->setDate((int) $ersterDesMonats->format('Y'), (int) $ersterDesMonats->format('n'), min($tag, $letzter))->format('Y-m-d');
    }

    /** Wie addMonths(), bleibt aber am Monatsende, wenn das Ausgangsdatum ein Monatsletzter war. */
    public static function addMonthsEnde(string $iso, int $n): string
    {
        $d = new DateTimeImmutable($iso);
        if ((int) $d->format('j') !== (int) $d->format('t')) {
            return self::addMonths($iso, $n);
        }
        $ersterDesMonats = $d->setDate((int) $d->format('Y'), (int) $d->format('n'), 1)->modify(($n >= 0 ? '+' : '') . $n . ' month');
        return $ersterDesMonats->format('Y-m-t');
    }

    public static function basisEnde(array $v): ?string
    {
        $m = self::monate($v['laufzeit'] ?? 0, $v['laufzeitEinheit'] ?? 'Jahre');
        if (empty($v['mietbeginn']) || $m === 0) {
            return null;
        }
        return (new DateTimeImmutable(self::addMonths($v['mietbeginn'], $m)))->modify('-1 day')->format('Y-m-d');
    }

    public static function mietende(array $v, ?DateTimeImmutable $heute = null): ?string
    {
        if (!empty($v['gekuendigtZum'])) {
            return $v['gekuendigtZum'];
        }
        $basis = self::basisEnde($v);
        if ($basis === null) {
            return null;
        }
        $ende = self::addMonthsEnde($basis, (int) ($v['optAusgeuebt'] ?? 0) * self::monate($v['optLZ'] ?? 0, $v['optLZEinheit'] ?? 'Jahre'));
        $per = self::monate($v['autoVerlWert'] ?? 0, $v['autoVerlEinheit'] ?? 'Jahre');
        if (!empty($v['autoVerlaengerung']) && $per > 0) {
            $h = ($heute ?? new DateTimeImmutable('today'))->format('Y-m-d');
            for ($i = 0; $ende < $h && $i < 200; $i++) {
                $ende = self::addMonthsEnde($ende, $per);
            }
        }
        return $ende;
    }

    public static function mietendeInkl(array $v, ?DateTimeImmutable $heute = null): ?string
    {
        if (!empty($v['gekuendigtZum'])) {
            return $v['gekuendigtZum'];
        }
        $basis = self::basisEnde($v);
        if ($basis === null) {
            return null;
        }
        $inkl = self::addMonthsEnde($basis, (int) ($v['optAnzahl'] ?? 0) * self::monate($v['optLZ'] ?? 0, $v['optLZEinheit'] ?? 'Jahre'));
        $aktuell = self::mietende($v, $heute);
        return ($aktuell !== null && $aktuell > $inkl) ? $aktuell : $inkl;
    }

    public static function optionenOffen(array $v): int
    {
        return max(0, (int) ($v['optAnzahl'] ?? 0) - (int) ($v['optAusgeuebt'] ?? 0));
    }

    public static function optionsfristEnde(array $v, ?DateTimeImmutable $heute = null): ?string
    {
        $ende = self::mietende($v, $heute);
        if ($ende === null || self::optionenOffen($v) === 0 || empty($v['optFristMonate']) || !empty($v['gekuendigtZum'])) {
            return null;
        }
        return self::addMonths($ende, -(int) $v['optFristMonate']);
    }

    public static function kuendigungBis(array $v, ?DateTimeImmutable $heute = null): ?string
    {
        $ende = self::mietende($v, $heute);
        if ($ende === null || empty($v['autoVerlaengerung']) || empty($v['kuendigungVorlaufMonate']) || !empty($v['gekuendigtZum'])) {
            return null;
        }
        return self::addMonths($ende, -(int) $v['kuendigungVorlaufMonate']);
    }

    public static function indexRhythmusMonate(array $v): int
    {
        return ['vierteljährlich' => 3, 'halbjährlich' => 6, 'jährlich' => 12][$v['indexAnpassung'] ?? ''] ?? 0;
    }

    public static function indexNaechste(array $v): ?string
    {
        if (empty($v['indexierung'])) {
            return null;
        }
        $k = [];
        if (!empty($v['indexErste'])) {
            $k[] = $v['indexErste'];
        }
        if (!empty($v['indexLetzte'])) {
            $r = self::indexRhythmusMonate($v);
            $k[] = $r ? self::addMonths($v['indexLetzte'], $r) : $v['indexLetzte'];
        }
        if (!$k) {
            return null;
        }
        sort($k);
        return end($k);
    }

    /** Termin je Fristart (option, kuendigung, mietende, index), null wenn nicht berechenbar. */
    public static function fristDatum(string $art, array $v, ?DateTimeImmutable $heute = null): ?string
    {
        return match ($art) {
            'option' => self::optionsfristEnde($v, $heute),
            'kuendigung' => self::kuendigungBis($v, $heute),
            'mietende' => self::mietende($v, $heute),
            'index' => self::indexNaechste($v),
            default => null,
        };
    }

    /** Zieltermin einer Erinnerung. Bewusst nicht auf einen Donnerstag verschoben (vertragliche Frist). */
    public static function erinnerungZieldatum(array $e, ?string $fristDatum): ?string
    {
        if (($e['typ'] ?? 'vorher') === 'fest') {
            return $e['datum'] ?: null;
        }
        if ($fristDatum === null) {
            return null;
        }
        $n = (int) ($e['anzahl'] ?? 0);
        $d = new DateTimeImmutable($fristDatum);
        return match ($e['einheit'] ?? 'Tage') {
            'Wochen' => $d->modify("-" . (7 * $n) . " day")->format('Y-m-d'),
            'Monate' => $d->modify("-$n month")->format('Y-m-d'),
            default => $d->modify("-$n day")->format('Y-m-d'),
        };
    }

    /** Alle noch offenen vertraglichen Fristen für Liste und Kennzahlen (Option, Kündigung, Mietende). */
    public static function fristen(array $v, ?DateTimeImmutable $heute = null): array
    {
        if (in_array($v['status'] ?? '', ['vorgeschlagen', 'archiviert'], true) || !empty($v['archiviert'])) {
            return [];
        }
        $out = [];
        foreach ([['option', 'Option bis'], ['kuendigung', 'Kündigung bis'], ['mietende', 'Mietende']] as [$art, $label]) {
            $datum = self::fristDatum($art, $v, $heute);
            if ($datum !== null) {
                $out[] = ['art' => $art, 'label' => $label, 'datum' => $datum];
            }
        }
        return $out;
    }
}
