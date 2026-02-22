/**
 * Couche service preuves (Proof) : accès données (Prisma).
 * Les routes n'importent pas prisma directement.
 */
import { prisma } from '../lib/prisma.js';

export async function upsertProof({ invoiceId, userId, invoiceHash, signature }) {
  return prisma.proof.upsert({
    where: { invoiceId },
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
