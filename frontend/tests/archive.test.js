import { describe, it, expect } from 'vitest';
import { createArchive, openArchive } from '../src/lib/archive.js';

describe('archive', () => {
  const bundle = {
    devis: [{ id: 'd1' }],
    factures: [{ id: 'f1' }],
    clients: [{ id: 'c1' }],
    societe: { id: 'societe', nom: 'ACME' },
    layoutProfiles: [{ id: 'p1', name: 'Classique' }]
  };

  it('createArchive + openArchive font un roundtrip', async () => {
    const password = 'MotDePasseArchive!';
    const archive = await createArchive(bundle, password);

    expect(archive).toHaveProperty('v', 1);
    expect(typeof archive.salt).toBe('string');
    expect(typeof archive.iv).toBe('string');
    expect(typeof archive.payload).toBe('string');

    const reopened = await openArchive(JSON.stringify(archive), password);
    expect(reopened).toEqual(bundle);
  });

  it('openArchive échoue avec mauvais mot de passe', async () => {
    const archive = await createArchive(bundle, 'bon-mot-de-passe');

    await expect(openArchive(JSON.stringify(archive), 'mauvais-mot-de-passe')).rejects.toThrow();
  });

  it('openArchive rejette une version non supportée', async () => {
    const invalid = {
      v: 999,
      salt: 'x',
      iv: 'y',
      payload: 'z'
    };

    await expect(openArchive(JSON.stringify(invalid), 'x')).rejects.toThrow(/Format d'archive non supporté/);
  });
});
