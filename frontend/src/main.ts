import { VueQueryPlugin } from '@tanstack/vue-query';
import ElementPlus from 'element-plus';
import de from 'element-plus/es/locale/lang/de';
import 'element-plus/dist/index.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { globaleFehlerbehandlung } from './api/client';
import { router } from './router';
import { useSitzung } from './stores/sitzung';

// Einstiegspunkt der Vue-Anwendung. Hier werden alle Bausteine einmal angemeldet.
const app = createApp(App);

// Element Plus mit deutscher Sprachdatei (Datumsauswahl, Tabellen, Paginierung usw.)
app.use(ElementPlus, { locale: de });
// Gemeinsamer Zustand im Browser, etwa die angemeldete Person. Vor dem Router, weil der
// Router-Schutz schon beim ersten Seitenaufruf auf die Sitzung zugreift.
app.use(createPinia());
// Seitenwechsel ohne Neuladen
app.use(router);
// Abruf und Zwischenspeicher von Serverdaten
app.use(VueQueryPlugin);

// Antwortet der Server irgendwo mit 401, ist die Sitzung abgelaufen oder beendet worden:
// im Browser vergessen und zur Anmeldung, danach zurück zur aktuellen Seite.
globaleFehlerbehandlung.nichtAngemeldet = () => {
  useSitzung().vergessen();
  const aktuell = router.currentRoute.value;
  if (!aktuell.meta.oeffentlich) {
    void router.replace({ name: 'anmelden', query: { ziel: aktuell.fullPath, grund: 'abgelaufen' } });
  }
};
// Verlangt der Server einen Passwortwechsel, dorthin führen.
globaleFehlerbehandlung.passwortWechselNoetig = () => {
  void router.replace({ name: 'passwort-aendern' });
};

app.mount('#app');
