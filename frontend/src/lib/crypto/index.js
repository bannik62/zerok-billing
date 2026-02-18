/**
 * Module crypto réutilisable : PBKDF2 (clé), AES-GCM (chiffrement), SHA-256 (hash d'intégrité).
 * Algorithmes courants et recommandés. Séparation des rôles : pas de logique métier ici.
 */

export {
  deriveKey,
  generateSalt,
  saltToBase64,
  saltFromBase64
} from './deriveKey.js';

export { encrypt, decrypt } from './aesGcm.js';

export {
  canonicalDocumentForHash,
  hashDocument
} from './documentHash.js';

export { hashFile, encryptFile, decryptFile } from './fileEncryption.js';
