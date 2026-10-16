<?php
declare(strict_types=1);

namespace Treaty;

/**
 * Portierung der Rechteprüfung aus part3_core.js (hatZugriff/hatZusatzrecht/hatZugriffMitarbeiter).
 * Eine Person hat Zugriff auf einen Bereich, sobald ENTWEDER die eigene Berechtigungsstufe laut
 * RECHTEMATRIX erlaubt ist ODER der Bereichsschlüssel unter ihren individuellen Zusatzrechten
 * steht. Zusatzrechte selbst werden bewusst nicht protokolliert (siehe mitarbeiter_zusatzrechte im
 * Schema und PRD Abschnitt 3 - fachlich so entschieden, kein Nachtrag hier).
 */
final class Rechte
{
    public static function hatZugriff(string $bereichKey, string $berechtigung): bool
    {
        $erlaubt = Konstanten::RECHTEMATRIX[$bereichKey] ?? null;
        if ($erlaubt === null) {
            // Bereich nicht in der Matrix -> für jede Berechtigungsstufe offen (Standardfall).
            return true;
        }
        return in_array($berechtigung, $erlaubt, true);
    }

    /** @param string[] $zusatzrechte */
    public static function hatZusatzrecht(string $bereichKey, array $zusatzrechte): bool
    {
        return in_array($bereichKey, $zusatzrechte, true);
    }

    /**
     * @param array{berechtigung:string, zusatzrechte:string[]} $mitarbeiter
     */
    public static function hatZugriffMitarbeiter(string $bereichKey, array $mitarbeiter): bool
    {
        return self::hatZugriff($bereichKey, $mitarbeiter['berechtigung'])
            || self::hatZusatzrecht($bereichKey, $mitarbeiter['zusatzrechte']);
    }

    /**
     * Zeiterfassung ist als Bereich für jede Berechtigungsstufe zugänglich, zeigt einer
     * Sachbearbeiter/in dort aber nur die eigenen Zeitbuchungen (nicht die aller Mitarbeiter),
     * außer bei individuellem Zusatzrecht "zeiterfassung_alle".
     * @param array{berechtigung:string, zusatzrechte:string[]} $mitarbeiter
     */
    public static function zeiterfassungNurEigene(array $mitarbeiter): bool
    {
        if (self::hatZusatzrecht('zeiterfassung_alle', $mitarbeiter['zusatzrechte'])) {
            return false;
        }
        return $mitarbeiter['berechtigung'] === 'Sachbearbeiter/in';
    }

    /**
     * Aufgaben-Sichtbarkeit: Administrator sieht alle, Sachbearbeiter/in nur die ihr/ihm selbst
     * oder "ADH" (alle) zugewiesenen Aufgaben.
     * @param array{k:string, berechtigung:string} $mitarbeiter
     */
    public static function aufgabenSichtbarkeitBedingung(array $mitarbeiter): ?array
    {
        if ($mitarbeiter['berechtigung'] === 'Administrator') {
            return null; // keine Einschränkung
        }
        return [$mitarbeiter['k'], Konstanten::ADH_ZUWEISUNG];
    }
}
