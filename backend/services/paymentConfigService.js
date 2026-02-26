/**
 * Config paiement : liste des providers configurés par utilisateur.
 */
import { prisma } from '../lib/prisma.js';

/**
 * Liste des providers (ex. ['stripe']) pour lesquels l'utilisateur a une config.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function getConfiguredProviders(userId) {
  if (!userId) return [];
  const rows = await prisma.paymentConfig.findMany({
    where: { userId },
    select: { provider: true }
  });
  return rows.map((r) => r.provider);
}
