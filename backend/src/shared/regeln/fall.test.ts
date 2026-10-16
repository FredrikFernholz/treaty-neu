import { describe, expect, test } from 'vitest';
import { plusArbeitstage } from './datum.js';
import {
  FALLSTATUS,
  FALLSTATUS_BEZEICHNUNG,
  ampelFall,
  neuerFall,
  wvDatumNachStatuswechsel,
  type Fallmodul,
  type Fallstatus,
} from './fall.js';

// Jede Tabellenzeile ist ein eigener Testfall. Die erwarteten WV-Daten wurden vorab
// unabhängig mit einem eigenen Skript (JavaScript-Date in UTC) berechnet, nicht mit
// den Funktionen aus datum.ts. Wochentage stehen als Kommentar dahinter.

describe('Fallstatus', () => {
  test('es gibt genau 12 Status (PRD 4)', () => {
    expect(FALLSTATUS).toHaveLength(12);
  });

  test.each(FALLSTATUS)('%s hat eine Bezeichnung', (status) => {
    expect(FALLSTATUS_BEZEICHNUNG[status]).toBeTruthy();
  });
});

describe('wvDatumNachStatuswechsel', () => {
  // [Status, Wechseltag, erwartetes WV-Datum]
  test.each<[Fallstatus, string, string]>([
    // Wechsel an einem Donnerstag (2026-10-15)
    ['neu', '2026-10-15', '2026-10-29'], // 10 AT → Do
    ['in_bearbeitung', '2026-10-15', '2026-10-22'], // 5 AT → Do
    ['aw_eingegangen_mdt', '2026-10-15', '2026-10-22'], // 5 AT
    ['aw_eingegangen_vwt', '2026-10-15', '2026-10-29'], // 10 AT
    ['warte_auf_mdt', '2026-10-15', '2026-10-29'], // 10 AT
    ['warte_auf_verwalter', '2026-10-15', '2026-11-12'], // 20 AT = Do, bleibt
    ['warte_auf_dritten', '2026-10-15', '2026-10-29'], // 10 AT
    ['erinnerung_1', '2026-10-15', '2026-11-12'], // 20 AT = Do, bleibt
    ['erinnerung_2', '2026-10-15', '2026-10-29'], // 10 AT = Do, bleibt
    ['erinnerung_3', '2026-10-15', '2026-10-29'], // 10 AT = Do, bleibt
    ['erinnerung_4', '2026-10-15', '2026-10-29'], // 10 AT = Do, bleibt (nicht 15 AT)

    // Wechsel an einem Montag (2026-10-19): Donnerstag-Regel verschiebt sichtbar
    ['neu', '2026-10-19', '2026-11-02'], // Mo, keine Verschiebung
    ['in_bearbeitung', '2026-10-19', '2026-10-26'], // Mo
    ['aw_eingegangen_mdt', '2026-10-19', '2026-10-26'], // Mo
    ['aw_eingegangen_vwt', '2026-10-19', '2026-11-02'], // Mo
    ['warte_auf_mdt', '2026-10-19', '2026-11-02'], // Mo
    ['warte_auf_verwalter', '2026-10-19', '2026-11-19'], // 20 AT = Mo 16.11. → Do
    ['warte_auf_dritten', '2026-10-19', '2026-11-02'], // Mo
    ['erinnerung_1', '2026-10-19', '2026-11-19'], // 20 AT = Mo 16.11. → Do
    ['erinnerung_2', '2026-10-19', '2026-11-05'], // 10 AT = Mo 02.11. → Do
    ['erinnerung_3', '2026-10-19', '2026-11-05'], // 10 AT = Mo 02.11. → Do
    ['erinnerung_4', '2026-10-19', '2026-11-05'], // 10 AT = Mo 02.11. → Do

    // Wechsel an einem Mittwoch vor dem Jahreswechsel (2026-12-23)
    ['neu', '2026-12-23', '2027-01-06'], // Mi
    ['in_bearbeitung', '2026-12-23', '2026-12-30'], // Mi
    ['aw_eingegangen_mdt', '2026-12-23', '2026-12-30'], // Mi
    ['aw_eingegangen_vwt', '2026-12-23', '2027-01-06'], // Mi
    ['warte_auf_mdt', '2026-12-23', '2027-01-06'], // Mi
    ['warte_auf_verwalter', '2026-12-23', '2027-01-21'], // Do
    ['warte_auf_dritten', '2026-12-23', '2027-01-06'], // Mi
    ['erinnerung_1', '2026-12-23', '2027-01-21'], // Do
    ['erinnerung_2', '2026-12-23', '2027-01-07'], // Mi 06.01. → Do
    ['erinnerung_3', '2026-12-23', '2027-01-07'], // Mi 06.01. → Do
    ['erinnerung_4', '2026-12-23', '2027-01-07'], // Mi 06.01. → Do

    // Wechsel an einem Samstag (2026-10-17): erster Arbeitstag ist der Montag
    ['neu', '2026-10-17', '2026-10-30'], // Fr
    ['in_bearbeitung', '2026-10-17', '2026-10-23'], // Fr
    ['aw_eingegangen_mdt', '2026-10-17', '2026-10-23'], // Fr
    ['aw_eingegangen_vwt', '2026-10-17', '2026-10-30'], // Fr
    ['warte_auf_mdt', '2026-10-17', '2026-10-30'], // Fr
    ['warte_auf_verwalter', '2026-10-17', '2026-11-19'], // Fr 13.11. → Do
    ['warte_auf_dritten', '2026-10-17', '2026-10-30'], // Fr
    ['erinnerung_1', '2026-10-17', '2026-11-19'], // Fr 13.11. → Do
    ['erinnerung_2', '2026-10-17', '2026-11-05'], // Fr 30.10. → Do
    ['erinnerung_3', '2026-10-17', '2026-11-05'], // Fr 30.10. → Do
    ['erinnerung_4', '2026-10-17', '2026-11-05'], // Fr 30.10. → Do
  ])('%s, Wechsel am %s → %s', (status, wechseltag, erwartet) => {
    expect(wvDatumNachStatuswechsel(status, wechseltag)).toBe(erwartet);
  });

  test('abgeschlossen hat kein WV-Datum', () => {
    expect(wvDatumNachStatuswechsel('abgeschlossen', '2026-10-15')).toBeNull();
  });
});

describe('neuerFall', () => {
  // [Modul, Anlagetag, erwartetes WV-Datum]. Grundlage sind 14 Kalendertage, also
  // derselbe Wochentag zwei Wochen später. Nur in Betriebskosten wird ein Samstag oder
  // Sonntag auf den folgenden Montag geschoben (Entscheidung 16.10.2026).
  test.each<[Fallmodul, string, string]>([
    // Wochentage: beide Module gleich
    ['betriebskosten', '2026-10-15', '2026-10-29'], // Do → Do
    ['mieten', '2026-10-15', '2026-10-29'],
    ['betriebskosten', '2026-10-20', '2026-11-03'], // Di, über das Monatsende
    ['mieten', '2026-10-20', '2026-11-03'],
    ['betriebskosten', '2026-12-25', '2027-01-08'], // Fr, über den Jahreswechsel
    ['mieten', '2026-12-25', '2027-01-08'],
    ['betriebskosten', '2028-02-15', '2028-02-29'], // Di, Schaltjahr, Ergebnis ist der 29.02.
    ['mieten', '2028-02-15', '2028-02-29'],

    // Anlage am Samstag
    ['betriebskosten', '2026-10-17', '2026-11-02'], // Sa 31.10. → Mo
    ['mieten', '2026-10-17', '2026-10-31'], // Sa bleibt
    // Anlage am Sonntag
    ['betriebskosten', '2026-10-18', '2026-11-02'], // So 01.11. → Mo
    ['mieten', '2026-10-18', '2026-11-01'], // So bleibt

    // Wochenende in Verbindung mit dem Februar
    ['betriebskosten', '2027-02-20', '2027-03-08'], // Sa 06.03. → Mo, Februar mit 28 Tagen
    ['mieten', '2027-02-20', '2027-03-06'],
    ['betriebskosten', '2028-02-20', '2028-03-06'], // So 05.03. → Mo, Februar mit 29 Tagen
    ['mieten', '2028-02-20', '2028-03-05'],
  ])('%s, Anlage am %s → WV-Datum %s', (modul, anlagetag, erwartet) => {
    expect(neuerFall(modul, anlagetag)).toEqual({ status: 'neu', wvDatum: erwartet });
  });
});

describe('ampelFall', () => {
  // Grenzen je Status: [Status, grün bis, gelb bis]. Geprüft werden 0 Tage, die letzte
  // grüne, die erste gelbe, die letzte gelbe und die erste rote Stelle.
  const grenzen: [Fallstatus, number, number][] = [
    ['neu', 5, 10],
    ['in_bearbeitung', 1, 5],
    ['aw_eingegangen_mdt', 1, 5],
    ['aw_eingegangen_vwt', 5, 10],
    ['warte_auf_mdt', 10, 13],
    ['warte_auf_verwalter', 10, 13],
    ['warte_auf_dritten', 10, 13],
    ['erinnerung_1', 20, 23],
    ['erinnerung_2', 10, 13],
    ['erinnerung_3', 10, 13],
    ['erinnerung_4', 10, 13],
  ];
  const faelle = grenzen.flatMap(([status, gruenBis, gelbBis]) => [
    [status, 0, 'gruen'],
    [status, gruenBis, 'gruen'],
    [status, gruenBis + 1, 'gelb'],
    [status, gelbBis, 'gelb'],
    [status, gelbBis + 1, 'rot'],
  ]) as [Fallstatus, number, string][];

  // Die letzte Statusänderung war an einem Donnerstag. "heute" liegt die angegebene
  // Anzahl Arbeitstage danach (plusArbeitstage ist in datum.test.ts geprüft).
  test.each(faelle)('%s, %i Arbeitstage seit Statusänderung → %s', (status, tage, erwartet) => {
    const letzteAenderung = '2026-10-15';
    expect(ampelFall(status, letzteAenderung, plusArbeitstage(letzteAenderung, tage))).toBe(erwartet);
  });

  test.each<[string, string, string, string]>([
    // Ausgeschriebene Beispiele mit Wochenende, "in Bearbeitung" (grün bis 1, gelb bis 5)
    ['2026-10-16', '2026-10-16', 'gruen', 'Wechsel heute (Fr), 0 AT'],
    ['2026-10-16', '2026-10-18', 'gruen', 'Fr → So, Wochenende zählt nicht, 0 AT'],
    ['2026-10-16', '2026-10-19', 'gruen', 'Fr → Mo, 1 AT'],
    ['2026-10-16', '2026-10-20', 'gelb', 'Fr → Di, 2 AT'],
    ['2026-10-16', '2026-10-23', 'gelb', 'Fr → Fr, 5 AT'],
    ['2026-10-16', '2026-10-26', 'rot', 'Fr → Mo, 6 AT'],
  ])('in Bearbeitung, Änderung %s, heute %s → %s (%s)', (letzte, heute, erwartet) => {
    expect(ampelFall('in_bearbeitung', letzte, heute)).toBe(erwartet);
  });

  test('abgeschlossen ist immer grün, auch nach langer Zeit', () => {
    expect(ampelFall('abgeschlossen', '2020-01-01', '2026-10-15')).toBe('gruen');
  });
});
