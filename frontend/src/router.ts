import { createRouter, createWebHistory } from 'vue-router';
import { entscheideNavigation } from './navigation';
import AnmeldeSeite from './seiten/AnmeldeSeite.vue';
import BenutzerSeite from './seiten/BenutzerSeite.vue';
import KeinZugriffSeite from './seiten/KeinZugriffSeite.vue';
import PasswortAendernSeite from './seiten/PasswortAendernSeite.vue';
import Startseite from './seiten/Startseite.vue';
import { useSitzung } from './stores/sitzung';

// Seiten der Anwendung. createWebHistory ergibt saubere Adressen ohne "#".
// Damit ein direkter Aufruf einer Unterseite funktioniert, leitet Apache unbekannte
// Pfade auf index.html um (SPA-Fallback, kommt im Betriebsschritt).
//
// meta legt fest, wer eine Seite sehen darf (siehe navigation.ts). Ohne Angabe braucht
// eine Seite eine Anmeldung, aber keinen besonderen Bereich.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'start', component: Startseite },
    { path: '/anmelden', name: 'anmelden', component: AnmeldeSeite, meta: { oeffentlich: true } },
    {
      path: '/passwort-aendern',
      name: 'passwort-aendern',
      component: PasswortAendernSeite,
      meta: { erlaubtBeiPasswortwechsel: true },
    },
    { path: '/kein-zugriff', name: 'kein-zugriff', component: KeinZugriffSeite },
    { path: '/benutzer', name: 'benutzer', component: BenutzerSeite, meta: { bereich: 'nutzerverwaltung' } },
    // Unbekannte Adressen führen zur Startseite.
    { path: '/:pfad(.*)*', redirect: { name: 'start' } },
  ],
});

// Vor jedem Seitenwechsel: beim ersten Mal beim Server nachfragen, ob eine Sitzung
// besteht, dann nach navigation.ts entscheiden.
router.beforeEach(async (ziel) => {
  const sitzung = useSitzung();
  if (!sitzung.geladen) await sitzung.laden();
  return entscheideNavigation(ziel, sitzung.ich);
});
