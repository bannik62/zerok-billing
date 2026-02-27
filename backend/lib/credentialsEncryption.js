/**
 * Chiffrement des credentials (clé Stripe, etc.) en base.
 * AES-256-GCM, IV 12 bytes, clé dérivée de CREDENTIALS_ENCRYPTION_KEY.
 */
import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const raw = env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || typeof raw !== 'string') return null;
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== KEY_LENGTH) return null;
  return buf;
}

/**
 * Chiffre un objet credentials (ex. { secretKey: 'sk_...' }).
 * @param {object} credentials
 * @returns {object} { encrypted: string (base64), iv: string (base64), tag: string (base64) } ou null si pas de clé
 */
export function encryptCredentials(credentials) {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const plain = JSON.stringify(credentials);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

/**
 * Déchiffre des credentials.
 * @param {object} stored - { encrypted, iv, tag } ou { secretKey } (legacy)
 * @returns {object|null} { secretKey } ou null
 */
export function decryptCredentials(stored) {
  if (!stored || typeof stored !== 'object') return null;
  if (stored.secretKey && typeof stored.secretKey === 'string') {
    return stored;
  }
  const key = getKey();
  if (!key || !stored.encrypted || !stored.iv || !stored.tag) return null;
  try {
    const iv = Buffer.from(stored.iv, 'base64');
    const tag = Buffer.from(stored.tag, 'base64');
    const encrypted = Buffer.from(stored.encrypted, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    const plain = decipher.update(encrypted) + decipher.final('utf8');
    return JSON.parse(plain);
  } catch {
    return null;
  }
}

/**
 * Indique si le chiffrement est configuré.
 */
export function isEncryptionAvailable() {
  return getKey() !== null;
}
