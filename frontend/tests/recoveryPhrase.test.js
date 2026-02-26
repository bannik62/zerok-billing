import { describe, it, expect } from 'vitest';
import { generateRecoveryPhrase, normalizePhrase } from '../src/lib/recoveryPhrase.js';

describe('recoveryPhrase', () => {
  it('normalizePhrase normalise casse, espaces et accents', () => {
    const input = '  Éléphant   Crème  BRÛLÉE ';
    expect(normalizePhrase(input)).toBe('elephant creme brulee');
  });

  it('generateRecoveryPhrase produit 12 mots', () => {
    const wordlist = ['alpha', 'beta', 'gamma', 'delta'];
    const phrase = generateRecoveryPhrase(wordlist);
    const words = phrase.split(' ');
    expect(words).toHaveLength(12);
    for (const word of words) {
      expect(wordlist.includes(word)).toBe(true);
    }
  });

  it('generateRecoveryPhrase échoue avec une wordlist vide', () => {
    expect(() => generateRecoveryPhrase([])).toThrow(/Wordlist vide/);
  });
});
