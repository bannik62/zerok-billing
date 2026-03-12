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
export const NUMERO_LABEL_MAX = 80;
export const DOCUMENT_ID_MAX = 100;
export const FILENAME_MAX = 255;
export const MIMETYPE_MAX = 100;
export const HASH_HEX_LENGTH = 64;
export const SIGNATURE_MAX = 512;
export const VERIFY_BATCH_MAX = 200;
export const PROOFS_SYNC_MAX = 500;

// ——— Rate limit auth ———
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_LIMIT_MAX = 10;

// ——— Rate limit recovery (GET recovery-data, POST reset-password) ———
export const RECOVERY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RECOVERY_RATE_LIMIT_MAX = 5;

// ——— Recovery data (salt + keyCheck) ———
export const RECOVERY_SALT_MAX_LENGTH = 512;
export const RECOVERY_KEY_CHECK_PAYLOAD_MAX_LENGTH = 1024;
export const RECOVERY_KEY_CHECK_IV_MAX_LENGTH = 128;

// ——— Server / session ———
export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const JSON_BODY_LIMIT = '100mb';

// ——— Pièce jointe email (PDF) ———
export const PDF_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo

// Prospect (chat LLM)
export const PROSPECT_CHAT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const PROSPECT_CHAT_RATE_LIMIT_MAX = 10;

// Paiement (plugins multi-provider)
export const PAYMENT_PROVIDERS = ['stripe'];
export const PAYMENT_SECRET_KEY_MAX = 256;
export const CURRENCY_LENGTH = 3; // ISO 4217
export const AMOUNT_CENTS_MIN = 50; // Montant minimum Stripe (0,50 €)
export const AMOUNT_CENTS_MAX = 999_999_99; // 999 999,99 €
