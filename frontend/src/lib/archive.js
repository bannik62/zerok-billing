/**
 * Archive chiffrée : export/import de tous les documents (devis, factures, clients, société, profils).
 * L'archive est protégée par un mot de passe ; extraction = déchiffrement avec ce mot de passe.
 */

import { deriveKey, generateSalt, saltToBase64, saltFromBase64 } from '$lib/crypto/index.js';
import { encrypt, decrypt } from '$lib/crypto/index.js';

const ARCHIVE_VERSION = 1;

/**
 * Crée une archive chiffrée à partir du bundle et du mot de passe.
 * @param {Object} bundle - { devis, factures, clients, societe, layoutProfiles }
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
 * @param {string} fileContent - Contenu du fichier (JSON string)
 * @param {string} password - Mot de passe utilisé à l'export
 * @returns {Promise<Object>} - bundle { devis, factures, clients, societe, layoutProfiles }
 */
export async function openArchive(fileContent, password) {
  const raw = JSON.parse(fileContent);
  if (raw.v !== ARCHIVE_VERSION) throw new Error('Format d\'archive non supporté');
  const salt = saltFromBase64(raw.salt);
  const key = await deriveKey(password, salt);
  const bundle = await decrypt({ payload: raw.payload, iv: raw.iv }, key);
  if (
    !Array.isArray(bundle.devis) ||
    !Array.isArray(bundle.factures) ||
    !Array.isArray(bundle.clients) ||
    !Array.isArray(bundle.layoutProfiles)
  ) {
    throw new Error('Archive invalide ou mot de passe incorrect');
  }
  return bundle;
}
