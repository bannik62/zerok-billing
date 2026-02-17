/**
 * Derivation de cle a partir du mot de passe (PBKDF2).
 */

const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH_BITS = 256;
const ALGO = 'AES-GCM';
const KEY_USAGE = ['encrypt', 'decrypt'];

export async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
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
