/**
 * Service : vérification de santé (DB).
 */
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { log } from '../lib/logger.js';

/**
 * Retourne le statut de la base de données.
 * @returns {Promise<'none'|'ok'|'unavailable'>}
 */
export async function getDbStatus() {
  if (!env.DATABASE_URL) return 'none';
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch (e) {
    log('[zerok-billing] healthcheck DB:', e?.message ?? e);
    return 'unavailable';
  }
}
