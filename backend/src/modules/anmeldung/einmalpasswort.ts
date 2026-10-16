import { randomInt } from 'node:crypto';

// Einmalpasswörter (Konzeption 9). Ein Administrator vergibt sie, und beim ersten
// Anmelden damit muss die Person ein eigenes Passwort festlegen.
//
// Aufbau: 4 Gruppen zu je 5 Zeichen mit Bindestrich, z. B. "kM7pa-Xw3Rt-9hQez-Fb4Nc".
// Das Alphabet lässt leicht verwechselbare Zeichen weg (0 O o, 1 I l), damit sich das
// Passwort fehlerfrei vorlesen oder abtippen lässt. Mit 56 Zeichen und 20 Stellen sind
// das gut 116 Bit Zufall, weit mehr als nötig. Die 23 Zeichen erfüllen die Mindestlänge.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const GRUPPEN = 4;
const ZEICHEN_JE_GRUPPE = 5;

export function erzeugeEinmalpasswort(): string {
  const gruppen = Array.from({ length: GRUPPEN }, () =>
    Array.from({ length: ZEICHEN_JE_GRUPPE }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  );
  return gruppen.join('-');
}
