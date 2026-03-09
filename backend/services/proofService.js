/**
 * Couche service preuves (Proof) : accès données (Prisma).
 * Les routes n'importent pas prisma directement.
 */
import { prisma } from '../lib/prisma.js';

export async function upsertProof({ invoiceId, userId, invoiceHash, signature }) {
  return prisma.proof.upsert({
    where: { userId_invoiceId: { userId, invoiceId } },
    create: {
      invoiceId,
      userId,
      invoiceHash,
      signature,
      signedAt: new Date()
    },
    update: {
      invoiceHash,
      signature,
      signedAt: new Date()
    }
  });
}

export async function findProofsByUserAndInvoiceIds(userId, invoiceIds) {
  return prisma.proof.findMany({
    where: { userId, invoiceId: { in: invoiceIds } },
    select: { invoiceId: true, invoiceHash: true }
  });
}

/** Toutes les preuves de l'utilisateur (pour affichage intégrité dans l'explorer). */
export async function findAllProofsByUserId(userId) {
  return prisma.proof.findMany({
    where: { userId },
    select: { invoiceId: true, invoiceHash: true, signedAt: true },
    orderBy: { signedAt: 'desc' }
  });
}

/** Supprime la preuve d'un devis/facture pour l'utilisateur (double suppression ou filet de secours orphelins). */
export async function deleteProofByUserIdAndInvoiceId(userId, invoiceId) {
  const result = await prisma.proof.deleteMany({
    where: { userId, invoiceId }
  });
  return result.count > 0;
}

/**
 * Remplace toutes les preuves de l'utilisateur par la liste fournie (sync après restauration zerok).
 * @param {string} userId
 * @param {{ invoiceId: string, invoiceHash: string }[]} proofs
 * @returns {Promise<number>} nombre de preuves enregistrées
 */
export async function replaceProofsByUserId(userId, proofs) {
  await prisma.proof.deleteMany({ where: { userId } });
  if (!proofs || proofs.length === 0) return 0;
  const now = new Date();
  await prisma.proof.createMany({
    data: proofs.map((p) => ({
      userId,
      invoiceId: p.invoiceId,
      invoiceHash: p.invoiceHash,
      signature: p.invoiceHash,
      signedAt: now
    }))
  });
  return proofs.length;
}
