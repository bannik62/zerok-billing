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
 * @returns {Promise<{ status: 'ok', documentType: string, invoiceId: string, userId: string }|{ status: 'expired'|'used'|'invalid' }>}
 */
export async function confirmSignRequest(token) {
  if (!token || typeof token !== 'string') return { status: 'invalid' };
  const trimmed = token.trim();
  if (!trimmed) return { status: 'invalid' };
  const row = await prisma.signRequest.findUnique({ where: { token: trimmed } });
  if (!row) return { status: 'invalid' };

  const now = new Date();
  if (now > row.expiresAt) {
    return { status: 'expired' };
  }

  // Idempotence : on n'écrit signedAt que si encore null.
  const updated = await prisma.signRequest.updateMany({
    where: { id: row.id, signedAt: null },
    data: { signedAt: now }
  });

  if (updated.count === 0) {
    // Une autre requête a déjà confirmé la signature entre-temps.
    return { status: 'used' };
  }

  return {
    status: 'ok',
    documentType: row.documentType,
    invoiceId: row.invoiceId,
    userId: row.userId
  };
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
