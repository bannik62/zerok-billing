/**
 * Archive chiffrée : export/import de données
 * (coffre : clients, société ; documents : devis, factures ; achats : factures fournisseur).
 * L'archive peut contenir tout ou partie de ces données. Protégée par mot de passe.
 */

import { deriveKey, generateSalt, saltToBase64, saltFromBase64 } from '$lib/crypto/index.js';
import { encrypt, decrypt } from '$lib/crypto/index.js';

const ARCHIVE_VERSION = 1;

/**
 * Crée une archive chiffrée à partir du bundle et du mot de passe.
 * Le bundle peut être partiel (ex. seulement coffre ou seulement documents).
 * @param {Object} bundle - { devis?, factures?, achats?, clients?, societe?, coffreFortDocuments? }
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
 * Accepte les archives partielles (coffre seul, documents seuls, achats seuls, ou combinaison).
 * @param {string} fileContent - Contenu du fichier (JSON string)
 * @param {string} password - Mot de passe utilisé à l'export
 * @returns {Promise<Object>} - bundle normalisé
 * { devis, factures, achats, clients, societe, coffreFortDocuments, layoutProfiles, includesAchats }
 * (`includesAchats` indique si la clé achats était présente dans l'archive source)
 */
/** Retire le BOM UTF-8 si présent (fichier ré-enregistré par un éditeur). */
function stripBom(s) {
  if (typeof s !== 'string') return s;
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export async function openArchive(fileContent, password) {
  const content = stripBom(typeof fileContent === 'string' ? fileContent : String(fileContent));
  const pwd = (password != null && typeof password === 'string' ? password : '').trim();

  let raw;
  try {
    raw = JSON.parse(content);
  } catch (_) {
    throw new Error('Fichier invalide : JSON corrompu ou encodage incorrect (enregistrez le fichier en UTF-8 sans BOM).');
  }

  if (raw.v !== ARCHIVE_VERSION) throw new Error('Format d\'archive non supporté');
  if (!raw.salt || !raw.iv || !raw.payload) throw new Error('Fichier d\'archive incomplet (salt, iv ou payload manquant).');

  let salt;
  try {
    salt = saltFromBase64(raw.salt);
  } catch (_) {
    throw new Error('Archive corrompue (salt invalide).');
  }

  const key = await deriveKey(pwd, salt);
  let bundle;
  try {
    bundle = await decrypt({ payload: raw.payload, iv: raw.iv }, key);
  } catch (e) {
    if (e && (e.name === 'OperationError' || e.name === 'DOMException')) {
      throw new Error('Mot de passe incorrect ou archive corrompue.');
    }
    throw e;
  }

  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Archive invalide ou mot de passe incorrect');
  }
  // Présence réelle des sections dans l'archive (clés présentes au chiffrement), pas les tableaux par défaut
  const hasCoffre =
    Object.prototype.hasOwnProperty.call(bundle, 'clients') ||
    Object.prototype.hasOwnProperty.call(bundle, 'societe');
  const hasDocumentsSection =
    Object.prototype.hasOwnProperty.call(bundle, 'devis') ||
    Object.prototype.hasOwnProperty.call(bundle, 'factures');
  const includesAchats = Object.prototype.hasOwnProperty.call(bundle, 'achats');
  const hasCoffreFortSection = Object.prototype.hasOwnProperty.call(bundle, 'coffreFortDocuments');
  const hasLinkedDocumentsSection = Object.prototype.hasOwnProperty.call(bundle, 'linkedDocuments');

  const hasAchats = Array.isArray(bundle.achats);
  if (!hasCoffre && !hasDocumentsSection && !hasAchats && !hasCoffreFortSection && !hasLinkedDocumentsSection) {
    throw new Error('Archive invalide ou mot de passe incorrect');
  }

  return {
    devis: Array.isArray(bundle.devis) ? bundle.devis : [],
    factures: Array.isArray(bundle.factures) ? bundle.factures : [],
    achats: Array.isArray(bundle.achats) ? bundle.achats : [],
    includesAchats,
    clients: Array.isArray(bundle.clients) ? bundle.clients : [],
    societe: bundle.societe != null && typeof bundle.societe === 'object' ? bundle.societe : null,
    coffreFortDocuments: Array.isArray(bundle.coffreFortDocuments) ? bundle.coffreFortDocuments : [],
    linkedDocuments: Array.isArray(bundle.linkedDocuments) ? bundle.linkedDocuments : [],
    layoutProfiles: Array.isArray(bundle.layoutProfiles) ? bundle.layoutProfiles : [],
    includesDocumentsSection: hasDocumentsSection,
    includesCoffreFortSection: hasCoffreFortSection,
    // Coffre-fort multiposte : sel de dérivation (même clé sur tous les postes)
    keyDerivationSalt: typeof bundle.keyDerivationSalt === 'string' ? bundle.keyDerivationSalt : null
  };
}
