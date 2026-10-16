import { describe, expect, test } from 'vitest';
import {
  BEREICHE,
  BERECHTIGUNGEN,
  ZUSATZRECHTE,
  ZUSATZRECHT_BEZEICHNUNG,
  darf,
  siehtAlleZeitbuchungen,
  type Bereich,
  type Berechtigung,
  type Zusatzrecht,
} from './rechtematrix.js';

// Die Erwartung ist hier unabhängig von RECHTEMATRIX ausgeschrieben, nach PRD 3 und
// Konzeption 8 sowie der Entscheidung vom 16.10.2026 zu "vertraege". Eine Änderung an
// der Matrix fällt dadurch in diesem Test auf.
const FUER_BEIDE_OFFEN: Bereich[] = [
  'betriebskosten',
  'mieten',
  'vertraege',
  'aufgaben',
  'zeiterfassung',
  'kontaktdatenbank',
];
const NUR_ADMIN_MIT_ZUSATZRECHT: Partial<Record<Bereich, Zusatzrecht>> = {
  buchhaltung: 'buchhaltung',
  kunden: 'kunden',
  leistungskatalog: 'leistungskatalog',
  nutzerverwaltung: 'nutzerverwaltung',
  auswertungen: 'auswertungen',
};

function erwartet(berechtigung: Berechtigung, zusatzrechte: Zusatzrecht[], bereich: Bereich): boolean {
  if (berechtigung === 'administrator') return true;
  if (FUER_BEIDE_OFFEN.includes(bereich)) return true;
  const noetig = NUR_ADMIN_MIT_ZUSATZRECHT[bereich];
  return noetig !== undefined && zusatzrechte.includes(noetig);
}

describe('Aufbau der Rechtematrix', () => {
  test('es gibt genau die 11 Bereiche aus PRD 3 und Konzeption 8', () => {
    expect([...BEREICHE].sort()).toEqual(
      [...FUER_BEIDE_OFFEN, ...Object.keys(NUR_ADMIN_MIT_ZUSATZRECHT)].sort(),
    );
  });

  test('Berechtigungsstufen wie in der Spalte benutzer.berechtigung', () => {
    expect(BERECHTIGUNGEN).toEqual(['administrator', 'sachbearbeiter']);
  });

  test('es gibt genau die 6 Zusatzrechte aus Konzeption 6.2, alle mit Bezeichnung', () => {
    expect([...ZUSATZRECHTE].sort()).toEqual(
      ['auswertungen', 'buchhaltung', 'kunden', 'leistungskatalog', 'nutzerverwaltung', 'zeiterfassung_alle'],
    );
    for (const recht of ZUSATZRECHTE) expect(ZUSATZRECHT_BEZEICHNUNG[recht]).toBeTruthy();
  });
});

describe('darf: jede Kombination aus Stufe, Zusatzrechten und Bereich', () => {
  // Varianten der Zusatzrechte: keine, jedes einzeln und alle zusammen
  const varianten: [string, Zusatzrecht[]][] = [
    ['keine Zusatzrechte', []],
    ...ZUSATZRECHTE.map((recht): [string, Zusatzrecht[]] => [`nur ${recht}`, [recht]]),
    ['alle Zusatzrechte', [...ZUSATZRECHTE]],
  ];
  const faelle = BERECHTIGUNGEN.flatMap((berechtigung) =>
    varianten.flatMap(([name, zusatzrechte]) =>
      BEREICHE.map((bereich) => [berechtigung, name, bereich, zusatzrechte] as const),
    ),
  );

  test.each(faelle)('%s mit %s, Bereich %s', (berechtigung, _name, bereich, zusatzrechte) => {
    expect(darf({ berechtigung, zusatzrechte }, bereich)).toBe(
      erwartet(berechtigung, [...zusatzrechte], bereich),
    );
  });
});

describe('darf: ausgeschriebene Beispiele', () => {
  test('Sachbearbeiter/in ohne Zusatzrecht darf Vertragsmanagement, aber nicht Buchhaltung', () => {
    const person = { berechtigung: 'sachbearbeiter', zusatzrechte: [] } as const;
    expect(darf(person, 'vertraege')).toBe(true);
    expect(darf(person, 'buchhaltung')).toBe(false);
  });

  test('Zusatzrecht buchhaltung schaltet nur die Buchhaltung frei (Beispiel aus PRD 13)', () => {
    const person = { berechtigung: 'sachbearbeiter', zusatzrechte: ['buchhaltung'] } as const;
    expect(darf(person, 'buchhaltung')).toBe(true);
    expect(darf(person, 'kunden')).toBe(false);
    expect(darf(person, 'auswertungen')).toBe(false);
  });

  test('zeiterfassung_alle schaltet keinen gesperrten Bereich frei', () => {
    const person = { berechtigung: 'sachbearbeiter', zusatzrechte: ['zeiterfassung_alle'] } as const;
    for (const bereich of Object.keys(NUR_ADMIN_MIT_ZUSATZRECHT) as Bereich[]) {
      expect(darf(person, bereich)).toBe(false);
    }
  });

  test('ein unbekannter Bereich wirft, statt Zugriff zu geben', () => {
    const person = { berechtigung: 'administrator', zusatzrechte: [] } as const;
    expect(() => darf(person, 'kundenverwaltung' as Bereich)).toThrow('Unbekannter Bereich');
  });
});

describe('siehtAlleZeitbuchungen', () => {
  test.each<[Berechtigung, Zusatzrecht[], boolean]>([
    ['administrator', [], true],
    ['administrator', ['zeiterfassung_alle'], true],
    ['sachbearbeiter', [], false],
    ['sachbearbeiter', ['zeiterfassung_alle'], true],
    ['sachbearbeiter', ['buchhaltung', 'auswertungen'], false],
  ])('%s mit %j → %s', (berechtigung, zusatzrechte, ergebnis) => {
    expect(siehtAlleZeitbuchungen({ berechtigung, zusatzrechte })).toBe(ergebnis);
  });
});
