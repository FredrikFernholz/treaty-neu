import { BEREICHE, RECHTEMATRIX, ZUSATZRECHT_BEZEICHNUNG } from '@shared/rechte/rechtematrix.js';

// Kreuzchenliste der Nutzerverwaltung (Felddoku Geteilte Funktionen): welche
// Berechtigungsstufe welchen Bereich nutzen darf und welches Zusatzrecht ihn für
// Sachbearbeiter/innen freischaltet. Gebildet direkt aus derselben RECHTEMATRIX, die auch
// die Sperre im Server steuert. Anzeige und Wirkung können so nicht auseinanderlaufen.

export type Kreuzchenzeile = {
  bereich: string;
  administrator: boolean;
  sachbearbeiter: boolean;
  /** Einschränkung für Sachbearbeiter/innen trotz Zugang, etwa "nur eigene", oder null. */
  sachbearbeiterHinweis: string | null;
  /** Bezeichnung des Zusatzrechts, das den Bereich freischaltet oder erweitert, oder null. */
  perZusatzrecht: string | null;
};

export function kreuzchenliste(): Kreuzchenzeile[] {
  return BEREICHE.map((bereich) => {
    const regel = RECHTEMATRIX[bereich];
    // Die Zeiterfassung ist für alle offen, Sachbearbeiter/innen sehen aber nur die eigenen
    // Buchungen, außer mit dem Zusatzrecht zeiterfassung_alle (siehtAlleZeitbuchungen in
    // der Rechtematrix). Das gehört in diese Zeile, auch wenn es keinen Bereich freischaltet.
    if (bereich === 'zeiterfassung') {
      return {
        bereich: regel.bezeichnung,
        administrator: true,
        sachbearbeiter: true,
        sachbearbeiterHinweis: 'nur eigene',
        perZusatzrecht: ZUSATZRECHT_BEZEICHNUNG.zeiterfassung_alle,
      };
    }
    return {
      bereich: regel.bezeichnung,
      administrator: true,
      sachbearbeiter: regel.sachbearbeiter,
      sachbearbeiterHinweis: null,
      perZusatzrecht: regel.zusatzrecht === null ? null : ZUSATZRECHT_BEZEICHNUNG[regel.zusatzrecht],
    };
  });
}
