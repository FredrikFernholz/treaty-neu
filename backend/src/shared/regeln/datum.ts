// Kalenderregeln von Treaty (Konzeption 6.1 und 7).
//
// Fachliche Datumswerte (WV-Datum, Frist, Eingang) sind reine Kalendertage ohne Uhrzeit.
// Sie werden überall als Text "YYYY-MM-DD" geführt, genau wie MySQL eine DATE-Spalte
// liefert. Dieses Modul rechnet damit nur über Jahr, Monat und Tag als ganze Zahlen.
// Es verwendet bewusst kein Date-Objekt und keine Zeitzone. Ein Kalendertag hat hier
// keine Uhrzeit, deshalb können Zeitumstellung oder Mitternacht nichts verschieben.
//
// "Heute" ermittelt nur heuteInBerlin() in heute.ts. Alle Regeln bekommen es als Parameter.
//
// Feiertage spielen keine Rolle, Arbeitstage sind Montag bis Freitag (Entscheidung
// 15.10.2026 zu Konzeption 16 Nr. 1). Die Arbeitstag-Funktionen nehmen weiterhin
// optional eine Menge von Feiertagen entgegen, eine Feiertagsliste wird nicht eingebaut.

/** Ein Kalendertag als Text "YYYY-MM-DD", z. B. "2026-10-15". */
export type Kalenderdatum = string;

/** Optionale Feiertage, die zusätzlich zu Samstag und Sonntag nicht als Arbeitstag zählen. */
export type Feiertage = ReadonlySet<Kalenderdatum>;

/** Wochentag nach ISO: 1 = Montag, 2 = Dienstag, …, 4 = Donnerstag, …, 7 = Sonntag. */
export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DONNERSTAG = 4;

type Teile = { jahr: number; monat: number; tag: number };

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Gregorianisches Schaltjahr: durch 4 teilbar, außer volle Jahrhunderte, die nicht durch 400 teilbar sind. */
export function istSchaltjahr(jahr: number): boolean {
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;
}

/** Anzahl Tage im Monat (Monat 1 bis 12). */
export function tageImMonat(jahr: number, monat: number): number {
  if (monat === 2) return istSchaltjahr(jahr) ? 29 : 28;
  return [4, 6, 9, 11].includes(monat) ? 30 : 31;
}

/** Zerlegt "YYYY-MM-DD" in Zahlen und prüft, ob es den Tag wirklich gibt (kein 30.02.). */
function zerlege(datum: Kalenderdatum): Teile {
  const treffer = FORMAT.exec(datum);
  if (treffer) {
    const jahr = Number(treffer[1]);
    const monat = Number(treffer[2]);
    const tag = Number(treffer[3]);
    if (jahr >= 1 && monat >= 1 && monat <= 12 && tag >= 1 && tag <= tageImMonat(jahr, monat)) {
      return { jahr, monat, tag };
    }
  }
  throw new Error(`Ungültiges Kalenderdatum "${datum}", erwartet z. B. "2026-10-15"`);
}

function zusammensetzen({ jahr, monat, tag }: Teile): Kalenderdatum {
  const zweistellig = (zahl: number) => String(zahl).padStart(2, '0');
  return `${String(jahr).padStart(4, '0')}-${zweistellig(monat)}-${zweistellig(tag)}`;
}

/** Jahr, Monat und Tag eines Kalenderdatums als Zahlen. Wirft bei ungültigem Datum. */
export function datumsteile(datum: Kalenderdatum): { jahr: number; monat: number; tag: number } {
  return zerlege(datum);
}

/**
 * Datum aus Jahr, Monat und gewünschtem Tag. Gibt es den Tag in diesem Monat nicht, wird
 * er auf den letzten Tag des Monats begrenzt, z. B. 31. April → 30.04. und 29. Februar
 * ohne Schaltjahr → 28.02. (Serien, Konzeption 7).
 */
export function datumImMonat(jahr: number, monat: number, tag: number): Kalenderdatum {
  if (!Number.isInteger(jahr) || jahr < 1 || !Number.isInteger(monat) || monat < 1 || monat > 12) {
    throw new Error(`Ungültiger Monat ${monat} im Jahr ${jahr}`);
  }
  if (!Number.isInteger(tag) || tag < 1 || tag > 31) {
    throw new Error(`Tag muss eine ganze Zahl von 1 bis 31 sein, erhalten: ${tag}`);
  }
  return zusammensetzen({ jahr, monat, tag: Math.min(tag, tageImMonat(jahr, monat)) });
}

/** true, wenn der Text ein gültiges Kalenderdatum "YYYY-MM-DD" ist. */
export function istKalenderdatum(text: string): boolean {
  try {
    zerlege(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fortlaufende Nummer eines Tages, gezählt ab dem 01.01. des Jahres 1 (= Tag 1).
 * Damit lassen sich Abstände und Wochentage mit einfacher Subtraktion bestimmen.
 */
function tagesnummer(datum: Kalenderdatum): number {
  const { jahr, monat, tag } = zerlege(datum);
  // Alle Tage der vollen Jahre davor, einschließlich der Schalttage
  const vorjahre = jahr - 1;
  let nummer =
    vorjahre * 365 + Math.floor(vorjahre / 4) - Math.floor(vorjahre / 100) + Math.floor(vorjahre / 400);
  // Alle Tage der vollen Monate davor im selben Jahr
  for (let m = 1; m < monat; m++) nummer += tageImMonat(jahr, m);
  return nummer + tag;
}

/** Wochentag nach ISO (1 = Montag bis 7 = Sonntag). */
export function wochentag(datum: Kalenderdatum): Wochentag {
  // Der 01.01. des Jahres 1 (Tag 1) war im gregorianischen Kalender ein Montag.
  return (((tagesnummer(datum) - 1) % 7) + 1) as Wochentag;
}

/** Folgetag, mit Übergang auf den nächsten Monat und das nächste Jahr. */
function folgetag(datum: Kalenderdatum): Kalenderdatum {
  let { jahr, monat, tag } = zerlege(datum);
  tag += 1;
  if (tag > tageImMonat(jahr, monat)) {
    tag = 1;
    monat += 1;
    if (monat > 12) {
      monat = 1;
      jahr += 1;
    }
  }
  return zusammensetzen({ jahr, monat, tag });
}

function pruefeAnzahl(anzahl: number): void {
  if (!Number.isInteger(anzahl) || anzahl < 0) {
    throw new Error(`Anzahl Tage muss eine ganze Zahl ab 0 sein, erhalten: ${anzahl}`);
  }
}

/** Datum plus eine Anzahl Kalendertage (ab 0). */
export function plusTage(datum: Kalenderdatum, anzahl: number): Kalenderdatum {
  pruefeAnzahl(anzahl);
  zerlege(datum); // wirft bei ungültigem Datum, auch wenn anzahl 0 ist
  let ergebnis = datum;
  for (let i = 0; i < anzahl; i++) ergebnis = folgetag(ergebnis);
  return ergebnis;
}

/** Abstand in Kalendertagen von "von" bis "bis". Negativ, wenn "bis" vor "von" liegt. */
export function tageZwischen(von: Kalenderdatum, bis: Kalenderdatum): number {
  return tagesnummer(bis) - tagesnummer(von);
}

/** Arbeitstag ist Montag bis Freitag, sofern der Tag nicht in den übergebenen Feiertagen steht. */
export function istArbeitstag(datum: Kalenderdatum, feiertage?: Feiertage): boolean {
  return wochentag(datum) <= 5 && !feiertage?.has(datum);
}

/**
 * Datum plus eine Anzahl Arbeitstage. Der Ausgangstag selbst zählt nicht mit, gezählt
 * werden die folgenden Arbeitstage. Beispiel: Donnerstag plus 2 Arbeitstage ist der
 * Montag danach (Freitag = 1, Montag = 2). Bei 0 bleibt das Datum unverändert.
 */
export function plusArbeitstage(
  datum: Kalenderdatum,
  anzahl: number,
  feiertage?: Feiertage,
): Kalenderdatum {
  pruefeAnzahl(anzahl);
  zerlege(datum); // wirft bei ungültigem Datum, auch wenn anzahl 0 ist
  let ergebnis = datum;
  let gezaehlt = 0;
  while (gezaehlt < anzahl) {
    ergebnis = folgetag(ergebnis);
    if (istArbeitstag(ergebnis, feiertage)) gezaehlt += 1;
  }
  return ergebnis;
}

/**
 * Anzahl Arbeitstage nach "von" bis einschließlich "bis". Gegenstück zu plusArbeitstage:
 * arbeitstageZwischen(d, plusArbeitstage(d, n)) ergibt n. Gleicher Tag ergibt 0.
 * Liegt "bis" vor "von", ist das Ergebnis negativ.
 */
export function arbeitstageZwischen(
  von: Kalenderdatum,
  bis: Kalenderdatum,
  feiertage?: Feiertage,
): number {
  const abstand = tageZwischen(von, bis);
  if (abstand < 0) return -arbeitstageZwischen(bis, von, feiertage);
  let anzahl = 0;
  let tag = von;
  for (let i = 0; i < abstand; i++) {
    tag = folgetag(tag);
    if (istArbeitstag(tag, feiertage)) anzahl += 1;
  }
  return anzahl;
}

/**
 * Ist das Datum ein Arbeitstag (Montag bis Freitag), bleibt es. Samstag und Sonntag
 * werden auf den folgenden Montag gelegt (Betriebskosten, Entscheidung 16.10.2026).
 */
export function naechsterArbeitstag(datum: Kalenderdatum): Kalenderdatum {
  const tag = wochentag(datum);
  if (tag === 6) return plusTage(datum, 2);
  if (tag === 7) return plusTage(datum, 1);
  return datum;
}

/** Ist das Datum ein Donnerstag, bleibt es. Sonst der folgende Donnerstag (Konzeption 7). */
export function naechsterDonnerstag(datum: Kalenderdatum): Kalenderdatum {
  return plusTage(datum, (DONNERSTAG - wochentag(datum) + 7) % 7);
}
