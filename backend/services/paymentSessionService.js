/**
 * Service : données pour création de session de paiement et justificatifs.
 * Encapsule l'accès Prisma (invoicePaymentSummary, paymentConfig).
 * Déchiffre les credentials si nécessaire.
 */
import { prisma } from '../lib/prisma.js';
import { decryptCredentials } from '../lib/credentialsEncryption.js';

/**
 * Récupère les données nécessaires pour créer une session Stripe (checkout).
 * @param {string} invoiceId
 * @param {string} userId
 * @param {string} provider
 * @returns {Promise<{ ok: true, summary: object, config: object } | { ok: false, reason: 'no_summary'|'no_config' }>}
 */
export async function getCheckoutData(invoiceId, userId, provider) {
  const summary = await prisma.invoicePaymentSummary.findUnique({ where: { invoiceId } });
  if (!summary) return { ok: false, reason: 'no_summary' };

  const config = await prisma.paymentConfig.findUnique({
    where: { userId_provider: { userId, provider } }
  });
  if (!config) return { ok: false, reason: 'no_config' };
  const credentials = decryptCredentials(config.credentials);
  if (!credentials?.secretKey) return { ok: false, reason: 'no_config' };
  return { ok: true, summary, config: { ...config, credentials } };
}

/**
 * Récupère les données nécessaires pour afficher un justificatif Stripe (receipt ou PDF).
 * @param {string} invoiceId
 * @returns {Promise<{ ok: true, summary: object, config: object } | { ok: false, reason: 'no_summary'|'no_config' }>}
 */
export async function getReceiptData(invoiceId) {
  const summary = await prisma.invoicePaymentSummary.findUnique({ where: { invoiceId } });
  if (!summary) return { ok: false, reason: 'no_summary' };

  const config = await prisma.paymentConfig.findUnique({
    where: { userId_provider: { userId: summary.userId, provider: 'stripe' } }
  });
  if (!config) return { ok: false, reason: 'no_config' };
  const credentials = decryptCredentials(config.credentials);
  if (!credentials?.secretKey) return { ok: false, reason: 'no_config' };
  return { ok: true, summary, config: { ...config, credentials } };
}
