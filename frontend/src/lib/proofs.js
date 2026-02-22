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
 * Récupère la liste des preuves (devis/factures) enregistrées sur le serveur.
 * @returns {Promise<{ invoiceId: string, invoiceHash: string, signedAt?: string }[]>}
 */
export async function getProofs() {
  const res = await apiClient.get('/api/proofs');
  return res.data?.proofs ?? [];
}

/**
 * Supprime la preuve d'un devis/facture sur le serveur (double suppression ou filet orphelins).
 * @param {string} invoiceId - id du devis ou de la facture
 * @returns {Promise<boolean>} true si une preuve a été supprimée
 */
export async function deleteProof(invoiceId) {
  if (!invoiceId) return false;
  const res = await apiClient.delete(`/api/proofs/${encodeURIComponent(invoiceId)}`);
  return res.data?.deleted === true;
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

/**
 * Récupère la liste des preuves documents (hash) enregistrées sur le serveur pour l'utilisateur.
 * @returns {Promise<{ documentId: string, fileHash: string, filename: string, uploadedAt: string }[]>}
 */
export async function getDocumentProofs() {
  const res = await apiClient.get('/api/documents/proofs');
  return res.data?.documentProofs ?? [];
}

/**
 * Supprime la preuve d'un document sur le serveur (à appeler quand l'utilisateur supprime le fichier du coffre-fort).
 * @param {string} documentId - id du document supprimé
 */
export async function deleteDocumentProof(documentId) {
  if (!documentId) return;
  await apiClient.delete(`/api/documents/proof/${encodeURIComponent(documentId)}`);
}

/**
 * Supprime les preuves orphelines côté serveur (documents supprimés en local mais preuves restées en BDD).
 * À appeler avec la liste des ids des documents encore présents en local (IndexedDB).
 * @param {string[]} keepDocumentIds - ids des documents que l'utilisateur a encore dans le coffre-fort
 */
export async function cleanupDocumentProofs(keepDocumentIds) {
  await apiClient.post('/api/documents/proofs/cleanup', {
    keepDocumentIds: Array.isArray(keepDocumentIds) ? keepDocumentIds : []
  });
}

/**
 * Compare les documents locaux (avec fileHash) aux preuves backend. Retourne un map documentId -> verified.
 * @param {{ id: string, fileHash?: string }[]} localDocuments
 * @returns {Promise<Record<string, boolean>>} documentId -> true si hash local === hash backend, false sinon
 */
export async function verifyDocumentProofs(localDocuments) {
  const map = {};
  if (!localDocuments?.length) return map;
  try {
    const backendProofs = await getDocumentProofs();
    const hashByDocumentId = Object.fromEntries(
      backendProofs.map((p) => [p.documentId, (p.fileHash || '').toLowerCase()])
    );
    for (const doc of localDocuments) {
      const localHash = (doc.fileHash || '').toLowerCase();
      const backendHash = hashByDocumentId[doc.id];
      map[doc.id] = !!localHash && !!backendHash && localHash === backendHash;
    }
  } catch (_) {
    for (const doc of localDocuments) map[doc.id] = false;
  }
  return map;
}
