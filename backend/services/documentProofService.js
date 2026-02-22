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

/** Supprime la preuve d'un document (quand l'utilisateur supprime le fichier du coffre-fort). */
export async function deleteDocumentProof(documentId, userId) {
  if (!documentId || !userId) return;
  await prisma.documentProof.deleteMany({
    where: { documentId: String(documentId).trim(), userId }
  });
}

/**
 * Supprime les preuves dont le documentId n'est pas dans la liste (nettoyage des orphelines).
 * À appeler avec la liste des ids des documents encore présents en local (IndexedDB).
 */
export async function deleteDocumentProofsNotInList(userId, keepDocumentIds) {
  if (!userId) return;
  const keep = new Set((keepDocumentIds || []).map((id) => String(id).trim()).filter(Boolean));
  const all = await prisma.documentProof.findMany({
    where: { userId },
    select: { documentId: true }
  });
  const toDelete = all.filter((p) => !keep.has(p.documentId)).map((p) => p.documentId);
  for (const documentId of toDelete) {
    await prisma.documentProof.deleteMany({ where: { documentId, userId } });
  }
}
