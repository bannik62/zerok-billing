/**
 * Dérivation de clé à partir du mot de passe (PBKDF2).
 * Si recoveryPhrase est fourni, la clé est dérivée de password + '\0' + recoveryPhrase (même clé après reset mdp).
 */

const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH_BITS = 256;
const ALGO = 'AES-GCM';
const KEY_USAGE = ['encrypt', 'decrypt'];

/**
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {string|null|undefined} [recoveryPhrase] - Optionnel. Si fourni, entrée PBKDF2 = password + '\0' + recoveryPhrase
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, salt, recoveryPhrase = null) {
  const enc = new TextEncoder();
  const secret =
    recoveryPhrase != null && recoveryPhrase !== ''
      ? password + '\0' + recoveryPhrase
      : password;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGO, length: KEY_LENGTH_BITS },
    false,
    KEY_USAGE
  );
}

export function generateSalt(length = 16) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function saltToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

export function saltFromBase64(base64) {
  const bin = atob(base64);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}
