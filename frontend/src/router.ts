import { createRouter, createWebHistory } from 'vue-router';
import Startseite from './seiten/Startseite.vue';

// Seiten der Anwendung. createWebHistory ergibt saubere Adressen ohne "#".
// Damit ein direkter Aufruf einer Unterseite funktioniert, leitet Apache unbekannte
// Pfade auf index.html um (SPA-Fallback, kommt im Betriebsschritt).
export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', name: 'start', component: Startseite }],
});
