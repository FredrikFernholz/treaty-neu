import { BEREICHE, RECHTEMATRIX, ZUSATZRECHT_BEZEICHNUNG } from '@shared/rechte/rechtematrix.js';

// Kreuzchenliste der Nutzerverwaltung (Felddoku Geteilte Funktionen): welche
// Berechtigungsstufe welchen Bereich nutzen darf und welches Zusatzrecht ihn für
// Sachbearbeiter/innen freischaltet. Gebildet direkt aus derselben RECHTEMATRIX, die auch
// die Sperre im Server steuert. Anzeige und Wirkung können so nicht auseinanderlaufen.

export type Kreuzchenzeile = {
  bereich: string;
  administrator: boolean;
  sachbearbeiter: boolean;
  /** Bezeichnung des Zusatzrechts, das den Bereich freischaltet, oder null. */
  perZusatzrecht: string | null;
};

export function kreuzchenliste(): Kreuzchenzeile[] {
  return BEREICHE.map((bereich) => {
    const regel = RECHTEMATRIX[bereich];
    return {
      bereich: regel.bezeichnung,
      administrator: true,
      sachbearbeiter: regel.sachbearbeiter,
      perZusatzrecht: regel.zusatzrecht === null ? null : ZUSATZRECHT_BEZEICHNUNG[regel.zusatzrecht],
    };
  });
}
