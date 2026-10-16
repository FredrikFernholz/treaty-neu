import { beforeEach, describe, expect, test } from 'vitest';
import { Fehlversuchssperre, IP_REGEL, KONTO_IP_REGEL } from './fehlversuchssperre.js';

// Die Uhr ist im Test eine einfache Zahl in Millisekunden, die von Hand weitergestellt wird.
let uhr: number;
let sperre: Fehlversuchssperre;
const S = 1000;
const MIN = 60 * S;

beforeEach(() => {
  uhr = 1_000_000;
  sperre = new Fehlversuchssperre(KONTO_IP_REGEL, () => uhr);
});

/** n Fehlversuche direkt hintereinander, gibt das Ergebnis des letzten zurück. */
function fehlversuche(n: number, schluessel = 'DW|127.0.0.1'): number | null {
  let ergebnis: number | null = null;
  for (let i = 0; i < n; i++) ergebnis = sperre.fehlversuch(schluessel);
  return ergebnis;
}

describe('erste Sperre', () => {
  test('4 Fehlversuche sperren noch nicht', () => {
    expect(fehlversuche(4)).toBeNull();
    expect(sperre.pruefe('DW|127.0.0.1')).toEqual({ gesperrt: false });
  });

  test('der 5. Fehlversuch sperrt für 30 Sekunden', () => {
    expect(fehlversuche(5)).toBe(30 * S);
    expect(sperre.pruefe('DW|127.0.0.1')).toEqual({ gesperrt: true, nochMs: 30 * S });
  });

  test('1 ms vor Ablauf noch gesperrt, bei Ablauf frei', () => {
    fehlversuche(5);
    uhr += 30 * S - 1;
    expect(sperre.pruefe('DW|127.0.0.1')).toEqual({ gesperrt: true, nochMs: 1 });
    uhr += 1;
    expect(sperre.pruefe('DW|127.0.0.1')).toEqual({ gesperrt: false });
  });
});

describe('Verdopplung nach Ablauf jeder Sperre, höchstens 15 Minuten', () => {
  // [Nummer des Fehlversuchs, Dauer der dadurch ausgelösten Sperre]
  test('5. bis 12. Fehlversuch', () => {
    const erwartet = [30 * S, 1 * MIN, 2 * MIN, 4 * MIN, 8 * MIN, 15 * MIN, 15 * MIN, 15 * MIN];
    fehlversuche(4);
    const tatsaechlich = erwartet.map(() => {
      const dauer = sperre.fehlversuch('DW|127.0.0.1');
      uhr += dauer ?? 0; // genau bis zum Ende der Sperre warten
      return dauer;
    });
    expect(tatsaechlich).toEqual(erwartet);
  });
});

describe('Versuche während einer Sperre', () => {
  test('zählen nicht und verlängern die Sperre nicht', () => {
    fehlversuche(5);
    uhr += 10 * S;
    expect(fehlversuche(20)).toBeNull();
    expect(sperre.pruefe('DW|127.0.0.1')).toEqual({ gesperrt: true, nochMs: 20 * S });
    uhr += 20 * S;
    // Der nächste Fehlversuch ist der 6., nicht der 26.
    expect(sperre.fehlversuch('DW|127.0.0.1')).toBe(1 * MIN);
  });
});

describe('ersteMeldungWaehrendSperre', () => {
  test('ohne Sperre false', () => {
    fehlversuche(4);
    expect(sperre.ersteMeldungWaehrendSperre('DW|127.0.0.1')).toBe(false);
  });

  test('während einer Sperre nur beim ersten Mal true', () => {
    fehlversuche(5);
    const meldungen = Array.from({ length: 50 }, () => sperre.ersteMeldungWaehrendSperre('DW|127.0.0.1'));
    expect(meldungen.filter(Boolean)).toHaveLength(1);
    expect(meldungen[0]).toBe(true);
  });

  test('jede neue Sperre darf wieder einmal gemeldet werden', () => {
    fehlversuche(5);
    expect(sperre.ersteMeldungWaehrendSperre('DW|127.0.0.1')).toBe(true);
    uhr += 30 * S;
    expect(sperre.ersteMeldungWaehrendSperre('DW|127.0.0.1')).toBe(false); // Sperre vorbei
    sperre.fehlversuch('DW|127.0.0.1'); // neue Sperre, 1 min
    expect(sperre.ersteMeldungWaehrendSperre('DW|127.0.0.1')).toBe(true);
    expect(sperre.ersteMeldungWaehrendSperre('DW|127.0.0.1')).toBe(false);
  });

  test('getrennt je Schlüssel', () => {
    fehlversuche(5, 'A');
    fehlversuche(5, 'B');
    expect(sperre.ersteMeldungWaehrendSperre('A')).toBe(true);
    expect(sperre.ersteMeldungWaehrendSperre('B')).toBe(true);
  });
});

describe('vergissMitAnfang', () => {
  test('löscht nur die Zähler mit diesem Schlüsselanfang', () => {
    fehlversuche(5, 'DW|127.0.0.1');
    fehlversuche(5, 'DW|10.0.0.5');
    fehlversuche(5, 'DWX|127.0.0.1'); // anderes Kürzel, das mit DW beginnt
    expect(sperre.vergissMitAnfang('DW|')).toBe(2);
    expect(sperre.pruefe('DW|127.0.0.1')).toEqual({ gesperrt: false });
    expect(sperre.pruefe('DW|10.0.0.5')).toEqual({ gesperrt: false });
    expect(sperre.pruefe('DWX|127.0.0.1')).toMatchObject({ gesperrt: true });
  });
});

describe('erfolgreiche Anmeldung', () => {
  test('setzt den Zähler zurück', () => {
    fehlversuche(4);
    sperre.erfolg('DW|127.0.0.1');
    expect(fehlversuche(4)).toBeNull();
    expect(sperre.fehlversuch('DW|127.0.0.1')).toBe(30 * S); // erst jetzt wieder der 5.
  });

  test('beendet auch eine Eskalation', () => {
    fehlversuche(5);
    uhr += 30 * S;
    sperre.erfolg('DW|127.0.0.1');
    expect(fehlversuche(5)).toBe(30 * S); // wieder 30s, nicht 60s
  });
});

describe('Schlüssel sind unabhängig', () => {
  test('eine Sperre für einen Schlüssel betrifft andere nicht', () => {
    fehlversuche(5, 'DW|127.0.0.1');
    expect(sperre.pruefe('DW|10.0.0.5')).toEqual({ gesperrt: false });
    expect(sperre.pruefe('AB|127.0.0.1')).toEqual({ gesperrt: false });
  });
});

describe('Vergessen nach 60 Minuten Ruhe', () => {
  test('4 Fehlversuche, 60 Minuten Ruhe, dann zählt es wieder ab 1', () => {
    fehlversuche(4);
    uhr += 60 * MIN;
    expect(fehlversuche(4)).toBeNull();
    expect(sperre.fehlversuch('DW|127.0.0.1')).toBe(30 * S);
  });

  test('1 ms vor Ablauf der Ruhezeit wird noch weitergezählt', () => {
    fehlversuche(4);
    uhr += 60 * MIN - 1;
    expect(sperre.fehlversuch('DW|127.0.0.1')).toBe(30 * S);
  });

  test('die Ruhezeit beginnt erst mit dem Ende einer Sperre', () => {
    fehlversuche(5); // 30s Sperre
    uhr += 30 * S + 59 * MIN; // Sperre vorbei, aber erst 59 min Ruhe danach
    expect(sperre.fehlversuch('DW|127.0.0.1')).toBe(1 * MIN); // weiter eskaliert
  });

  test('aufraeumen entfernt vergessene Einträge', () => {
    fehlversuche(2, 'A');
    fehlversuche(2, 'B');
    uhr += 40 * MIN;
    fehlversuche(1, 'C');
    uhr += 20 * MIN;
    sperre.aufraeumen();
    expect(sperre.anzahlEintraege).toBe(1); // nur C ist jünger als 60 min
  });
});

describe('IP_REGEL: Zähler nur je IP über alle Konten', () => {
  let ipSperre: Fehlversuchssperre;
  beforeEach(() => {
    ipSperre = new Fehlversuchssperre(IP_REGEL, () => uhr);
  });

  test('19 Fehlversuche sperren noch nicht, der 20. für 30 Sekunden', () => {
    for (let i = 0; i < 19; i++) expect(ipSperre.fehlversuch('10.0.0.5')).toBeNull();
    expect(ipSperre.fehlversuch('10.0.0.5')).toBe(30 * S);
  });

  test('Eskalation bis höchstens 5 Minuten', () => {
    const erwartet = [30 * S, 1 * MIN, 2 * MIN, 4 * MIN, 5 * MIN, 5 * MIN];
    for (let i = 0; i < 19; i++) ipSperre.fehlversuch('10.0.0.5');
    const tatsaechlich = erwartet.map(() => {
      const dauer = ipSperre.fehlversuch('10.0.0.5');
      uhr += dauer ?? 0;
      return dauer;
    });
    expect(tatsaechlich).toEqual(erwartet);
  });

  test('wird ebenfalls nach 60 Minuten Ruhe vergessen', () => {
    for (let i = 0; i < 19; i++) ipSperre.fehlversuch('10.0.0.5');
    uhr += 60 * MIN;
    expect(ipSperre.fehlversuch('10.0.0.5')).toBeNull();
  });
});
