/**
 * Envoi des preuves d'intégrité (hash SHA-256 + signature) au serveur.
 * Hash calculé côté client via Web Crypto API (SHA-256, non obsolète).
 */

import { hashDocument } from '$lib/crypto/index.js';
import { apiClient } from '$lib/apiClient.js';

/**
 * Calcule le hash du document et envoie la preuve au serveur (POST /api/proofs).
 * À appeler après chaque sauvegarde devis/facture pour garder le serveur à jour.
 * @param {Object} document - Devis ou facture (avec id, entete, lignes, etc.)
 * @param {'devis'|'facture'} documentType
 * @returns {Promise<void>}
 */
export async function sendProof(document, documentType) {
  if (!document?.id) return;
  const invoiceHash = await hashDocument(document, documentType);
  await apiClient.post('/api/proofs', {
    invoiceId: document.id,
    invoiceHash,
    signature: invoiceHash
  });
}

/**
 * Vérifie en lot que les hash des documents correspondent à ceux enregistrés sur le serveur.
 * @param {{ invoiceId: string, invoiceHash: string }[]} checks
 * @returns {Promise<{ invoiceId: string, verified: boolean }[]>}
 */
export async function verifyProofs(checks) {
  if (!checks?.length) return [];
  const res = await apiClient.post('/api/proofs/verify', { checks });
  return res.data?.results ?? [];
}

/**
 * Envoie la preuve d'un document du coffre-fort (hash fichier + métadonnées, pas le contenu).
 * À appeler après addDocument (avec le record et le fileHash retournés).
 * @param {{ id: string, filename: string, mimeType: string, size: number, linkedInvoiceId?: string }} record
 * @param {string} fileHash - SHA-256 hex du fichier
 */
export async function sendDocumentProof(record, fileHash) {
  if (!record?.id || !fileHash) return;
  await apiClient.post('/api/documents/proof', {
    documentId: record.id,
    fileHash,
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
    invoiceId: record.linkedInvoiceId || null
  });
}
