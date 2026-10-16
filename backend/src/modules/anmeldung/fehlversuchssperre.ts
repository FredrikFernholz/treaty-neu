// Sperre nach wiederholten Fehlversuchen bei der Anmeldung (Konzeption 9,
// Entscheidung 16.10.2026).
//
// Es gibt zwei Zähler mit eigener Regel:
//  - je Paar aus Konto und IP: nach 5 Fehlversuchen gesperrt, zunächst für 30 Sekunden.
//    Jeder weitere Fehlversuch nach Ablauf einer Sperre sperrt doppelt so lange wie
//    zuvor, höchstens 15 Minuten: 30s, 1 min, 2 min, 4 min, 8 min, dann immer 15 min.
//  - nur je IP, über alle Konten: nach 20 Fehlversuchen wird die IP gesperrt, ebenfalls
//    ab 30 Sekunden verdoppelt, höchstens 5 Minuten. Das bremst das Durchprobieren
//    vieler Kürzel von einer Adresse aus.
// Eine erfolgreiche Anmeldung setzt nur den Zähler für Konto und IP zurück, nicht den
// reinen IP-Zähler (das entscheidet die Anmelderoute). Ein Zähler wird nach
// 60 Minuten ohne neuen Fehlversuch vergessen, gerechnet ab dem letzten Fehlversuch
// bzw. dem Ende der letzten Sperre. Danach beginnt die Zählung wieder bei null.
//
// Während einer Sperre prüft die Anmeldung das Passwort gar nicht erst. Solche Versuche
// zählen nicht als weitere Fehlversuche und verlängern die Sperre nicht, sonst ließe
// sich ein Konto durch Dauerversuche beliebig lange sperren.
//
// Eine Instanz zählt je Schlüssel nach einer Regel. Die Anmelderoute verwendet zwei
// Instanzen, eine mit KONTO_IP_REGEL (Schlüssel aus Kürzel und IP) und eine mit
// IP_REGEL (Schlüssel nur die IP).
//
// Die Zähler liegen im Speicher des API-Prozesses. Für einen einzelnen Prozess reicht
// das. Bei mehreren Prozessen müssten sie in die Datenbank (Konzeption 9). Nach einem
// Neustart des Prozesses sind alle Zähler und Sperren weg.

export type Sperrregel = {
  /** Ab diesem Fehlversuch wird gesperrt. */
  fehlversucheBisZurSperre: number;
  /** Dauer der ersten Sperre, jede weitere doppelt so lang. */
  ersteSperreMs: number;
  /** Obergrenze für die Dauer einer Sperre. */
  laengsteSperreMs: number;
  /** Ruhezeit ohne Fehlversuch, nach der ein Zähler vergessen wird. */
  vergessenNachMs: number;
};

const SEKUNDE = 1000;
const MINUTE = 60 * SEKUNDE;

/** Paar aus Konto und IP (Konzeption 9). */
export const KONTO_IP_REGEL: Sperrregel = {
  fehlversucheBisZurSperre: 5,
  ersteSperreMs: 30 * SEKUNDE,
  laengsteSperreMs: 15 * MINUTE,
  vergessenNachMs: 60 * MINUTE,
};

/** Nur die IP, über alle Konten (Entscheidung 16.10.2026). */
export const IP_REGEL: Sperrregel = {
  fehlversucheBisZurSperre: 20,
  ersteSperreMs: 30 * SEKUNDE,
  laengsteSperreMs: 5 * MINUTE,
  vergessenNachMs: 60 * MINUTE,
};

type Eintrag = {
  fehlversuche: number;
  letzterFehlversuch: number;
  /** Zeitpunkt in ms, bis zu dem gesperrt ist, 0 ohne Sperre. */
  gesperrtBis: number;
  /** true, sobald ein Versuch während der laufenden Sperre protokolliert wurde. */
  sperreGemeldet: boolean;
};

export type Sperrstand = { gesperrt: false } | { gesperrt: true; nochMs: number };

export class Fehlversuchssperre {
  private readonly eintraege = new Map<string, Eintrag>();

  /** jetzt liefert die aktuelle Zeit in Millisekunden. Tests geben eine eigene Uhr vor. */
  constructor(
    private readonly regel: Sperrregel,
    private readonly jetzt: () => number = Date.now,
  ) {}

  /** Ob für den Schlüssel gerade eine Sperre gilt, und wie lange noch. */
  pruefe(schluessel: string): Sperrstand {
    const eintrag = this.aktuellerEintrag(schluessel);
    const nochMs = eintrag ? eintrag.gesperrtBis - this.jetzt() : 0;
    return nochMs > 0 ? { gesperrt: true, nochMs } : { gesperrt: false };
  }

  /**
   * Zählt einen Fehlversuch. Löst er eine Sperre aus, wird ihre Dauer in ms
   * zurückgegeben (für das Sicherheitsprotokoll), sonst null. Während einer laufenden
   * Sperre wird nichts gezählt.
   */
  fehlversuch(schluessel: string): number | null {
    this.aufraeumen();
    const zeit = this.jetzt();
    const eintrag = this.aktuellerEintrag(schluessel) ?? {
      fehlversuche: 0,
      letzterFehlversuch: zeit,
      gesperrtBis: 0,
      sperreGemeldet: false,
    };
    if (eintrag.gesperrtBis > zeit) return null;

    eintrag.fehlversuche += 1;
    eintrag.letzterFehlversuch = zeit;
    this.eintraege.set(schluessel, eintrag);

    const { fehlversucheBisZurSperre, ersteSperreMs, laengsteSperreMs } = this.regel;
    if (eintrag.fehlversuche < fehlversucheBisZurSperre) return null;
    // Bei KONTO_IP_REGEL: 5. Fehlversuch 30s, 6. 60s, 7. 120s … höchstens 15 min
    const verdopplungen = eintrag.fehlversuche - fehlversucheBisZurSperre;
    const dauer = Math.min(ersteSperreMs * 2 ** verdopplungen, laengsteSperreMs);
    eintrag.gesperrtBis = zeit + dauer;
    eintrag.sperreGemeldet = false;
    return dauer;
  }

  /**
   * true nur beim ersten Aufruf während einer laufenden Sperre, danach false bis zur
   * nächsten Sperre. Damit protokolliert die Anmeldung Versuche während einer Sperre
   * höchstens einmal je Sperre und Schlüssel, und ein automatisierter Angriff kann das
   * Sicherheitsprotokoll nicht fluten (Entscheidung 16.10.2026). Ohne Sperre false.
   */
  ersteMeldungWaehrendSperre(schluessel: string): boolean {
    const eintrag = this.aktuellerEintrag(schluessel);
    if (!eintrag || eintrag.gesperrtBis <= this.jetzt() || eintrag.sperreGemeldet) return false;
    eintrag.sperreGemeldet = true;
    return true;
  }

  /** Erfolgreiche Anmeldung: Zähler und Sperre für den Schlüssel entfallen. */
  erfolg(schluessel: string): void {
    this.eintraege.delete(schluessel);
  }

  /** Entfernt alle Einträge, die vergessen werden können. Hält den Speicher klein. */
  aufraeumen(): void {
    for (const [schluessel, eintrag] of this.eintraege) {
      if (this.istVergessen(eintrag)) this.eintraege.delete(schluessel);
    }
  }

  /** Anzahl der gespeicherten Einträge, nur für Tests und Überwachung. */
  get anzahlEintraege(): number {
    return this.eintraege.size;
  }

  private istVergessen(eintrag: Eintrag): boolean {
    const ruheBeginn = Math.max(eintrag.letzterFehlversuch, eintrag.gesperrtBis);
    return this.jetzt() - ruheBeginn >= this.regel.vergessenNachMs;
  }

  private aktuellerEintrag(schluessel: string): Eintrag | undefined {
    const eintrag = this.eintraege.get(schluessel);
    if (eintrag && this.istVergessen(eintrag)) {
      this.eintraege.delete(schluessel);
      return undefined;
    }
    return eintrag;
  }
}
