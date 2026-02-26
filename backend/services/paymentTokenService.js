/**
 * Token de paiement après signature (facture). Courte durée de vie (1 h).
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
 * Valide un token de paiement : existe, non expiré.
 * @param {string} token
 * @returns {Promise<{ invoiceId: string, userId: string }|null>}
 */
export async function validatePaymentToken(token) {
  if (!token || typeof token !== 'string') return null;
  const row = await prisma.paymentToken.findUnique({ where: { token: token.trim() } });
  if (!row || new Date() > row.expiresAt) return null;
  return { invoiceId: row.invoiceId, userId: row.userId };
}
