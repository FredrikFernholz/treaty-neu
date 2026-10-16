// Anzeige von Zeitpunkten. Der Server liefert UTC (ISO-Text), angezeigt wird deutsche
// Zeit, unabhängig davon, in welcher Zeitzone der Rechner eingestellt ist.

const FORMAT = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
});

/** "2026-10-16T14:05:00.000Z" → "16.10.2026, 16:05" */
export function zeitpunkt(iso: string): string {
  return FORMAT.format(new Date(iso));
}
