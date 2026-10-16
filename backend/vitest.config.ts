import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// Tests lesen dieselbe backend/.env wie die Anwendung. NODE_ENV=test sorgt dafür,
// dass die Anwendung die Testdatenbank (DB_TEST_NAME) verwendet und nie die echten Daten.
const env = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Testdateien nacheinander ausführen, nicht parallel. Viele Tests arbeiten mit der
    // gemeinsamen Testdatenbank. Manche Regeln hängen vom Gesamtbestand ab, etwa "es
    // gibt noch keinen aktiven Administrator". Parallel laufende Dateien würden sich
    // dabei gegenseitig stören. Kostet etwa 5 Sekunden mehr (Stand 16.10.2026).
    fileParallelism: false,
    env: { ...env, NODE_ENV: 'test' },
  },
});
