/**
 * Constantes métier et config (validation, rate limit, session, body).
 * Seule source de vérité ; validators et routes importent d'ici.
 */

// ——— Auth / validation utilisateur ———
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 255;
export const NOM_MAX_LENGTH = 100;
export const PRENOM_MAX_LENGTH = 100;
export const ADRESSE_MAX_LENGTH = 255;

// ——— Proofs / documents (secure) ———
export const INVOICE_ID_MAX = 100;
export const DOCUMENT_ID_MAX = 100;
export const FILENAME_MAX = 255;
export const MIMETYPE_MAX = 100;
export const HASH_HEX_LENGTH = 64;
export const SIGNATURE_MAX = 512;
export const VERIFY_BATCH_MAX = 200;

// ——— Rate limit auth ———
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_LIMIT_MAX = 10;

// ——— Server / session ———
export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const JSON_BODY_LIMIT = '512kb';
