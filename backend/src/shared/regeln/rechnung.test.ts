import { describe, expect, test } from 'vitest';
import {
  berechneRechnung,
  zahlungsziel,
  type Leistungsposition,
  type Leistungstyp,
  type Rechnungseingaben,
} from './rechnung.js';

// Jede Tabellenzeile ist ein eigener Testfall. Die erwarteten Werte wurden vorab
// unabhängig mit JavaScript-Date in UTC berechnet, nicht mit den Funktionen aus datum.ts.
// Im Kommentar stehen der 30. Tag und sein Wochentag.

describe('zahlungsziel (30 Kalendertage ab Rechnungsdatum, dann Donnerstag)', () => {
  // [Rechnungsdatum (Festschreibetag), erwartetes Zahlungsziel]
  test.each([
    ['2026-10-13', '2026-11-12'], // 12.11. ist Do, bleibt
    ['2028-02-01', '2028-03-02'], // 02.03. ist Do, bleibt, über den 29.02.
    ['2026-11-30', '2026-12-31'], // Mi 30.12. → Do, ein Tag
    ['2026-10-14', '2026-11-19'], // Fr 13.11. → Do, sechs Tage
    ['2026-10-15', '2026-11-19'], // Sa 14.11. → Do
    ['2026-10-16', '2026-11-19'], // So 15.11. → Do
    ['2026-10-17', '2026-11-19'], // Mo 16.11. → Do
    ['2026-12-03', '2027-01-07'], // Sa 02.01. → Do, über den Jahreswechsel
    ['2027-01-29', '2027-03-04'], // So 28.02. → Do, Februar mit 28 Tagen
    ['2028-01-30', '2028-03-02'], // Di 29.02. → Do, Schaltjahr
  ])('Rechnungsdatum %s → Zahlungsziel %s', (rechnungsdatum, erwartet) => {
    expect(zahlungsziel(rechnungsdatum)).toBe(erwartet);
  });

  test('ungültiges Rechnungsdatum wirft', () => {
    expect(() => zahlungsziel('2026-02-30')).toThrow();
  });
});

describe('berechneRechnung', () => {
  // Die erwarteten Werte wurden vorab exakt mit ganzen Zahlen (Cent und Brüche in BigInt)
  // berechnet, unabhängig von decimal.js und von dieser Datei. Dieselben Eingaben wurden
  // mit der Logik aus rechnungsbasis/rechnungGesamt des Prototyps (Geschaeftsregeln.php,
  // Gleitkomma) gegengerechnet. Abweichungen dort sind in den Kommentaren vermerkt.
  const L = (aufgabentyp: string, typ: Leistungstyp, preis: string): Leistungsposition => ({
    aufgabentyp,
    typ,
    preis,
  });
  const leer: Rechnungseingaben = {
    leistungen: [],
    gruppierteFaelle: [],
    zeitbuchungen: [],
    ersparnisSumme: '0.00',
    reisekostenIst: '0.00',
    reisekostenKappung: '0.00',
  };

  test('vollständiges Beispiel mit fester Prüfgebühr samt Herleitung', () => {
    const ergebnis = berechneRechnung({
      leistungen: [
        L('Pauschale BK', 'Pauschale', '150.00'),
        L('Prüfung', 'Prüfgebühr', '89.00'),
        L('BK-Korrespondenz', 'Stundensatz', '95.00'),
        L('Erfolg', '%', '25'),
      ],
      gruppierteFaelle: [],
      zeitbuchungen: [
        { aufgabentyp: 'BK-Korrespondenz', minuten: 90 },
        { aufgabentyp: 'Intern', minuten: 30 }, // keine Stundensatz-Position, zählt mit null
      ],
      ersparnisSumme: '1234.56',
      reisekostenIst: '80.00',
      reisekostenKappung: '100.00',
    });
    expect(ergebnis).toEqual({
      grundgebuehr: '239.00', // 150,00 + 89,00
      zeithonorar: '142.50', // 90 / 60 × 95,00
      reisekosten: '80.00',
      erfolgshonorar: '308.64', // 1234,56 × 25 / 100
      gesamtbetrag: '770.14',
      herleitung: {
        pauschale: '150.00',
        pruefgebuehrArt: 'fest',
        pruefgebuehrFest: '89.00',
        pruefgebuehrSatz: '89',
        gruppierteFaelle: 0,
        nkaEinheiten: 0,
        pruefgebuehr: '89.00',
        minutenMitStundensatz: 90,
        minutenOhneStundensatz: 30,
        ersparnisSumme: '1234.56',
        erfolgshonorarSatz: '25',
        reisekostenIst: '80.00',
        reisekostenKappung: '100.00',
        reisekostenGedeckelt: false,
      },
    });
  });

  test('gruppierte Fälle ersetzen die feste Prüfgebühr', () => {
    const ergebnis = berechneRechnung({
      ...leer,
      leistungen: [L('Pauschale BK', 'Pauschale', '150.00'), L('Prüfung', 'Prüfgebühr', '45.00')],
      gruppierteFaelle: [{ gruppierterWert: 3 }, { gruppierterWert: 2 }],
      reisekostenKappung: '100.00',
    });
    expect(ergebnis.grundgebuehr).toBe('375.00'); // 150,00 + 5 × 45,00
    expect(ergebnis.gesamtbetrag).toBe('375.00');
    expect(ergebnis.herleitung).toMatchObject({
      pruefgebuehrArt: 'gruppiert',
      pruefgebuehrFest: '45.00',
      pruefgebuehrSatz: '45',
      gruppierteFaelle: 2,
      nkaEinheiten: 5,
      pruefgebuehr: '225.00',
    });
  });

  test('ohne Prüfgebühr-Position ist die Prüfgebühr 0, auch bei gruppierten Fällen', () => {
    const ergebnis = berechneRechnung({
      ...leer,
      leistungen: [L('Pauschale BK', 'Pauschale', '150.00')],
      gruppierteFaelle: [{ gruppierterWert: 4 }],
    });
    expect(ergebnis.grundgebuehr).toBe('150.00');
    expect(ergebnis.herleitung).toMatchObject({ pruefgebuehrSatz: '0', pruefgebuehr: '0.00' });
  });

  // Je Mandant höchstens eine aktive Prüfgebühr-Position (Entscheidung 16.10.2026).
  // Der Prototyp hätte fest 80,00 (Summe) und gruppiert 2 × 50,00 (erster Satz) berechnet.
  test.each([
    ['ohne gruppierte Fälle', []],
    ['mit gruppierten Fällen', [{ gruppierterWert: 2 }]],
  ])('mehrere Prüfgebühr-Positionen werfen einen Fehler (%s)', (_name, gruppierteFaelle) => {
    expect(() =>
      berechneRechnung({
        ...leer,
        leistungen: [L('Prüfung NKA', 'Prüfgebühr', '50.00'), L('Prüfung Heizung', 'Prüfgebühr', '30.00')],
        gruppierteFaelle,
      }),
    ).toThrow('höchstens eine Prüfgebühr-Position');
  });

  test('gruppierte Prüfgebühr wird kaufmännisch gerundet (halber Cent)', () => {
    const ergebnis = berechneRechnung({
      ...leer,
      leistungen: [L('Prüfung', 'Prüfgebühr', '0.005')],
      gruppierteFaelle: [{ gruppierterWert: 1 }],
    });
    expect(ergebnis.grundgebuehr).toBe('0.01');
  });

  // [Bezeichnung, Reisekosten-Ist, Kappung (null = keine eingetragen), abgerechnet, gedeckelt]
  test.each<[string, string, string | null, string, boolean]>([
    ['unter der Kappung', '80.00', '100.00', '80.00', false],
    ['genau an der Kappung', '100.00', '100.00', '100.00', false],
    ['einen Cent über der Kappung', '100.01', '100.00', '100.00', true],
    ['mit Kappung 0,00 als echter Grenze', '50.00', '0.00', '0.00', true],
    ['mit Kappung 0,00 und ohne Reisekosten', '0.00', '0.00', '0.00', false],
    ['ohne Kappung, voll übernommen', '50.00', null, '50.00', false],
    ['ohne Kappung, auch hohe Beträge', '98765.43', null, '98765.43', false],
  ])('Reisekosten %s', (_name, ist, kappung, erwartet, gedeckelt) => {
    const ergebnis = berechneRechnung({ ...leer, reisekostenIst: ist, reisekostenKappung: kappung });
    expect(ergebnis.reisekosten).toBe(erwartet);
    expect(ergebnis.gesamtbetrag).toBe(erwartet);
    expect(ergebnis.herleitung.reisekostenGedeckelt).toBe(gedeckelt);
    expect(ergebnis.herleitung.reisekostenKappung).toBe(kappung);
  });

  test('ohne Stundensatz-Position ist das Zeithonorar 0', () => {
    const ergebnis = berechneRechnung({
      ...leer,
      leistungen: [L('Pauschale BK', 'Pauschale', '150.00')],
      zeitbuchungen: [{ aufgabentyp: 'Akquise', minuten: 120 }],
    });
    expect(ergebnis.zeithonorar).toBe('0.00');
    expect(ergebnis.herleitung.minutenMitStundensatz).toBe(0);
    expect(ergebnis.herleitung.minutenOhneStundensatz).toBe(120);
  });

  // [Bezeichnung, Stundensätze, Buchungen, erwartetes Zeithonorar]
  test.each<[string, Leistungsposition[], { aufgabentyp: string; minuten: number }[], string]>([
    // Einzeln gerundet wären es 3 × 1,67 = 5,01
    ['erst als Summe gerundet', [L('Team', 'Stundensatz', '100.00')],
      [1, 1, 1].map((minuten) => ({ aufgabentyp: 'Team', minuten })), '5.00'],
    ['mehrere Typen: (7 + 8) / 60 × 95,00 + 13 / 60 × 80,00 = 41,0833…',
      [L('BK-Korrespondenz', 'Stundensatz', '95.00'), L('Team', 'Stundensatz', '80.00')],
      [{ aufgabentyp: 'BK-Korrespondenz', minuten: 7 }, { aufgabentyp: 'BK-Korrespondenz', minuten: 8 },
        { aufgabentyp: 'Team', minuten: 13 }], '41.08'],
    ['genau ein halber Cent: 1 / 60 × 0,30 = 0,005', [L('Team', 'Stundensatz', '0.30')],
      [{ aufgabentyp: 'Team', minuten: 1 }], '0.01'],
    // PHP ohne Vorrundung ergäbe 0,05, weil 1 / 60 × 3,30 als Gleitkommazahl knapp unter 0,055 liegt
    ['1 / 60 × 3,30 = 0,055', [L('Team', 'Stundensatz', '3.30')], [{ aufgabentyp: 'Team', minuten: 1 }], '0.06'],
    ['0 Minuten', [L('Team', 'Stundensatz', '95.00')], [{ aufgabentyp: 'Team', minuten: 0 }], '0.00'],
  ])('Zeithonorar %s', (_name, leistungen, zeitbuchungen, erwartet) => {
    expect(berechneRechnung({ ...leer, leistungen, zeitbuchungen }).zeithonorar).toBe(erwartet);
  });

  // [Ersparnissumme, Prozentsatz oder null ohne %-Position, erwartetes Erfolgshonorar]
  test.each<[string, string | null, string]>([
    ['1234.56', '25', '308.64'],
    ['1000.10', '12.5', '125.01'], // 125,0125, Satz mit Nachkommastelle
    ['1.10', '15', '0.17'], // 0,165, halber Cent
    ['14.50', '1', '0.15'], // 0,145, PHP ohne Vorrundung ergäbe 0,14
    ['500.00', null, '0.00'], // keine %-Position
  ])('Erfolgshonorar aus %s zu %s %%', (ersparnis, satz, erwartet) => {
    const leistungen = satz === null ? [] : [L('Erfolg', '%', satz)];
    const ergebnis = berechneRechnung({ ...leer, leistungen, ersparnisSumme: ersparnis });
    expect(ergebnis.erfolgshonorar).toBe(erwartet);
    expect(ergebnis.herleitung.erfolgshonorarSatz).toBe(satz ?? '0');
  });

  test('Gesamtbetrag ist die Summe der vier gerundeten Posten', () => {
    // 0,005 + 0,005 + 0,005 + 0,005: jeder Posten wird zu 0,01, gesamt 0,04 (nicht 0,02)
    const ergebnis = berechneRechnung({
      leistungen: [
        L('Prüfung', 'Prüfgebühr', '0.005'),
        L('Team', 'Stundensatz', '0.30'),
        L('Erfolg', '%', '5'),
      ],
      gruppierteFaelle: [{ gruppierterWert: 1 }],
      zeitbuchungen: [{ aufgabentyp: 'Team', minuten: 1 }],
      ersparnisSumme: '0.10',
      reisekostenIst: '0.01',
      reisekostenKappung: '100.00',
    });
    expect([ergebnis.grundgebuehr, ergebnis.zeithonorar, ergebnis.erfolgshonorar, ergebnis.reisekosten])
      .toEqual(['0.01', '0.01', '0.01', '0.01']);
    expect(ergebnis.gesamtbetrag).toBe('0.04');
  });

  test.each<[string, Partial<Rechnungseingaben>]>([
    ['Minuten mit Nachkommastelle', { zeitbuchungen: [{ aufgabentyp: 'Team', minuten: 1.5 }] }],
    ['negative Minuten', { zeitbuchungen: [{ aufgabentyp: 'Team', minuten: -1 }] }],
    ['gruppierter Wert 0', { gruppierteFaelle: [{ gruppierterWert: 0 }] }],
    ['Preis mit Komma', { leistungen: [L('Erfolg', '%', '12,5')] }],
    ['Reisekosten als deutsche Schreibweise', { reisekostenIst: '1.234,56' }],
  ])('wirft bei %s', (_name, aenderung) => {
    expect(() => berechneRechnung({ ...leer, ...aenderung })).toThrow();
  });
});
