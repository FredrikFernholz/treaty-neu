import { darf as darfLautMatrix, type Bereich } from '@shared/rechte/rechtematrix.js';
import type { Ich } from '@shared/schemas/anmeldung.js';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as anmeldungApi from '../api/anmeldung';
import { ApiFehlerAntwort } from '../api/client';

// Die angemeldete Person im Browser. Gefüllt aus GET /api/v1/ich, der Server ist die
// Quelle der Wahrheit. Die Rechte prüft darf() mit derselben Rechtematrix wie der
// Server (@shared/rechte). Was hier ausgeblendet wird, sperrt der Server zusätzlich.

export const useSitzung = defineStore('sitzung', () => {
  const ich = ref<Ich | null>(null);
  /** true, sobald einmal beim Server nachgefragt wurde, ob eine Sitzung besteht. */
  const geladen = ref(false);

  async function laden(): Promise<void> {
    try {
      ich.value = await anmeldungApi.ladeIch();
    } catch (fehler) {
      if (!(fehler instanceof ApiFehlerAntwort) || fehler.code !== 'nicht_angemeldet') throw fehler;
      ich.value = null;
    } finally {
      geladen.value = true;
    }
  }

  async function anmelden(kuerzel: string, passwort: string): Promise<void> {
    ich.value = await anmeldungApi.anmelden(kuerzel, passwort);
    geladen.value = true;
  }

  /** Meldet ab. Auch wenn der Server nicht antwortet, gilt man im Browser als abgemeldet. */
  async function abmelden(): Promise<void> {
    try {
      await anmeldungApi.abmelden();
    } finally {
      vergessen();
    }
  }

  async function passwortAendern(altesPasswort: string, neuesPasswort: string): Promise<void> {
    ich.value = await anmeldungApi.passwortAendern(altesPasswort, neuesPasswort);
  }

  /** Vergisst die Sitzung im Browser, etwa wenn der Server sie für abgelaufen erklärt. */
  function vergessen(): void {
    ich.value = null;
  }

  function darf(bereich: Bereich): boolean {
    return ich.value !== null && darfLautMatrix(ich.value, bereich);
  }

  return { ich, geladen, laden, anmelden, abmelden, passwortAendern, vergessen, darf };
});
