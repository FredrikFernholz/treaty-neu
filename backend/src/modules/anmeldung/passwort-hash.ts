import { hash, verify, type Algorithm } from '@node-rs/argon2';
import { ARGON2_PARAMETER } from '../../config.js';

// Hashen und Prüfen von Passwörtern mit argon2id (Konzeption 9, Entscheidung 16.10.2026).
//
// Gespeichert wird nur der Hash. Er enthält Verfahren, Parameter und ein zufälliges Salz,
// z. B. "$argon2id$v=19$m=19456,t=2,p=1$<Salz>$<Hash>". Dasselbe Passwort ergibt deshalb
// jedes Mal einen anderen Hash. Beide Funktionen sind asynchron, damit die Rechenzeit
// von argon2 den Server nicht blockiert.

const OPTIONEN = { ...ARGON2_PARAMETER, algorithm: ARGON2_PARAMETER.algorithm as Algorithm };

/** Hasht ein Passwort für die Spalte benutzer.passwort_hash. */
export async function hashePasswort(passwort: string): Promise<string> {
  return hash(passwort, OPTIONEN);
}

/**
 * true, wenn das Passwort zum gespeicherten Hash passt. Die Parameter liest argon2 aus
 * dem Hash selbst. Ein beschädigter Hash führt zu einer Ausnahme statt zu false, damit
 * ein Datenfehler auffällt und nicht wie ein falsches Passwort aussieht.
 */
export async function pruefePasswort(passwort: string, gespeicherterHash: string): Promise<boolean> {
  return verify(gespeicherterHash, passwort);
}
