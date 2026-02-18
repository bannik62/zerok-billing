/**
 * Service preuves documents (coffre-fort) : upsert par documentId pour l'utilisateur.
 */
import { prisma } from '../lib/prisma.js';

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
