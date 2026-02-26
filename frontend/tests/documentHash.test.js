import { describe, it, expect } from 'vitest';
import { canonicalDocumentForHash, hashDocument } from '../src/lib/crypto/documentHash.js';

describe('documentHash', () => {
  const baseDoc = {
    id: 'doc-1',
    entete: { numero: 'DEV-001', clientId: 'c1', tvaTaux: 20 },
    lignes: [{ designation: 'Prestation', quantite: 1, prixUnitaire: 100 }],
    reduction: { type: 'percent', value: 0 },
    sousTotal: 100,
    total: 100,
    tvaMontant: 20,
    totalTTC: 120
  };

  it('canonicalDocumentForHash ignore blockPositions et createdAt', () => {
    const a = canonicalDocumentForHash(
      { ...baseDoc, blockPositions: { a: 1 }, createdAt: '2026-01-01T00:00:00.000Z' },
      'devis'
    );
    const b = canonicalDocumentForHash(
      { ...baseDoc, blockPositions: { b: 2 }, createdAt: '2027-01-01T00:00:00.000Z' },
      'devis'
    );
    expect(a).toBe(b);
  });

  it('hashDocument retourne un SHA-256 hex stable', async () => {
    const h1 = await hashDocument(baseDoc, 'devis');
    const h2 = await hashDocument(baseDoc, 'devis');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashDocument change si le contenu métier change', async () => {
    const h1 = await hashDocument(baseDoc, 'devis');
    const h2 = await hashDocument({ ...baseDoc, total: 101 }, 'devis');
    expect(h1).not.toBe(h2);
  });
});
