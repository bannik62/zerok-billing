/**
 * Envoi des preuves (hash + signature) au serveur pour rester synchro avec l'enregistrement local.
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
