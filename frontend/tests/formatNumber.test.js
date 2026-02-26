import { describe, it, expect } from 'vitest';
import { formatMontant } from '../src/lib/formatNumber.js';

describe('formatMontant', () => {
  it('formate en fr-FR avec deux décimales', () => {
    expect(formatMontant(1234.5)).toMatch(/1.?234,50/);
    expect(formatMontant(0)).toBe('0,00');
  });

  it('coerce les valeurs non numériques vers Number', () => {
    expect(formatMontant('12.3')).toBe('12,30');
  });
});
