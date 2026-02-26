import { describe, it, expect } from 'vitest';
import { deriveKey, generateSalt } from '../src/lib/crypto/deriveKey.js';
import { encrypt, decrypt } from '../src/lib/crypto/aesGcm.js';

describe('aesGcm', () => {
  it('chiffre puis déchiffre un objet JSON', async () => {
    const key = await deriveKey('MotDePasse123!', generateSalt(16));
    const original = { a: 1, nested: { b: 'ok' }, arr: [1, 2, 3] };

    const encrypted = await encrypt(original, key);
    expect(encrypted).toHaveProperty('payload');
    expect(encrypted).toHaveProperty('iv');

    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toEqual(original);
  });

  it('génère des iv différents à chaque chiffrement', async () => {
    const key = await deriveKey('MotDePasse123!', generateSalt(16));
    const original = { fixed: true };

    const e1 = await encrypt(original, key);
    const e2 = await encrypt(original, key);

    expect(e1.iv).not.toBe(e2.iv);
    expect(e1.payload).not.toBe(e2.payload);
  });
});
