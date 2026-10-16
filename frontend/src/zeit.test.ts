import { describe, expect, test } from 'vitest';
import { zeitpunkt } from './zeit';

describe('zeitpunkt', () => {
  test.each([
    ['2026-10-16T14:05:00.000Z', '16.10.2026, 16:05'], // Sommerzeit, UTC+2
    ['2026-12-01T08:00:00.000Z', '01.12.2026, 09:00'], // Winterzeit, UTC+1
    ['2026-10-24T23:30:00.000Z', '25.10.2026, 01:30'], // Datumswechsel durch die Zeitzone
  ])('%s → %s', (iso, erwartet) => {
    expect(zeitpunkt(iso)).toBe(erwartet);
  });
});
