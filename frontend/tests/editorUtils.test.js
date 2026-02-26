import { describe, it, expect } from 'vitest';
import {
  getBlockLabel,
  formatMontant,
  normalisePos,
  buildBlockStyle
} from '../src/modules/editor/utils.js';

describe('editor utils', () => {
  it('getBlockLabel retourne le libellé connu ou fallback', () => {
    expect(getBlockLabel('logo')).toBe('Logo');
    expect(getBlockLabel('unknown')).toBe('unknown');
  });

  it('formatMontant formatte en style fr-FR', () => {
    expect(formatMontant(1234.5)).toMatch(/1.?234,50/);
  });

  it('normalisePos gère left/top ou x/y', () => {
    expect(normalisePos({ left: 1, top: 2, w: 3, h: 4 })).toEqual({ left: 1, top: 2, w: 3, h: 4 });

    const fromXY = normalisePos({ x: 50, y: 50, w: 20, h: 10 });
    expect(fromXY).toEqual({ left: 40, top: 45, w: 20, h: 10 });
  });

  it('buildBlockStyle agrège uniquement les styles définis', () => {
    const style = buildBlockStyle({
      fontSize: 14,
      fontFamily: 'Arial',
      color: '#000000',
      textAlign: 'right',
      fontWeight: 'bold'
    });
    expect(style).toContain('font-size: 14px');
    expect(style).toContain('font-family: Arial');
    expect(style).toContain('color: #000000');
    expect(style).toContain('text-align: right');
    expect(style).toContain('font-weight: bold');
  });
});
