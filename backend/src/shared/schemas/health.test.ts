import { describe, expect, test } from 'vitest';
import { healthSchema } from './health.js';

describe('healthSchema', () => {
  test.each([
    [{ status: 'ok', datenbank: 'ok' }],
    [{ status: 'fehler', datenbank: 'nicht erreichbar' }],
  ])('akzeptiert %o', (eingabe) => {
    expect(healthSchema.safeParse(eingabe).success).toBe(true);
  });

  test.each([
    [{ status: 'ok' }],
    [{ status: 'gut', datenbank: 'ok' }],
    [{ status: 'ok', datenbank: 'weg' }],
    ['ok'],
  ])('lehnt %o ab', (eingabe) => {
    expect(healthSchema.safeParse(eingabe).success).toBe(false);
  });
});
