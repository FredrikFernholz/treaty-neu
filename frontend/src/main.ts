import { VueQueryPlugin } from '@tanstack/vue-query';
import ElementPlus from 'element-plus';
import de from 'element-plus/es/locale/lang/de';
import 'element-plus/dist/index.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';

// Einstiegspunkt der Vue-Anwendung. Hier werden alle Bausteine einmal angemeldet.
const app = createApp(App);

// Element Plus mit deutscher Sprachdatei (Datumsauswahl, Tabellen, Paginierung usw.)
app.use(ElementPlus, { locale: de });
// Seitenwechsel ohne Neuladen
app.use(router);
// Gemeinsamer Zustand im Browser, etwa die angemeldete Person (ab Ausbaustufe 1)
app.use(createPinia());
// Abruf und Zwischenspeicher von Serverdaten
app.use(VueQueryPlugin);

app.mount('#app');
