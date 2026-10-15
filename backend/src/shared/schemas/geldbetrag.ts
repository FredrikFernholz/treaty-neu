import { z } from 'zod';

// Geldbeträge werden in der API immer als Text übertragen, nie als JSON-Zahl
// (Entscheidung vom 15.10.2026, docs/entscheidungen.md). Eine JSON-Zahl würde im
// Browser und in Node sofort zu einem ungenauen number. Als Text kommt der Betrag
// unverändert an und wird mit betrag() aus shared/regeln/geld.ts weiterverarbeitet.
//
// Erlaubt ist das Format einer DECIMAL(12,2)-Spalte:
//  - optional ein Minus (z. B. für Stornos und Gutschriften)
//  - 1 bis 10 Stellen vor dem Punkt, ohne führende Nullen ("0" selbst ist erlaubt)
//  - optional ein Punkt mit 1 oder 2 Nachkommastellen
// Beispiele: "0", "12.5", "-30.25", "9999999999.99"
// Nicht erlaubt: "1,50", "1.005", "007", "1e3", " 5", Zahlen statt Text
//
// Felder, die nur positive Beträge zulassen, schränken das Schema an ihrer Stelle
// zusätzlich ein, etwa mit .refine().
const GELDBETRAG_TEXT = /^-?(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

export const geldbetragSchema = z
  .string()
  .regex(GELDBETRAG_TEXT, 'Geldbetrag erwartet als Text mit höchstens 2 Nachkommastellen, z. B. "1234.56"');

export type Geldbetrag = z.infer<typeof geldbetragSchema>;
