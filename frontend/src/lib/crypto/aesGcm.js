/**
 * Chiffrement / dechiffrement AES-GCM (objet JSON).
 * Module reutilisable, sans dependance metier.
 */

const IV_LENGTH_BYTES = 12;

export async function encrypt(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  return {
    payload: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv)
  };
}

export async function decrypt(encrypted, key) {
  const iv = base64ToArrayBuffer(encrypted.iv);
  const ciphertext = base64ToArrayBuffer(encrypted.payload);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plaintext));
}

const B64_CHUNK = 8192;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    const chunk = bytes.subarray(i, Math.min(i + B64_CHUNK, bytes.length));
    let chunkStr = '';
    for (let j = 0; j < chunk.length; j++) {
      chunkStr += String.fromCharCode(chunk[j]);
    }
    binary += chunkStr;
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}
