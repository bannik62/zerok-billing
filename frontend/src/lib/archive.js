/**
 * Archive chiffrée : export/import de données (coffre fort : clients, société, profils ; documents : devis, factures).
 * L'archive peut contenir tout ou partie de ces données. Protégée par mot de passe.
 */

import { deriveKey, generateSalt, saltToBase64, saltFromBase64 } from '$lib/crypto/index.js';
import { encrypt, decrypt } from '$lib/crypto/index.js';

const ARCHIVE_VERSION = 1;

/**
 * Crée une archive chiffrée à partir du bundle et du mot de passe.
 * Le bundle peut être partiel (ex. seulement coffre ou seulement documents).
 * @param {Object} bundle - { devis?, factures?, clients?, societe? } (layoutProfiles ignoré, plus exporté)
 * @param {string} password - Mot de passe pour protéger l'archive
 * @returns {Promise<Object>} - { v, salt, iv, payload } prêt à être JSON.stringify + téléchargé
 */
export async function createArchive(bundle, password) {
  const salt = generateSalt(16);
  const key = await deriveKey(password, salt);
  const { payload, iv } = await encrypt(bundle, key);
  return {
    v: ARCHIVE_VERSION,
    salt: saltToBase64(salt),
    iv,
    payload
  };
}

/**
 * Ouvre une archive chiffrée avec le mot de passe.
 * Accepte les archives partielles (coffre seul, documents seuls, ou les deux).
 * @param {string} fileContent - Contenu du fichier (JSON string)
 * @param {string} password - Mot de passe utilisé à l'export
 * @returns {Promise<Object>} - bundle normalisé { devis, factures, clients, societe, layoutProfiles } (layoutProfiles lu pour compatibilité anciennes archives, non restauré)
 */
export async function openArchive(fileContent, password) {
  const raw = JSON.parse(fileContent);
  if (raw.v !== ARCHIVE_VERSION) throw new Error('Format d\'archive non supporté');
  const salt = saltFromBase64(raw.salt);
  const key = await deriveKey(password, salt);
  const bundle = await decrypt({ payload: raw.payload, iv: raw.iv }, key);
  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Archive invalide ou mot de passe incorrect');
  }
  const hasCoffre =
    Array.isArray(bundle.clients) ||
    (bundle.societe != null && typeof bundle.societe === 'object');
  const hasDocuments = Array.isArray(bundle.devis) || Array.isArray(bundle.factures);
  if (!hasCoffre && !hasDocuments) {
    throw new Error('Archive invalide ou mot de passe incorrect');
  }
  return {
    devis: Array.isArray(bundle.devis) ? bundle.devis : [],
    factures: Array.isArray(bundle.factures) ? bundle.factures : [],
    clients: Array.isArray(bundle.clients) ? bundle.clients : [],
    societe: bundle.societe != null && typeof bundle.societe === 'object' ? bundle.societe : null,
    layoutProfiles: Array.isArray(bundle.layoutProfiles) ? bundle.layoutProfiles : []
  };
}
