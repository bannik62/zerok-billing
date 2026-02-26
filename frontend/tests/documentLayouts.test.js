import { describe, it, expect } from 'vitest';
import {
  LAYOUTS,
  DEFAULT_LAYOUT_ID,
  normalizeLayoutId
} from '../src/lib/documentLayouts.js';

describe('documentLayouts', () => {
  it('expose les layouts attendus', () => {
    expect(Array.isArray(LAYOUTS)).toBe(true);
    expect(LAYOUTS.length).toBeGreaterThan(0);
    expect(LAYOUTS.some((l) => l.id === DEFAULT_LAYOUT_ID)).toBe(true);
  });

  it('normalizeLayoutId garde un id valide', () => {
    expect(normalizeLayoutId('moderne')).toBe('moderne');
  });

  it('normalizeLayoutId fallback sur défaut pour invalide/vide', () => {
    expect(normalizeLayoutId('inconnu')).toBe(DEFAULT_LAYOUT_ID);
    expect(normalizeLayoutId('')).toBe(DEFAULT_LAYOUT_ID);
    expect(normalizeLayoutId('   ')).toBe(DEFAULT_LAYOUT_ID);
  });
});
