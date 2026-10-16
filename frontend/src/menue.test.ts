import { describe, expect, test } from 'vitest';
import { sichtbareMenuepunkte } from './menue';
import { kreuzchenliste } from './rechteuebersicht';

describe('sichtbareMenuepunkte', () => {
  test.each([
    ['nicht angemeldet', null, []],
    ['Sachbearbeiter/in', { berechtigung: 'sachbearbeiter', zusatzrechte: [] }, ['Start']],
    ['Sachbearbeiter/in mit nutzerverwaltung', { berechtigung: 'sachbearbeiter', zusatzrechte: ['nutzerverwaltung'] }, ['Start', 'Nutzerverwaltung']],
    ['Sachbearbeiter/in mit anderem Zusatzrecht', { berechtigung: 'sachbearbeiter', zusatzrechte: ['buchhaltung'] }, ['Start']],
    ['Administrator', { berechtigung: 'administrator', zusatzrechte: [] }, ['Start', 'Nutzerverwaltung']],
  ] as const)('%s', (_name, person, titel) => {
    expect(sichtbareMenuepunkte(person).map((p) => p.titel)).toEqual(titel);
  });
});

describe('kreuzchenliste', () => {
  // Erwartung unabhängig ausgeschrieben nach PRD 3, Konzeption 8 und Entscheidung 16.10.2026
  test('entspricht der Rechtematrix', () => {
    expect(kreuzchenliste()).toEqual([
      { bereich: 'Betriebskosten', administrator: true, sachbearbeiter: true, sachbearbeiterHinweis: null, perZusatzrecht: null },
      { bereich: 'Mieten', administrator: true, sachbearbeiter: true, sachbearbeiterHinweis: null, perZusatzrecht: null },
      { bereich: 'Vertragsmanagement', administrator: true, sachbearbeiter: true, sachbearbeiterHinweis: null, perZusatzrecht: null },
      { bereich: 'Aufgaben', administrator: true, sachbearbeiter: true, sachbearbeiterHinweis: null, perZusatzrecht: null },
      {
        bereich: 'Office – Zeiterfassung',
        administrator: true,
        sachbearbeiter: true,
        sachbearbeiterHinweis: 'nur eigene',
        perZusatzrecht: 'Zeiterfassung aller Mitarbeitenden',
      },
      { bereich: 'Kontaktdatenbank', administrator: true, sachbearbeiter: true, sachbearbeiterHinweis: null, perZusatzrecht: null },
      { bereich: 'Office – Buchhaltung', administrator: true, sachbearbeiter: false, sachbearbeiterHinweis: null, perZusatzrecht: 'Office – Buchhaltung' },
      { bereich: 'Kundenverwaltung', administrator: true, sachbearbeiter: false, sachbearbeiterHinweis: null, perZusatzrecht: 'Kundenverwaltung' },
      { bereich: 'Leistungskatalog', administrator: true, sachbearbeiter: false, sachbearbeiterHinweis: null, perZusatzrecht: 'Leistungskatalog' },
      { bereich: 'Nutzerverwaltung', administrator: true, sachbearbeiter: false, sachbearbeiterHinweis: null, perZusatzrecht: 'Nutzerverwaltung' },
      { bereich: 'Auswertungen', administrator: true, sachbearbeiter: false, sachbearbeiterHinweis: null, perZusatzrecht: 'Auswertungen' },
    ]);
  });
});
