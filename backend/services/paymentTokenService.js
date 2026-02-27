/**
 * Token de paiement après signature (facture). Courte durée de vie (1 h).
 * One-shot : invalidation après premier usage (prévention replay).
 */
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

const TOKEN_BYTES = 32;
const EXPIRES_HOURS = 1;

/**
 * Crée un token de paiement pour une facture signée.
 * @param {{ invoiceId: string, userId: string }}
 * @returns {Promise<{ token: string, expiresAt: Date }>}
 */
export async function createPaymentToken({ invoiceId, userId }) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000);
  await prisma.paymentToken.create({
    data: { token, invoiceId, userId, expiresAt }
  });
  return { token, expiresAt };
}

/**
 * Valide et consomme un token de paiement (one-shot).
 * Atomique : si valide, marque usedAt et retourne le payload.
 * @param {string} token
 * @returns {Promise<{ invoiceId: string, userId: string }|null>}
 */
export async function validatePaymentToken(token) {
  if (!token || typeof token !== 'string') return null;
  const t = token.trim();
  const now = new Date();
  const rows = await prisma.$queryRaw`
    UPDATE payment_token
    SET used_at = NOW()
    WHERE token = ${t} AND used_at IS NULL AND expires_at > ${now}
    RETURNING invoice_id AS "invoiceId", user_id AS "userId"
  `;
  if (!rows || rows.length === 0) return null;
  return rows[0];
}
