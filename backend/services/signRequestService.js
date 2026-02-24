/**
 * Demande de signature : token one-shot, expiration 30 j.
 */
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

const TOKEN_BYTES = 32;
const EXPIRES_DAYS = 30;

/**
 * Crée une demande de signature.
 * @param {{ invoiceId: string, documentType: string, userId: string }}
 * @returns {Promise<{ token: string, expiresAt: Date }>}
 */
export async function createSignRequest({ invoiceId, documentType, userId }) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await prisma.signRequest.create({
    data: { token, invoiceId, documentType, userId, expiresAt }
  });
  return { token, expiresAt };
}

/**
 * Confirme la signature (one-shot) : token valide, non expiré, pas déjà signé.
 * @param {string} token
 * @returns {Promise<'ok'|'expired'|'used'|'invalid'>}
 */
export async function confirmSignRequest(token) {
  if (!token || typeof token !== 'string') return 'invalid';
  const trimmed = token.trim();
  if (!trimmed) return 'invalid';
  const row = await prisma.signRequest.findUnique({ where: { token: trimmed } });
  if (!row) return 'invalid';
  if (row.signedAt) return 'used';
  if (new Date() > row.expiresAt) return 'expired';
  await prisma.signRequest.update({
    where: { id: row.id },
    data: { signedAt: new Date() }
  });
  return 'ok';
}

/**
 * Liste des invoiceId signés pour un utilisateur.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function getSignedInvoiceIds(userId) {
  if (!userId) return [];
  const rows = await prisma.signRequest.findMany({
    where: { userId, signedAt: { not: null } },
    select: { invoiceId: true }
  });
  return [...new Set(rows.map((r) => r.invoiceId))];
}
