import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

// Vite-Einstellungen. Im Betrieb liefert Apache das gebaute frontend/dist aus und leitet
// /api selbst weiter. Der Proxy unten gilt nur für den Entwicklungsserver (pnpm dev).
export default defineConfig(({ mode }) => {
  // Liest frontend/.env. Variablen ohne Präfix VITE_ bleiben in dieser Datei und
  // gelangen nie in den Browser-Code.
  const env = loadEnv(mode, import.meta.dirname, '');
  // Adresse des Backends. Im Betrieb 3000. Solange das Altsystem diesen Port belegt,
  // steht in frontend/.env z. B. API_ZIEL=http://127.0.0.1:3001.
  const apiZiel = env.API_ZIEL || 'http://127.0.0.1:3000';

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        // Gemeinsamer Code aus dem Backend (Regeln, Schemas, Rechte). Das Frontend liest
        // ihn direkt dort und führt nie eine eigene Kopie. Gegenstück in tsconfig.json.
        '@shared': fileURLToPath(new URL('../backend/src/shared', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': apiZiel,
      },
    },
  };
});
