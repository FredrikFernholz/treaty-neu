// Vorschlag für das Kürzel einer neuen Person (Entscheidung 16.10.2026, Abgleich A-18).
//
// Aus Vor- und Nachname, in dieser Reihenfolge:
//   1. erster Buchstabe des Vornamens und des Nachnamens:  Anna Beispiel → AB
//   2. dazu der zweite Buchstabe des Nachnamens:            → ABE
//   3. AB mit angehängter Ziffer:                           → AB2, AB3, … AB99
// Bei nur einem Namensteil die ersten zwei bzw. drei Buchstaben: Anna → AN, ANN, AN2 …
// Mit "Vorname" ist der erste Namensteil gemeint, mit "Nachname" der letzte. Ein
// Mittelname spielt keine Rolle, ein Doppelname mit Bindestrich zählt als zwei Teile.
//
// Kürzel enthalten nur A bis Z und Ziffern. Umlaute und Akzente werden deshalb auf den
// Grundbuchstaben zurückgeführt (Ö → O, é → E), ß wird zu SS.
//
// Vergebene Kürzel (auch die von deaktivierten Personen) und reservierte Kürzel wie
// "ADH" werden übersprungen. Der Vorschlag lässt sich vor dem Speichern ändern.

/** Namensteile in Großbuchstaben, nur noch A bis Z. */
function namensteile(name: string): string[] {
  return name
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Akzente und Umlautpunkte entfernen
    .toUpperCase()
    .split(/[\s-]+/)
    .map((teil) => teil.replace(/[^A-Z]/g, ''))
    .filter((teil) => teil.length > 0);
}

/**
 * Schlägt ein freies Kürzel vor, oder null, wenn der Name keinen Buchstaben enthält
 * oder alle Möglichkeiten vergeben sind.
 * nichtVerfuegbar enthält vergebene und reservierte Kürzel in Großbuchstaben.
 */
export function schlageKuerzelVor(name: string, nichtVerfuegbar: ReadonlySet<string>): string | null {
  const teile = namensteile(name);
  if (teile.length === 0) return null;

  const vorn = teile[0]!;
  const hinten = teile.length > 1 ? teile[teile.length - 1]! : vorn.slice(1);
  const basis = vorn[0]! + (hinten[0] ?? '');
  if (basis.length < 2) return null; // etwa ein Name aus nur einem Buchstaben

  const kandidaten = [basis];
  if (hinten.length > 1) kandidaten.push(basis + hinten[1]);
  for (let ziffer = 2; ziffer <= 99; ziffer++) kandidaten.push(basis + ziffer);

  return kandidaten.find((k) => !nichtVerfuegbar.has(k)) ?? null;
}
