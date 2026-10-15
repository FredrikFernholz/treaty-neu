import { z } from 'zod';

// Gemeinsamer Code (backend/src/shared): Backend und Frontend nutzen diese Dateien,
// das Frontend über den Pfad-Alias "@shared". Deshalb gilt hier:
//  - nur reine Funktionen, Schemas und Typen
//  - keine Datenbank, kein Dateisystem, kein Node-spezifischer Code, kein Zugriff auf config.ts
//  - Importe innerhalb von shared mit Endung .js (z. B. './andere.js'), damit sie in beiden
//    Umgebungen funktionieren

/** Antwort von GET /api/health. */
export const healthSchema = z.object({
  status: z.enum(['ok', 'fehler']),
  datenbank: z.enum(['ok', 'nicht erreichbar']),
});

export type Health = z.infer<typeof healthSchema>;
