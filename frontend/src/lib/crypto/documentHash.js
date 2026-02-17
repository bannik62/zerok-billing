/**
 * Hash canonique des documents (devis/facture) pour preuve d'intégrité.
 * Utilise SHA-256 (Web Crypto API), algorithme recommandé pour l'intégrité (non obsolète).
 * Seules les infos métier sont incluses, pas les positions de blocs (layout).
 */

/**
 * Construit la représentation canonique d'un document pour le hash.
 * Inclut : id, type, entete, lignes, reduction, totaux. Exclut : blockPositions, createdAt.
 */
export function canonicalDocumentForHash(document, documentType) {
  if (!document) return '';

  const { id, entete = {}, lignes = [], reduction = {}, sousTotal, total } = document;

  const docId = id != null && id !== '' ? id : '';
  const subTotal = sousTotal != null ? sousTotal : 0;
  const docTotal = total != null ? total : 0;
  const canonical = {
    type: documentType,
    id: docId,
    entete: sortKeys(entete),
    lignes: (lignes || []).map((l) => sortKeys(l)),
    reduction: sortKeys(reduction),
    sousTotal: subTotal,
    total: docTotal
  };

  if (documentType === 'facture') {
    canonical.tvaMontant = document.tvaMontant != null ? document.tvaMontant : 0;
    canonical.totalTTC = document.totalTTC != null ? document.totalTTC : 0;
    if (document.entete?.tvaTaux != null) canonical.entete.tvaTaux = document.entete.tvaTaux;
  } else {
    if (document.tvaMontant != null) canonical.tvaMontant = document.tvaMontant;
    if (document.totalTTC != null) canonical.totalTTC = document.totalTTC;
    if (document.entete?.tvaTaux != null) canonical.entete.tvaTaux = document.entete.tvaTaux;
  }

  return JSON.stringify(canonical);
}

/**
 * Calcule le hash SHA-256 (hex) du document canonique.
 */
export async function hashDocument(document, documentType) {
  const canonical = canonicalDocumentForHash(document, documentType);
  const enc = new TextEncoder();
  const bytes = await crypto.subtle.digest('SHA-256', enc.encode(canonical));
  return arrayBufferToHex(bytes);
}

function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  const sorted = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    sorted[k] = typeof v === 'object' && v !== null && !Array.isArray(v) ? sortKeys(v) : v;
  }
  return sorted;
}

const HEX_PAD_LENGTH = 2;

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(HEX_PAD_LENGTH, '0'))
    .join('');
}
