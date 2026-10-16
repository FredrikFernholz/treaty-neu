<?php
declare(strict_types=1);

namespace Treaty;

/**
 * Feste, nicht vom Nutzer editierbare Auswahllisten - bewusst als PHP-Konstanten gehalten statt
 * als eigene Datenbanktabellen, analog zur ursprünglichen mockdata.py im Prototyp. Eine Änderung
 * dieser Listen ist eine fachliche/Code-Änderung, keine Verwaltungsaufgabe im laufenden Betrieb.
 */
final class Konstanten
{
    public const BERECHTIGUNGSSTUFEN = ['Administrator', 'Sachbearbeiter/in'];

    public const ZEICHNUNGSARTEN = ['ppa.', 'i.V.', 'i.A.', 'ohne'];

    public const STATUS_OPTIONS = [
        'NEU', 'in Bearbeitung', '1. Erinnerung', '2. Erinnerung', '3. Erinnerung', '4. Erinnerung',
        'AW eingegangen MDT', 'AW eingegangen VWT', 'warte auf MDT', 'warte auf Verwalter',
        'warte auf Dritten', 'abgeschlossen',
    ];

    public const AUFGABEN_TYPEN = [
        'Betriebskosten-Check', 'Betriebskosten-Korrespondenz', 'Extra Time Stundensatz 1',
        'Extra Time Stundensatz 2', 'Expansion', 'Kunden Orga', 'Akquise', 'Verwaltung',
        'Störung & Verwaltungsverträge', 'IT', 'Weiterentwicklung', 'Team', 'Eigen Orga',
        'Betriebskostenabrechnung-Erstellung 1', 'Betriebskosten-Analyse (Benchmarks)', 'Wertsicherungs-Check',
    ];

    public const LEISTUNGSKATALOG_TYPEN = ['%', 'Stundensatz', 'Prüfgebühr', 'Pauschale', 'Intern'];

    public const HAEUFIGKEITEN = ['Monat', 'Jahr', 'Einmalig', '-'];

    // Zentrale Rechtematrix: für jeden Bereich, welche Berechtigungsstufen zugreifen dürfen.
    // Bereiche ohne Eintrag hier sind für beide Stufen offen. Siehe Rechte.php für die Anwendung
    // inklusive individueller Zusatzrechte je Mitarbeiter.
    public const RECHTEMATRIX = [
        'betriebskosten' => self::BERECHTIGUNGSSTUFEN,
        'mieten' => self::BERECHTIGUNGSSTUFEN,
        'vertraege' => self::BERECHTIGUNGSSTUFEN,
        'aufgaben' => self::BERECHTIGUNGSSTUFEN,
        'zeiterfassung' => self::BERECHTIGUNGSSTUFEN,
        'buchhaltung' => ['Administrator'],
        'leistungskatalog' => ['Administrator'],
        'kunden' => ['Administrator'],
        'kontaktdatenbank' => self::BERECHTIGUNGSSTUFEN,
        'nutzerverwaltung' => ['Administrator'],
        'auswertungen' => ['Administrator'],
    ];

    // Bereiche, für die sich per Zusatzrecht eine individuelle Ausnahme von der Berechtigungsstufe
    // setzen lässt (Nutzerverwaltung). "zeiterfassung_alle" ist kein Rechtematrix-Bereich, sondern
    // schaltet innerhalb der für alle offenen Zeiterfassung die Sicht auf alle Mitarbeiter frei
    // (statt nur die eigenen Zeitbuchungen).
    public const ZUSATZRECHTE_OPTIONEN = [
        'buchhaltung', 'leistungskatalog', 'kunden', 'nutzerverwaltung', 'auswertungen', 'zeiterfassung_alle',
    ];

    // Auswahllisten des Vertragsmanagements, 1:1 aus den Listenblättern der Vertragsdatenbank.
    public const VERTRAG_STATUS = ['vorgeschlagen', 'aktiv', 'UMV', 'ProForma', 'gekündigt', 'archiviert'];
    public const VERTRAG_ARTEN = ['Mietvertrag', 'Erbpachtvertrag', 'Kaufvertrag', 'Maklervertrag', 'Mitnutzungsvereinbarung', 'Arbeitsvertrag'];
    public const VERTRAG_EINHEITEN = ['Jahre', 'Monate'];
    public const VERTRAG_KUENDIGUNGSFRIST = ['täglich', 'Monatsende', 'Quartalsende', 'Halbjahresende', 'Jahresende', 'Laufzeitende'];
    public const VERTRAG_ZAHLUNGSRHYTHMUS = ['monatlich', 'quartalsweise', 'halbjährlich', 'jährlich'];
    public const VERTRAG_SICHERHEIT_ART = ['Barkaution', 'Bürgschaft', 'Bankbürgschaft', 'Sparbuch/Wertpapier', 'Verpfändungserklärung'];
    public const VERTRAG_STAFFEL_ART = ['FIX', '%'];
    public const VERTRAG_INDEX_ART = ['Verbraucherpreisindex Deutschland', 'Verbraucherpreisindex Bundesland', 'Anderer Index'];
    public const VERTRAG_INDEX_KLAUSEL = ['Automatische Anpassung (Gleitklausel)', 'Anpassung auf Verlangen', 'Leistungsvorbehalt', 'Spannungsklausel'];
    public const VERTRAG_INDEX_SCHWELLE_EINHEIT = ['Prozent', 'Punkte'];
    public const VERTRAG_INDEX_ANPASSUNG = ['immer', 'vierteljährlich', 'halbjährlich', 'jährlich'];
    public const VERTRAG_INDEX_RICHTUNG = ['Erhöhung und Absenkung', 'Nur Erhöhung'];
    public const VERTRAG_INDEX_WIRKUNG = ['Ab Eintritt der Schwelle', 'Ab Zugang des Verlangens', 'Ab dem Folgemonat'];
    public const VERTRAG_FRIST_ARTEN = ['option', 'kuendigung', 'mietende', 'index'];
    public const FRIST_ERINNERUNG_EINHEITEN = ['Tage', 'Wochen', 'Monate'];

    public const ADH_ZUWEISUNG = 'ADH';
}
