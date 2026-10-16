// Rechtematrix von Treaty (PRD 3, Konzeption 8).
//
// Diese Datei ist die einzige Stelle, an der festgelegt ist, wer welchen Bereich nutzen
// darf. Daraus entstehen die Zugriffsprüfung an jeder Backend-Route (403), das Ein- und
// Ausblenden in der Oberfläche und die Kreuzchenliste in der Nutzerverwaltung. So können
// Anzeige und tatsächliche Wirkung nicht auseinanderlaufen.
//
// Regeln:
//  - Administratoren dürfen jeden Bereich.
//  - Sachbearbeiter/innen dürfen die offenen Bereiche und zusätzlich jeden Bereich, für
//    den sie das passende Zusatzrecht haben.
//  - Zusatzrechte wirken nur additiv. Sie nehmen nie ein Recht weg, das die
//    Berechtigungsstufe schon gibt.
//  - Ein unbekannter Bereich ist ein Programmierfehler und führt zu einer Ausnahme statt
//    zu einem stillschweigenden Zugriff. Der Prototyp ließ unbekannte Bereiche offen.
//
// Die Schlüssel entsprechen dem Prototyp (z. B. "kunden", nicht "kundenverwaltung").
// Der Bereich "vertraege" steht beiden Stufen offen (Entscheidung 16.10.2026).

/** Berechtigungsstufen, gleiche Werte wie die Spalte benutzer.berechtigung. */
export const BERECHTIGUNGEN = ['administrator', 'sachbearbeiter'] as const;
export type Berechtigung = (typeof BERECHTIGUNGEN)[number];

/** Individuelle Zusatzrechte, gleiche Werte wie die Tabelle benutzer_zusatzrecht. */
export const ZUSATZRECHTE = [
  'buchhaltung',
  'leistungskatalog',
  'kunden',
  'nutzerverwaltung',
  'auswertungen',
  'zeiterfassung_alle',
] as const;
export type Zusatzrecht = (typeof ZUSATZRECHTE)[number];

/** Anzeigetexte der Zusatzrechte für die Nutzerverwaltung. */
export const ZUSATZRECHT_BEZEICHNUNG: Record<Zusatzrecht, string> = {
  buchhaltung: 'Office – Buchhaltung',
  leistungskatalog: 'Leistungskatalog',
  kunden: 'Kundenverwaltung',
  nutzerverwaltung: 'Nutzerverwaltung',
  auswertungen: 'Auswertungen',
  zeiterfassung_alle: 'Zeiterfassung aller Mitarbeitenden',
};

type Bereichsregel = {
  /** Anzeigetext des Bereichs. */
  bezeichnung: string;
  /** true, wenn Sachbearbeiter/innen den Bereich ohne Zusatzrecht nutzen dürfen. */
  sachbearbeiter: boolean;
  /** Zusatzrecht, das den Bereich für Sachbearbeiter/innen freischaltet, sonst null. */
  zusatzrecht: Zusatzrecht | null;
};

/** Die Rechtematrix. Administratoren dürfen immer alles, daher steht hier nur die Sachbearbeiter-Seite. */
export const RECHTEMATRIX = {
  betriebskosten: { bezeichnung: 'Betriebskosten', sachbearbeiter: true, zusatzrecht: null },
  mieten: { bezeichnung: 'Mieten', sachbearbeiter: true, zusatzrecht: null },
  vertraege: { bezeichnung: 'Vertragsmanagement', sachbearbeiter: true, zusatzrecht: null },
  aufgaben: { bezeichnung: 'Aufgaben', sachbearbeiter: true, zusatzrecht: null },
  zeiterfassung: { bezeichnung: 'Office – Zeiterfassung', sachbearbeiter: true, zusatzrecht: null },
  kontaktdatenbank: { bezeichnung: 'Kontaktdatenbank', sachbearbeiter: true, zusatzrecht: null },
  buchhaltung: { bezeichnung: 'Office – Buchhaltung', sachbearbeiter: false, zusatzrecht: 'buchhaltung' },
  kunden: { bezeichnung: 'Kundenverwaltung', sachbearbeiter: false, zusatzrecht: 'kunden' },
  leistungskatalog: { bezeichnung: 'Leistungskatalog', sachbearbeiter: false, zusatzrecht: 'leistungskatalog' },
  nutzerverwaltung: { bezeichnung: 'Nutzerverwaltung', sachbearbeiter: false, zusatzrecht: 'nutzerverwaltung' },
  auswertungen: { bezeichnung: 'Auswertungen', sachbearbeiter: false, zusatzrecht: 'auswertungen' },
} as const satisfies Record<string, Bereichsregel>;

export type Bereich = keyof typeof RECHTEMATRIX;

/** Alle Bereiche in der Reihenfolge der Matrix. */
export const BEREICHE = Object.keys(RECHTEMATRIX) as Bereich[];

/** Was die Rechteprüfung über eine Person wissen muss. */
export type Rechteinhaber = {
  berechtigung: Berechtigung;
  zusatzrechte: readonly Zusatzrecht[];
};

/** true, wenn die Person den Bereich nutzen darf. */
export function darf(person: Rechteinhaber, bereich: Bereich): boolean {
  const regel: Bereichsregel | undefined = RECHTEMATRIX[bereich];
  if (regel === undefined) {
    throw new Error(`Unbekannter Bereich "${String(bereich)}" in der Rechteprüfung`);
  }
  if (person.berechtigung === 'administrator') return true;
  if (regel.sachbearbeiter) return true;
  return regel.zusatzrecht !== null && person.zusatzrechte.includes(regel.zusatzrecht);
}

/**
 * true, wenn die Person in der Zeiterfassung die Buchungen aller Mitarbeitenden sieht.
 * Das gilt für Administratoren und für Sachbearbeiter/innen mit dem Zusatzrecht
 * zeiterfassung_alle. Alle anderen sehen nur ihre eigenen Buchungen (Konzeption 8).
 * Den Bereich Zeiterfassung selbst dürfen ohnehin beide Stufen nutzen.
 */
export function siehtAlleZeitbuchungen(person: Rechteinhaber): boolean {
  return person.berechtigung === 'administrator' || person.zusatzrechte.includes('zeiterfassung_alle');
}
