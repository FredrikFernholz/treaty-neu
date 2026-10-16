import { naechsterDonnerstag, plusTage, type Kalenderdatum } from './datum.js';
import { alsDbWert, betrag, rundeKaufmaennisch, summe, type Betrag } from './geld.js';

// Regeln für Rechnungen (Konzeption 7, Office).
//
// Die Rechnungsberechnung bekommt bereits ausgewählte Eingaben. Welche Fälle und
// Zeitbuchungen zu einer Rechnung gehören, entscheidet erst der Rechnungsdienst in
// Ausbaustufe 5, und dafür sind noch Punkte aus Konzeption 16 offen:
//  - Nr. 3: welches Datum einen Fall dem Abrechnungszeitraum zuordnet
//  - Nr. 4: ob Mieten-Fälle beim Erfolgshonorar mitzählen
//  - Nr. 5: wie schon abgerechnete Zeitbuchungen ausgeschlossen werden
//  - Nr. 8: dass die Abrechenbarkeit einer Buchung aus dem Leistungskatalog des
//    Mandanten folgt
// Ebenfalls offen ist die Umsatzsteuer (Nr. 7). Sie ist hier bewusst nicht enthalten,
// alle Beträge sind netto.

/** Kalendertage zwischen Rechnungsdatum und Zahlungsziel, vor dem Legen auf Donnerstag. */
export const ZAHLUNGSZIEL_KALENDERTAGE = 30;

/**
 * Zahlungsziel einer Rechnung (Entscheidung 16.10.2026, Abgleich A-14).
 *
 * Berechnet wird beim Festschreiben, und zwar ab dem Rechnungsdatum, also dem
 * Festschreibetag, nicht ab dem Tag, an dem der Entwurf angelegt wurde. Ein Entwurf
 * kann länger liegen, der Mandant soll trotzdem die volle Frist ab der versendeten
 * Rechnung haben. Das Zahlungsziel liegt 30 Kalendertage nach dem Rechnungsdatum und
 * wird dann auf den nächsten Donnerstag gelegt. Ist der 30. Tag ein Donnerstag, bleibt er.
 */
export function zahlungsziel(rechnungsdatum: Kalenderdatum): Kalenderdatum {
  return naechsterDonnerstag(plusTage(rechnungsdatum, ZAHLUNGSZIEL_KALENDERTAGE));
}

/** Typ einer Position im Leistungskatalog eines Mandanten (Konzeption 6). */
export type Leistungstyp = '%' | 'Stundensatz' | 'Prüfgebühr' | 'Pauschale' | 'Intern';

/**
 * Aktive Leistungsposition des Mandanten. Der Preis ist ein Dezimaltext: bei "%" der
 * Prozentsatz (z. B. "12.5"), bei "Prüfgebühr" der Betrag je Prüfung bzw. je NKA-Einheit,
 * sonst ein Eurobetrag.
 */
export type Leistungsposition = { aufgabentyp: string; typ: Leistungstyp; preis: string };

/** Eingaben der Rechnungsberechnung, vom Rechnungsdienst bereits ausgewählt. */
export type Rechnungseingaben = {
  /** Aktive Leistungspositionen des Mandanten. */
  leistungen: Leistungsposition[];
  /** Abgeschlossene gruppierte Fälle im Zeitraum, mit Anzahl der NKA-Einheiten. */
  gruppierteFaelle: { gruppierterWert: number }[];
  /** Abrechenbare Zeitbuchungen im Zeitraum, Minuten als ganze Zahl. */
  zeitbuchungen: { aufgabentyp: string; minuten: number }[];
  /** Summe der Ersparnis der abgeschlossenen Fälle im Zeitraum, als Betragstext. */
  ersparnisSumme: string;
  /** Tatsächlich angefallene Reisekosten, als Betragstext. */
  reisekostenIst: string;
  /**
   * Kappungsgrenze des Mandanten für Reisekosten, als Betragstext. null bedeutet, dass
   * keine Kappung eingetragen ist, dann sind die Reisekosten unbegrenzt. "0.00" ist
   * dagegen eine echte Grenze von 0€ (Entscheidung 16.10.2026, Abgleich A-16).
   */
  reisekostenKappung: string | null;
};

/**
 * Ergebnis der Rechnungsberechnung. Alle Beträge sind netto, als Text mit 2
 * Nachkommastellen wie in einer DECIMAL(12,2)-Spalte. Die Herleitung zeigt, wie die
 * Posten entstanden sind, und ist für berechnung_json gedacht.
 */
export type Rechnungsberechnung = {
  grundgebuehr: string;
  zeithonorar: string;
  reisekosten: string;
  erfolgshonorar: string;
  /** Summe der vier gerundeten Posten. */
  gesamtbetrag: string;
  herleitung: {
    /** Summe der Pauschale-Positionen. */
    pauschale: string;
    /** fest: Summe der Prüfgebühr-Positionen. gruppiert: NKA-Einheiten mal Satz. */
    pruefgebuehrArt: 'fest' | 'gruppiert';
    pruefgebuehrFest: string;
    /** Preis der Prüfgebühr-Position, gilt je NKA-Einheit. "0" ohne Position. */
    pruefgebuehrSatz: string;
    gruppierteFaelle: number;
    nkaEinheiten: number;
    /** Der Prüfgebühr-Anteil, der tatsächlich in die Grundgebühr eingeht. */
    pruefgebuehr: string;
    /** Minuten mit passender Stundensatz-Position. */
    minutenMitStundensatz: number;
    /** Minuten ohne passende Stundensatz-Position, sie zählen mit null. */
    minutenOhneStundensatz: number;
    ersparnisSumme: string;
    /** Prozentsatz der ersten %-Position. "0" ohne Position. */
    erfolgshonorarSatz: string;
    reisekostenIst: string;
    /** null, wenn keine Kappung eingetragen ist. */
    reisekostenKappung: string | null;
    /** true, wenn die Reisekosten über der Kappung lagen und gekürzt wurden. */
    reisekostenGedeckelt: boolean;
  };
};

function pruefeGanzzahl(wert: number, name: string, mindestens: number): void {
  if (!Number.isInteger(wert) || wert < mindestens) {
    throw new Error(`${name} muss eine ganze Zahl ab ${mindestens} sein, erhalten: ${wert}`);
  }
}

/**
 * Berechnet die vier Posten einer Rechnung (Konzeption 7, Formel wie im Prototyp).
 *
 * - Grundgebühr = Pauschale + Prüfgebühr. Die Prüfgebühr ist der Preis der Prüfgebühr-
 *   Position. Gibt es im Zeitraum abgeschlossene gruppierte Fälle, ersetzt sie die Summe
 *   aus NKA-Einheiten mal diesem Preis. Je Mandant darf höchstens eine Prüfgebühr-
 *   Position aktiv sein, bei mehreren wird ein Fehler geworfen (Entscheidung 16.10.2026).
 * - Zeithonorar = Summe aus Minuten / 60 × Stundensatz über alle Buchungen, deren
 *   Aufgabentyp eine Stundensatz-Position hat. Andere Buchungen zählen mit null.
 * - Erfolgshonorar = Ersparnissumme × Prozentsatz / 100, Satz der ersten %-Position.
 * - Reisekosten = tatsächliche Reisekosten, höchstens die Kappung. Ohne eingetragene
 *   Kappung werden sie voll übernommen.
 *
 * Gerundet wird kaufmännisch auf 2 Stellen je Teilsumme: Pauschale, feste und gruppierte
 * Prüfgebühr und die Grundgebühr, das Zeithonorar erst als Summe (nicht je Buchung),
 * Erfolgshonorar und Reisekosten. Der Gesamtbetrag ist die Summe der vier gerundeten
 * Posten und muss deshalb nicht mehr gerundet werden.
 */
export function berechneRechnung(eingaben: Rechnungseingaben): Rechnungsberechnung {
  const positionen = (typ: Leistungstyp) => eingaben.leistungen.filter((l) => l.typ === typ);
  const preisSumme = (typ: Leistungstyp) => summe(...positionen(typ).map((l) => betrag(l.preis)));

  // Grundgebühr
  const pauschale = rundeKaufmaennisch(preisSumme('Pauschale'));
  const pruefPositionen = positionen('Prüfgebühr');
  if (pruefPositionen.length > 1) {
    throw new Error(
      `Je Mandant darf höchstens eine Prüfgebühr-Position aktiv sein, erhalten: ${pruefPositionen.length}`,
    );
  }
  const pruefgebuehrSatz = betrag(pruefPositionen[0]?.preis ?? '0');
  const pruefgebuehrFest = rundeKaufmaennisch(pruefgebuehrSatz);

  for (const fall of eingaben.gruppierteFaelle) {
    pruefeGanzzahl(fall.gruppierterWert, 'Gruppierter Wert', 1);
  }
  const nkaEinheiten = eingaben.gruppierteFaelle.reduce((n, f) => n + f.gruppierterWert, 0);
  const istGruppiert = eingaben.gruppierteFaelle.length > 0;
  const pruefgebuehr = istGruppiert
    ? rundeKaufmaennisch(pruefgebuehrSatz.mul(nkaEinheiten))
    : pruefgebuehrFest;
  const grundgebuehr = rundeKaufmaennisch(summe(pauschale, pruefgebuehr));

  // Zeithonorar: Minuten × Stundensatz exakt aufsummieren, einmal durch 60 teilen und
  // erst dann runden. Das ist dieselbe Summe wie je Buchung Minuten / 60 × Satz,
  // vermeidet aber periodische Zwischenwerte wie 7 / 60.
  // Je Aufgabentyp gilt wie im Prototyp die erste Stundensatz-Position. Laut Datenmodell
  // gibt es ohnehin höchstens eine je Mandant und Aufgabentyp.
  const stundensatz = new Map<string, Betrag>();
  for (const l of positionen('Stundensatz')) {
    if (!stundensatz.has(l.aufgabentyp)) stundensatz.set(l.aufgabentyp, betrag(l.preis));
  }
  let minutenMitStundensatz = 0;
  let minutenOhneStundensatz = 0;
  const minutenMalSatz: Betrag[] = [];
  for (const buchung of eingaben.zeitbuchungen) {
    pruefeGanzzahl(buchung.minuten, 'Minuten', 0);
    const satz = stundensatz.get(buchung.aufgabentyp);
    if (satz === undefined) {
      minutenOhneStundensatz += buchung.minuten;
    } else {
      minutenMitStundensatz += buchung.minuten;
      minutenMalSatz.push(satz.mul(buchung.minuten));
    }
  }
  const zeithonorar = rundeKaufmaennisch(summe(...minutenMalSatz).div(60));

  // Erfolgshonorar
  const ersparnisSumme = betrag(eingaben.ersparnisSumme);
  const erfolgshonorarSatz = betrag(positionen('%')[0]?.preis ?? '0');
  const erfolgshonorar = rundeKaufmaennisch(ersparnisSumme.mul(erfolgshonorarSatz).div(100));

  // Reisekosten mit Kappung
  const reisekostenIst = betrag(eingaben.reisekostenIst);
  const reisekostenKappung =
    eingaben.reisekostenKappung === null ? null : betrag(eingaben.reisekostenKappung);
  const reisekostenGedeckelt =
    reisekostenKappung !== null && reisekostenIst.greaterThan(reisekostenKappung);
  const reisekosten = rundeKaufmaennisch(
    reisekostenGedeckelt && reisekostenKappung !== null ? reisekostenKappung : reisekostenIst,
  );

  return {
    grundgebuehr: alsDbWert(grundgebuehr),
    zeithonorar: alsDbWert(zeithonorar),
    reisekosten: alsDbWert(reisekosten),
    erfolgshonorar: alsDbWert(erfolgshonorar),
    gesamtbetrag: alsDbWert(summe(grundgebuehr, zeithonorar, reisekosten, erfolgshonorar)),
    herleitung: {
      pauschale: alsDbWert(pauschale),
      pruefgebuehrArt: istGruppiert ? 'gruppiert' : 'fest',
      pruefgebuehrFest: alsDbWert(pruefgebuehrFest),
      pruefgebuehrSatz: pruefgebuehrSatz.toString(),
      gruppierteFaelle: eingaben.gruppierteFaelle.length,
      nkaEinheiten,
      pruefgebuehr: alsDbWert(pruefgebuehr),
      minutenMitStundensatz,
      minutenOhneStundensatz,
      ersparnisSumme: alsDbWert(rundeKaufmaennisch(ersparnisSumme)),
      erfolgshonorarSatz: erfolgshonorarSatz.toString(),
      reisekostenIst: alsDbWert(rundeKaufmaennisch(reisekostenIst)),
      reisekostenKappung:
        reisekostenKappung === null ? null : alsDbWert(rundeKaufmaennisch(reisekostenKappung)),
      reisekostenGedeckelt,
    },
  };
}
