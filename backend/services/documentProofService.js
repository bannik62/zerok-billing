/**
 * Service preuves documents (coffre-fort) : upsert par documentId pour l'utilisateur.
 */
import { prisma } from '../lib/prisma.js';

/** Liste toutes les preuves documents de l'utilisateur (pour comparaison hash local / backend). */
export async function findAllDocumentProofsByUserId(userId) {
  if (!userId) return [];
  return prisma.documentProof.findMany({
    where: { userId },
    select: { documentId: true, fileHash: true, filename: true, uploadedAt: true },
    orderBy: { uploadedAt: 'desc' }
  });
}

export async function upsertDocumentProof({
  documentId,
  userId,
  fileHash,
  filename,
  mimeType,
  size,
  invoiceId = null
}) {
  const uploadedAt = new Date();
  return prisma.documentProof.upsert({
    where: { documentId },
    create: {
      documentId,
      userId,
      fileHash,
      filename,
      mimeType,
      size,
      uploadedAt,
      invoiceId: invoiceId || undefined
    },
    update: {
      fileHash,
      filename,
      mimeType,
      size,
      uploadedAt,
      invoiceId: invoiceId || undefined
    }
  });
}
