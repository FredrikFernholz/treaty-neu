<?php
declare(strict_types=1);

/**
 * Seed-Skript: liest database/mockdata.json (dieselben Demo-Daten wie der Klick-Prototyp) und
 * befüllt das neue, normalisierte Schema per PDO. Namensbasierte Referenzen im Mockdata
 * (Mandantenname, Counterpart-Name, Standortnummer) werden dabei in die entsprechenden
 * Fremdschlüssel der neuen Struktur aufgelöst.
 *
 * Aufruf: php database/seed.php [Pfad zu mockdata.json]
 *
 * Demo-Passwort für ALLE Mitarbeiter-Konten: siehe README.md ("Demo-Zugangsdaten"). Es gibt im
 * Prototyp keine echten Passwörter - diese Entscheidung (ein einheitliches Demo-Passwort für den
 * Seed) wurde beim Fehlen einer Vorgabe getroffen und ist beim produktiven Einsatz zwingend zu
 * ändern (siehe Nutzerverwaltung, PUT /mitarbeiter/{id} mit "password").
 */

require __DIR__ . '/../config/config.php';
spl_autoload_register(function (string $class): void {
    $prefix = 'Treaty\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $path = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($path)) require $path;
});

use Treaty\Database;

$jsonPath = $argv[1] ?? __DIR__ . '/mockdata.json';
if (!is_file($jsonPath)) {
    fwrite(STDERR, "mockdata.json nicht gefunden unter $jsonPath\n");
    exit(1);
}
$data = json_decode(file_get_contents($jsonPath), true);
if (!is_array($data)) {
    fwrite(STDERR, "mockdata.json konnte nicht gelesen werden.\n");
    exit(1);
}

$pdo = Database::pdo();
$pdo->beginTransaction();

try {
    // ---------- Reihenfolge wichtig: erst Stammdaten ohne Fremdschlüssel, dann Fälle/Buchungen ----------

    echo "Mitarbeiter...\n";
    $demoHash = password_hash('treaty2026', PASSWORD_DEFAULT);
    $insM = $pdo->prepare(
        'INSERT INTO mitarbeiter (kuerzel, name, email, password_hash, berechtigung, zeichnung, bezeichnung, aktiv)
         VALUES (:k, :n, :e, :h, :b, :z, :bz, 1)'
    );
    foreach ($data['mitarbeiter'] as $m) {
        $insM->execute([
            'k' => $m['k'], 'n' => $m['name'], 'e' => $m['email'], 'h' => $demoHash,
            'b' => $m['berechtigung'], 'z' => $m['zeichnung'], 'bz' => $m['bezeichnung'] ?? null,
        ]);
        foreach ($m['zusatzrechte'] ?? [] as $zr) {
            $pdo->prepare('INSERT INTO mitarbeiter_zusatzrechte (mitarbeiter_id, bereich_key) VALUES (:id, :k)')
                ->execute(['id' => $pdo->lastInsertId(), 'k' => $zr]);
        }
    }

    echo "Mandanten (Kunden)...\n";
    $mandantIdByName = [];
    $insMdt = $pdo->prepare(
        'INSERT INTO mandanten (name, kuerzel, adresse, ansprechpartner, email, telefon, kunde_seit,
            vertrag_beginn, vertrag_laufzeit, vertrag_kuendigungsfrist, vertrag_status, reisekosten_kappung)
         VALUES (:name, :kuerzel, :adresse, :ansprechpartner, :email, :telefon, :kundeSeit,
            :vertragBeginn, :vertragLaufzeit, :vertragKuendigungsfrist, :vertragStatus, :reisekostenKappung)'
    );
    foreach ($data['kunden'] as $k) {
        $basic = $k['basic']; $vertrag = $k['vertrag'];
        $insMdt->execute([
            'name' => $k['name'], 'kuerzel' => $k['kuerzel'] ?? null,
            'adresse' => $basic['adresse'] ?? null, 'ansprechpartner' => $basic['ansprechpartner'] ?? null,
            'email' => $basic['email'] ?? null, 'telefon' => $basic['telefon'] ?? null,
            'kundeSeit' => $basic['kundeSeit'] ?? null, 'vertragBeginn' => $vertrag['beginn'] ?? null,
            'vertragLaufzeit' => $vertrag['laufzeit'] ?? null,
            'vertragKuendigungsfrist' => $vertrag['kuendigungsfrist'] ?? null,
            'vertragStatus' => $vertrag['status'] ?? 'Aktiv',
            'reisekostenKappung' => $vertrag['reisekostenKappung'] ?? 0,
        ]);
        $mandantIdByName[$k['name']] = (int) $pdo->lastInsertId();
    }

    echo "Mandanten-Kontakte...\n";
    $insMk = $pdo->prepare('INSERT INTO mandant_kontakte (mandant_id, name, email) VALUES (:mid, :name, :email)');
    foreach (($data['mdtKontakte'] ?? []) as $mdtName => $kontakte) {
        if (!isset($mandantIdByName[$mdtName])) continue;
        foreach ($kontakte as $kt) {
            $insMk->execute(['mid' => $mandantIdByName[$mdtName], 'name' => $kt['name'], 'email' => $kt['email'] ?? null]);
        }
    }

    echo "Counterparts...\n";
    $counterpartIdByName = [];
    $insCp = $pdo->prepare('INSERT INTO counterparts (name, email, adresse) VALUES (:name, :email, :adresse)');
    foreach ($data['counterparts'] as $c) {
        $insCp->execute(['name' => $c['name'], 'email' => $c['email'] ?? null, 'adresse' => $c['adresse'] ?? null]);
        $counterpartIdByName[$c['name']] = (int) $pdo->lastInsertId();
    }

    echo "Counterpart-Kontakte...\n";
    $insCk = $pdo->prepare('INSERT INTO counterpart_kontakte (counterpart_id, name, email) VALUES (:cid, :name, :email)');
    foreach (($data['vwtKontakte'] ?? []) as $cpName => $kontakte) {
        if (!isset($counterpartIdByName[$cpName])) continue;
        foreach ($kontakte as $kt) {
            $insCk->execute(['cid' => $counterpartIdByName[$cpName], 'name' => $kt['name'], 'email' => $kt['email'] ?? null]);
        }
    }

    echo "Standorte...\n";
    $standortIdByNr = [];
    $insSt = $pdo->prepare(
        'INSERT INTO standorte (nr, ort, plz, mandant_id, adresse) VALUES (:nr, :ort, :plz, :mid, :adresse)'
    );
    foreach ($data['standorte'] as $s) {
        $insSt->execute([
            'nr' => $s['nr'], 'ort' => $s['ort'], 'plz' => $s['plz'] ?? null,
            'mid' => $mandantIdByName[$s['mdt']] ?? null, 'adresse' => $s['adresse'] ?? null,
        ]);
        $standortIdByNr[$s['nr']] = (int) $pdo->lastInsertId();
    }

    echo "Leistungskatalog...\n";
    $leistungIdByModul = [];
    $insLk = $pdo->prepare('INSERT INTO leistungskatalog (modul, price, type, haeufigkeit) VALUES (:modul, :price, :type, :haeufigkeit)');
    foreach ($data['leistungskatalog'] as $l) {
        $insLk->execute(['modul' => $l['modul'], 'price' => $l['price'], 'type' => $l['type'], 'haeufigkeit' => $l['haeufigkeit']]);
        $leistungIdByModul[$l['modul']] = (int) $pdo->lastInsertId();
    }

    echo "Mandant-Leistungen (individuelle Zuordnung je Kunde)...\n";
    $insMl = $pdo->prepare(
        'INSERT INTO mandant_leistungen (mandant_id, leistungskatalog_id, aktiv, price) VALUES (:mid, :lid, :aktiv, :price)'
    );
    foreach ($data['kunden'] as $k) {
        $mid = $mandantIdByName[$k['name']];
        foreach ($k['leistungen'] as $l) {
            if (!isset($leistungIdByModul[$l['modul']])) continue;
            $insMl->execute(['mid' => $mid, 'lid' => $leistungIdByModul[$l['modul']], 'aktiv' => !empty($l['aktiv']) ? 1 : 0, 'price' => $l['price']]);
        }
    }

    echo "Betriebskosten...\n";
    $bkIdByMockId = [];
    $insBk = $pdo->prepare(
        'INSERT INTO betriebskosten (wv_datum, mandant_id, standort_id, ort, bka_jahr, bka_datum, nz_datum,
            abschluss_datum, status, counterpart_id, ansprechperson_vwt, ansprechperson_vwt_email, adh_kuerzel,
            bearbeiter_mdt, bearbeiter_mdt_email, ca_werte_fehler, draufleger, ersparnis, gesamtkosten,
            vorauszahlungen, eingang_datum, aenderung, eigentuemer, eigentuemer_adresse, eigentuemer_info,
            markt, gruppiert, gruppierter_wert, stromverbrauch, gasverbrauch, archiviert)
         VALUES (:wvDatum, :mandantId, :standortId, :ort, :bkaJahr, :bkaDatum, :nzDatum, :abschlussDatum,
            :status, :counterpartId, :ansprechpersonVwt, :ansprechpersonVwtEmail, :adhKuerzel, :bearbeiterMdt,
            :bearbeiterMdtEmail, :caWerteFehler, :draufleger, :ersparnis, :gesamtkosten, :vorauszahlungen,
            :eingangDatum, :aenderung, :eigentuemer, :eigentuemerAdresse, :eigentuemerInfo, :markt, :gruppiert,
            :gruppierterWert, :stromverbrauch, :gasverbrauch, :archiviert)'
    );
    foreach ($data['betriebskosten'] as $b) {
        $insBk->execute([
            'wvDatum' => $b['wvDatum'], 'mandantId' => $mandantIdByName[$b['mdt']],
            'standortId' => $standortIdByNr[$b['standortNr']] ?? null, 'ort' => $b['ort'],
            'bkaJahr' => $b['bkaJahr'], 'bkaDatum' => $b['bkaDatum'] ?? null, 'nzDatum' => $b['nzDatum'] ?? null,
            'abschlussDatum' => $b['abschlussDatum'] ?? null, 'status' => $b['status'],
            'counterpartId' => $counterpartIdByName[$b['counterpart']] ?? null,
            'ansprechpersonVwt' => $b['ansprechpersonVwt'] ?? null, 'ansprechpersonVwtEmail' => $b['ansprechpersonVwtEmail'] ?? null,
            'adhKuerzel' => $b['adh'], 'bearbeiterMdt' => $b['bearbeiterMdt'] ?? null,
            'bearbeiterMdtEmail' => $b['bearbeiterMdtEmail'] ?? null, 'caWerteFehler' => $b['caWerteFehler'] ?? 0,
            'draufleger' => $b['draufleger'] ?? 0, 'ersparnis' => $b['ersparnis'] ?? 0,
            'gesamtkosten' => $b['gesamtkosten'] ?? 0, 'vorauszahlungen' => $b['vorauszahlungen'] ?? 0,
            'eingangDatum' => $b['eingangDatum'] ?? null, 'aenderung' => $b['aenderung'],
            'eigentuemer' => $b['eigentuemer'] ?? null, 'eigentuemerAdresse' => $b['eigentuemerAdresse'] ?? null,
            'eigentuemerInfo' => $b['eigentuemerInfo'] ?? null, 'markt' => $b['markt'] ?? null,
            'gruppiert' => !empty($b['gruppiert']) ? 1 : 0, 'gruppierterWert' => $b['gruppierterWert'] ?? 0,
            'stromverbrauch' => $b['stromverbrauch'] ?? null, 'gasverbrauch' => $b['gasverbrauch'] ?? null,
            'archiviert' => !empty($b['archiviert']) ? 1 : 0,
        ]);
        $bkIdByMockId[$b['id']] = (int) $pdo->lastInsertId();

        $insBkd = $pdo->prepare(
            'INSERT INTO bk_dateien (betriebskosten_id, kategorie, unterkategorie, datum, titel, hochgeladen_am)
             VALUES (:bid, :kategorie, :unterkategorie, :datum, :titel, :hochgeladenAm)'
        );
        foreach ($b['dateien'] ?? [] as $dt) {
            $insBkd->execute([
                'bid' => $bkIdByMockId[$b['id']], 'kategorie' => $dt['kategorie'], 'unterkategorie' => $dt['unterkategorie'] ?? null,
                'datum' => $dt['datum'] ?? null, 'titel' => $dt['titel'] ?: null, 'hochgeladenAm' => $dt['hochgeladenAm'],
            ]);
        }
    }

    echo "Mieten...\n";
    $mietenIdByMockId = [];
    $insMt = $pdo->prepare(
        'INSERT INTO mieten (wv_datum, mandant_id, standort_id, ort, dmr_ab, status, counterpart_id,
            ansprechperson_vwt, ansprechperson_vwt_email, adh_kuerzel, bearbeiter_mdt, bearbeiter_mdt_email,
            ca_werte_fehler, draufleger, ersparnis, eingang_datum, abschluss_datum, aenderung, eigentuemer,
            eigentuemer_adresse, eigentuemer_info, archiviert)
         VALUES (:wvDatum, :mandantId, :standortId, :ort, :dmrAb, :status, :counterpartId, :ansprechpersonVwt,
            :ansprechpersonVwtEmail, :adhKuerzel, :bearbeiterMdt, :bearbeiterMdtEmail, :caWerteFehler,
            :draufleger, :ersparnis, :eingangDatum, :abschlussDatum, :aenderung, :eigentuemer,
            :eigentuemerAdresse, :eigentuemerInfo, :archiviert)'
    );
    foreach ($data['mieten'] as $m) {
        $insMt->execute([
            'wvDatum' => $m['wvDatum'], 'mandantId' => $mandantIdByName[$m['mdt']],
            'standortId' => $standortIdByNr[$m['standortNr']] ?? null, 'ort' => $m['ort'], 'dmrAb' => $m['dmrAb'],
            'status' => $m['status'], 'counterpartId' => $counterpartIdByName[$m['counterpart']] ?? null,
            'ansprechpersonVwt' => $m['ansprechpersonVwt'] ?? null, 'ansprechpersonVwtEmail' => $m['ansprechpersonVwtEmail'] ?? null,
            'adhKuerzel' => $m['adh'], 'bearbeiterMdt' => $m['bearbeiterMdt'] ?? null,
            'bearbeiterMdtEmail' => $m['bearbeiterMdtEmail'] ?? null, 'caWerteFehler' => $m['caWerteFehler'] ?? 0,
            'draufleger' => $m['draufleger'] ?? 0, 'ersparnis' => $m['ersparnis'] ?? 0,
            'eingangDatum' => $m['eingangDatum'] ?? null, 'abschlussDatum' => $m['abschlussDatum'] ?? null,
            'aenderung' => $m['aenderung'], 'eigentuemer' => $m['eigentuemer'] ?? null,
            'eigentuemerAdresse' => $m['eigentuemerAdresse'] ?? null, 'eigentuemerInfo' => $m['eigentuemerInfo'] ?? null,
            'archiviert' => !empty($m['archiviert']) ? 1 : 0,
        ]);
        $mietenIdByMockId[$m['id']] = (int) $pdo->lastInsertId();
    }

    echo "Aufgaben...\n";
    $aufgabeIdByMockId = [];
    $insAf = $pdo->prepare(
        'INSERT INTO aufgaben (frist_datum, frist_titel, wv_datum, mandant_id, modul_name, modul_status,
            standort_nr, ort, aufgaben_typ, titel, beschreibung, zugewiesen_an, ersteller, status,
            erstellt_am, bk_id, mieten_id)
         VALUES (:fristDatum, :fristTitel, :wvDatum, :mandantId, :modulName, :modulStatus, :standortNr, :ort,
            :aufgabenTyp, :titel, :beschreibung, :zugewiesenAn, :ersteller, :status, :erstelltAm, :bkId, :mietenId)'
    );
    foreach ($data['aufgaben'] as $a) {
        $insAf->execute([
            'fristDatum' => $a['fristDatum'] ?? null, 'fristTitel' => $a['fristTitel'] ?? null,
            'wvDatum' => $a['wvDatum'], 'mandantId' => isset($a['mdt']) && $a['mdt'] !== '' ? ($mandantIdByName[$a['mdt']] ?? null) : null,
            'modulName' => $a['modulName'] ?? '-', 'modulStatus' => $a['modulStatus'] ?? null,
            'standortNr' => $a['standortNr'] ?? null, 'ort' => $a['ort'] ?? null, 'aufgabenTyp' => $a['aufgabenTyp'],
            'titel' => $a['titel'], 'beschreibung' => $a['beschreibung'] ?? null, 'zugewiesenAn' => $a['zugewiesenAn'],
            'ersteller' => $a['ersteller'], 'status' => $a['status'], 'erstelltAm' => $a['erstelltAm'],
            'bkId' => isset($a['bkId']) ? ($bkIdByMockId[$a['bkId']] ?? null) : null,
            'mietenId' => isset($a['mietenId']) ? ($mietenIdByMockId[$a['mietenId']] ?? null) : null,
        ]);
        $aufgabeIdByMockId[$a['id']] = (int) $pdo->lastInsertId();

        $insAfF = $pdo->prepare('INSERT IGNORE INTO aufgaben_follower (aufgabe_id, mitarbeiter_kuerzel) VALUES (:aid, :k)');
        foreach ($a['follower'] ?? [] as $fk) {
            $insAfF->execute(['aid' => $aufgabeIdByMockId[$a['id']], 'k' => $fk]);
        }
        $insAfS = $pdo->prepare('INSERT INTO aufgaben_subtasks (aufgabe_id, titel, erledigt, position) VALUES (:aid, :titel, :erledigt, :pos)');
        foreach (($a['subtasks'] ?? []) as $i => $s) {
            $insAfS->execute(['aid' => $aufgabeIdByMockId[$a['id']], 'titel' => $s['title'], 'erledigt' => !empty($s['done']) ? 1 : 0, 'pos' => $i]);
        }
    }

    echo "Aufgaben-Vorlagen...\n";
    $insVl = $pdo->prepare(
        'INSERT INTO aufgaben_vorlagen (name, mandant_id, aufgaben_typ, titel, beschreibung, zugewiesen_an, ersteller, zugriff)
         VALUES (:name, :mandantId, :aufgabenTyp, :titel, :beschreibung, :zugewiesenAn, :ersteller, :zugriff)'
    );
    foreach (($data['vorlagen'] ?? []) as $v) {
        $insVl->execute([
            'name' => $v['name'], 'mandantId' => !empty($v['mdt']) ? ($mandantIdByName[$v['mdt']] ?? null) : null,
            'aufgabenTyp' => $v['aufgabenTyp'], 'titel' => $v['titel'], 'beschreibung' => $v['beschreibung'] ?? null,
            'zugewiesenAn' => $v['zugewiesenAn'], 'ersteller' => $v['ersteller'], 'zugriff' => $v['zugriff'] ?? 'Alle',
        ]);
        $vlId = (int) $pdo->lastInsertId();
        $insVlF = $pdo->prepare('INSERT IGNORE INTO aufgaben_vorlagen_follower (vorlage_id, mitarbeiter_kuerzel) VALUES (:vid, :k)');
        foreach ($v['follower'] ?? [] as $fk) {
            $insVlF->execute(['vid' => $vlId, 'k' => $fk]);
        }
    }

    echo "Zeitbuchungen...\n";
    $insZb = $pdo->prepare(
        'INSERT INTO zeitbuchungen (datum, mitarbeiter_kuerzel, mandant_id, aufgabe_id, aufgaben_typ,
            beschreibung, start_zeit, ende_zeit, minuten, abrechenbar, quelle)
         VALUES (:datum, :mitarbeiterKuerzel, :mandantId, :aufgabeId, :aufgabenTyp, :beschreibung,
            :startZeit, :endeZeit, :minuten, :abrechenbar, :quelle)'
    );
    foreach ($data['zeitbuchungen'] as $z) {
        $insZb->execute([
            'datum' => $z['datum'], 'mitarbeiterKuerzel' => $z['mitarbeiter'],
            'mandantId' => !empty($z['mdt']) ? ($mandantIdByName[$z['mdt']] ?? null) : null,
            'aufgabeId' => isset($z['aufgabeId']) ? ($aufgabeIdByMockId[$z['aufgabeId']] ?? null) : null,
            'aufgabenTyp' => $z['aufgabenTyp'], 'beschreibung' => $z['beschreibung'] ?? null,
            'startZeit' => $z['start'] . ':00', 'endeZeit' => $z['ende'] . ':00', 'minuten' => $z['minuten'],
            'abrechenbar' => !empty($z['abrechenbar']) ? 1 : 0, 'quelle' => $z['quelle'],
        ]);
    }

    echo "Rechnungen...\n";
    $insRg = $pdo->prepare(
        'INSERT INTO rechnungen (nummer, mandant_id, zeitraum_von, zeitraum_bis, haeufigkeit, erstellt_am,
            zahlungsziel, grundgebuehr, zeithonorar, reisekosten_ist, reisekosten, reisekosten_kappung,
            ersparnis_summe, erfolgshonorar_satz, erfolgshonorar, gesamtbetrag, status)
         VALUES (:nummer, :mandantId, :von, :bis, :haeufigkeit, :erstelltAm, :zahlungsziel, :grundgebuehr,
            :zeithonorar, :reisekostenIst, :reisekosten, :reisekostenKappung, :ersparnisSumme,
            :erfolgshonorarSatz, :erfolgshonorar, :gesamtbetrag, :status)'
    );
    foreach ($data['rechnungen'] as $r) {
        $insRg->execute([
            'nummer' => $r['nummer'], 'mandantId' => $mandantIdByName[$r['mdt']], 'von' => $r['zeitraumVon'],
            'bis' => $r['zeitraumBis'], 'haeufigkeit' => $r['haeufigkeit'], 'erstelltAm' => $r['erstelltAm'],
            'zahlungsziel' => $r['zahlungsziel'], 'grundgebuehr' => $r['grundgebuehr'], 'zeithonorar' => $r['zeithonorar'],
            'reisekostenIst' => $r['reisekostenIst'], 'reisekosten' => $r['reisekosten'],
            'reisekostenKappung' => $r['reisekostenKappung'], 'ersparnisSumme' => $r['ersparnisSumme'],
            'erfolgshonorarSatz' => $r['erfolgshonorarSatz'], 'erfolgshonorar' => $r['erfolgshonorar'],
            'gesamtbetrag' => $r['gesamtbetrag'], 'status' => $r['status'],
        ]);
    }

    $pdo->commit();
    echo "Fertig.\n";
} catch (\Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Fehler beim Seeden: ' . $e->getMessage() . "\n");
    exit(1);
}
