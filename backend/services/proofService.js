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
