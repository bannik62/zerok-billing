/**
 * Hash et chiffrement de fichiers (coffre-fort).
 * SHA-256 pour la preuve d'intégrité, AES-GCM pour le contenu (même clé que devis/factures).
 */

const IV_LENGTH_BYTES = 12;

/** Taille de chunk pour éviter "Maximum call stack size exceeded" avec de gros buffers. */
const B64_CHUNK = 8192;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    const chunk = bytes.subarray(i, Math.min(i + B64_CHUNK, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
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

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calcule le hash SHA-256 du fichier (avant chiffrement). Pour preuve d'intégrité.
 * @param {File|ArrayBuffer} fileOrBuffer
 * @returns {Promise<string>} 64 caractères hexadécimaux
 */
export async function hashFile(fileOrBuffer) {
  const buffer = fileOrBuffer instanceof ArrayBuffer
    ? fileOrBuffer
    : await fileOrBuffer.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Chiffre un fichier avec AES-GCM (même algo que devis/factures).
 * @param {File|ArrayBuffer} fileOrBuffer
 * @param {CryptoKey} key - clé dérivée du mot de passe
 * @returns {Promise<{ payload: string, iv: string, mimeType: string, originalSize: number }>}
 */
export async function encryptFile(fileOrBuffer, key) {
  const isFile = fileOrBuffer instanceof File;
  const buffer = isFile
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;
  const mimeType = isFile ? fileOrBuffer.type || 'application/octet-stream' : 'application/octet-stream';
  const originalSize = buffer.byteLength;

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer
  );
  return {
    payload: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    mimeType,
    originalSize
  };
}

/**
 * Déchiffre un fichier et retourne un Blob (téléchargement ou preview).
 * @param {{ payload: string, iv: string, mimeType: string }} encrypted
 * @param {CryptoKey} key
 * @returns {Promise<Blob>}
 */
export async function decryptFile(encrypted, key) {
  const iv = base64ToArrayBuffer(encrypted.iv);
  const ciphertext = base64ToArrayBuffer(encrypted.payload);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new Blob([decrypted], { type: encrypted.mimeType || 'application/octet-stream' });
}
