/**
 * Couche de stockage chiffre pour devis et factures.
 * Delegation vers db.js quand aucune cle; chiffrement AES-GCM sinon.
 */

import { writable } from 'svelte/store';
import {
  getKeyDerivationSalt,
  setKeyDerivationSalt,
  getKeyCheck,
  setKeyCheck,
  clearKeyDataForUser,
  getDevis as dbGetDevis,
  getAllDevis as dbGetAllDevis,
  addDevis as dbAddDevis,
  updateDevis as dbUpdateDevis,
  putDevisRaw,
  getDevisRaw,
  getAllDevisRaw,
  getFacture as dbGetFacture,
  getAllFactures as dbGetAllFactures,
  addFacture as dbAddFacture,
  updateFacture as dbUpdateFacture,
  putFactureRaw,
  getFactureRaw,
  getAllFacturesRaw,
  deleteDevis as dbDeleteDevis,
  deleteFacture as dbDeleteFacture,
  addAchat as dbAddAchat,
  getAchat as dbGetAchat,
  getAllAchats as dbGetAllAchats,
  updateAchat as dbUpdateAchat,
  deleteAchat as dbDeleteAchat,
  putAchatRaw,
  getAchatRaw,
  getAllAchatsRaw,
  addDocument as dbAddDocument,
  putDocumentRaw,
  getDocument,
  getAllDocuments,
  getDocumentsByClientId,
  getDocumentsByInvoiceId,
  deleteDocument
} from './db.js';
import { computeNextDevisNumber, computeNextFactureNumber } from './numbering.js';
import {
  deriveKey,
  generateSalt,
  saltToBase64,
  saltFromBase64,
  encrypt,
  decrypt,
  hashFile,
  encryptFile,
  decryptFile
} from '$lib/crypto/index.js';

function plainClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

let _encryptionKey = null;

/** Store réactif pour l’UI : true = clé chargée (devis/factures chiffrés), false = non chargée. */
export const encryptionKeyLoadedStore = writable(false);

export function setEncryptionKey(key) {
  _encryptionKey = key;
  encryptionKeyLoadedStore.set(true);
}

export function clearEncryptionKey() {
  _encryptionKey = null;
  encryptionKeyLoadedStore.set(false);
}

export function hasEncryptionKey() {
  return _encryptionKey != null;
}

const PASSWORD_CHECK_PAYLOAD = { check: 'zerok-ok' };

/**
 * Initialise la clé de chiffrement à partir du mot de passe (sel lié au compte).
 * Vérifie toujours le mot de passe : via un jeton chiffré (si présent) ou en déchiffrant un devis/facture.
 * @param {string} password - Mot de passe du compte
 * @param {string|number|null} [userId] - Id du compte connecté
 * @param {string|null|undefined} [recoveryPhrase] - Phrase de récupération (inscription ou reset mdp). Null = dérivation classique.
 */
export async function initEncryption(password, userId = null, recoveryPhrase = null) {
  let saltBase64 = await getKeyDerivationSalt(userId);
  if (!saltBase64) {
    const salt = generateSalt(16);
    saltBase64 = saltToBase64(salt);
    await setKeyDerivationSalt(saltBase64, userId);
  }
  const salt = saltFromBase64(saltBase64);
  const key = await deriveKey(password, salt, recoveryPhrase);

  const keyCheck = await getKeyCheck(userId);
  if (keyCheck) {
    try {
      const dec = await decrypt(keyCheck, key);
      if (dec?.check !== 'zerok-ok') throw new Error('Invalid');
    } catch {
      clearEncryptionKey();
      await clearKeyDataForUser(userId);
      const newSalt = generateSalt(16);
      const newSaltBase64 = saltToBase64(newSalt);
      await setKeyDerivationSalt(newSaltBase64, userId);
      const newKey = await deriveKey(password, newSalt, recoveryPhrase);
      const newCheckEncrypted = await encrypt(PASSWORD_CHECK_PAYLOAD, newKey);
      await setKeyCheck(userId, newCheckEncrypted);
      setEncryptionKey(newKey);
      return newKey;
    }
  } else {
    let verified = false;
    try {
      const list = await getAllDevisRaw(userId);
      const encryptedOne = list.find((r) => r.encrypted);
      if (encryptedOne) {
        await decrypt({ payload: encryptedOne.payload, iv: encryptedOne.iv }, key);
        verified = true;
      } else {
        const facturesList = await getAllFacturesRaw(userId);
        const encFacture = facturesList.find((r) => r.encrypted);
        if (encFacture) {
          await decrypt({ payload: encFacture.payload, iv: encFacture.iv }, key);
          verified = true;
        }
      }
    } catch {
      clearEncryptionKey();
      throw new Error('Mot de passe incorrect');
    }
    const checkEncrypted = await encrypt(PASSWORD_CHECK_PAYLOAD, key);
    await setKeyCheck(userId, checkEncrypted);
  }

  setEncryptionKey(key);
  return key;
}

/**
 * Vérifie que le mot de passe (et éventuellement la phrase) correspondent à la clé.
 * Dérive la clé à partir du mot de passe, du sel et optionnellement de la phrase, puis vérifie via keyCheck ou un enregistrement chiffré.
 * @param {string} password
 * @param {string|number|null} [userId]
 * @param {string|null|undefined} [recoveryPhrase] - Phrase de récupération si le compte en utilise une.
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, userId = null, recoveryPhrase = null) {
  let saltBase64 = await getKeyDerivationSalt(userId);
  if (!saltBase64) return false;
  const salt = saltFromBase64(saltBase64);
  const key = await deriveKey(password, salt, recoveryPhrase);

  const keyCheck = await getKeyCheck(userId);
  if (keyCheck) {
    try {
      const dec = await decrypt(keyCheck, key);
      return dec?.check === 'zerok-ok';
    } catch {
      return false;
    }
  }
  try {
    const list = await getAllDevisRaw(userId);
    const encryptedOne = list.find((r) => r.encrypted);
    if (encryptedOne) {
      await decrypt({ payload: encryptedOne.payload, iv: encryptedOne.iv }, key);
      return true;
    }
    const facturesList = await getAllFacturesRaw(userId);
    const encFacture = facturesList.find((r) => r.encrypted);
    if (encFacture) {
      await decrypt({ payload: encFacture.payload, iv: encFacture.iv }, key);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function addDevis(devis, userId = null) {
  if (!_encryptionKey) return dbAddDevis(devis, userId);
  const uuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  const id = (devis.id || uuid) || 'devis-' + Date.now();
  const record = plainClone({ id, ...devis, createdAt: new Date().toISOString(), ...(userId != null && { userId }) });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  const raw = { id, encrypted: true, payload, iv };
  if (userId != null) raw.userId = userId;
  await putDevisRaw(raw);
  return record;
}

export async function getDevis(id, userId = null) {
  if (!_encryptionKey) return dbGetDevis(id, userId);
  const raw = await getDevisRaw(id);
  if (!raw) return null;
  if (userId != null && raw.userId != null && raw.userId !== userId) return null;
  if (raw.encrypted) return decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey);
  return raw;
}

export async function getAllDevis(userId = null) {
  if (!_encryptionKey) return dbGetAllDevis(userId);
  const list = await getAllDevisRaw(userId);
  const out = await Promise.all(
    list.map((raw) =>
      raw.encrypted ? decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey) : Promise.resolve(raw)
    )
  );
  return out;
}

export async function updateDevis(devis, userId = null) {
  if (!_encryptionKey) return dbUpdateDevis(devis, userId);
  const raw = await getDevisRaw(devis.id);
  if (!raw) throw new Error('Devis introuvable');
  if (userId != null && raw.userId != null && raw.userId !== userId) throw new Error('Devis introuvable');
  const existing = raw.encrypted ? await decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey) : raw;
  const record = plainClone({ ...existing, ...devis, id: existing.id, createdAt: existing.createdAt });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  const putRaw = { id: record.id, encrypted: true, payload, iv };
  if (raw.userId != null) putRaw.userId = raw.userId;
  await putDevisRaw(putRaw);
  return record;
}

export async function deleteDevis(id, userId = null) {
  return dbDeleteDevis(id, userId);
}

export async function getNextDevisNumber(clientId, clients = [], userId = null) {
  const all = await getAllDevis(userId);
  return computeNextDevisNumber(clientId, clients, all);
}

export async function addFacture(facture, userId = null) {
  if (!_encryptionKey) return dbAddFacture(facture, userId);
  const uuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  const id = (facture.id || uuid) || 'facture-' + Date.now();
  const record = plainClone({ id, ...facture, createdAt: new Date().toISOString(), ...(userId != null && { userId }) });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  const raw = { id, encrypted: true, payload, iv };
  if (userId != null) raw.userId = userId;
  await putFactureRaw(raw);
  return record;
}

export async function getFacture(id, userId = null) {
  if (!_encryptionKey) return dbGetFacture(id, userId);
  const raw = await getFactureRaw(id);
  if (!raw) return null;
  if (userId != null && raw.userId != null && raw.userId !== userId) return null;
  if (raw.encrypted) return decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey);
  return raw;
}

export async function getAllFactures(userId = null) {
  if (!_encryptionKey) return dbGetAllFactures(userId);
  const list = await getAllFacturesRaw(userId);
  const out = await Promise.all(
    list.map((raw) =>
      raw.encrypted ? decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey) : Promise.resolve(raw)
    )
  );
  return out;
}

export async function updateFacture(facture, userId = null) {
  if (!_encryptionKey) return dbUpdateFacture(facture, userId);
  const raw = await getFactureRaw(facture.id);
  if (!raw) throw new Error('Facture introuvable');
  if (userId != null && raw.userId != null && raw.userId !== userId) throw new Error('Facture introuvable');
  const existing = raw.encrypted ? await decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey) : raw;
  const record = plainClone({ ...existing, ...facture, id: existing.id, createdAt: existing.createdAt });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  const putRaw = { id: record.id, encrypted: true, payload, iv };
  if (raw.userId != null) putRaw.userId = raw.userId;
  await putFactureRaw(putRaw);
  return record;
}

export async function deleteFacture(id, userId = null) {
  await dbDeleteFacture(id, userId);
}

export async function getNextFactureNumber(clientId, clients = [], userId = null) {
  const all = await getAllFactures(userId);
  return computeNextFactureNumber(clientId, clients, all);
}

/**
 * Achats : mêmes principes que devis/factures, chiffrés si la clé est présente.
 */
export async function addAchat(achat, userId = null) {
  if (!_encryptionKey) return dbAddAchat(achat, userId);
  const id = (achat?.id && String(achat.id).trim()) || crypto.randomUUID?.() || `achat-${Date.now()}`;
  const record = plainClone({
    ...achat,
    id,
    createdAt: new Date().toISOString(),
    ...(userId != null && { userId })
  });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  const raw = { id, encrypted: true, payload, iv };
  if (userId != null) raw.userId = userId;
  await putAchatRaw(raw);
  return record;
}

export async function getAchat(id, userId = null) {
  if (!_encryptionKey) return dbGetAchat(id, userId);
  const raw = await getAchatRaw(id);
  if (!raw) return null;
  if (userId != null && raw.userId != null && raw.userId !== userId) return null;
  if (raw.encrypted) {
    return decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey);
  }
  return raw;
}

export async function getAllAchats(userId = null) {
  if (!_encryptionKey) return dbGetAllAchats(userId);
  const list = await getAllAchatsRaw(userId);
  const out = await Promise.all(
    list.map(async (raw) => {
      const dec = raw.encrypted
        ? await decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey)
        : raw;
      return { ...dec, id: dec?.id ?? raw.id };
    })
  );
  return out;
}

export async function updateAchat(achat, userId = null) {
  if (!_encryptionKey) return dbUpdateAchat(achat, userId);
  const raw = await getAchatRaw(achat.id);
  if (!raw) throw new Error('Achat introuvable');
  if (userId != null && raw.userId != null && raw.userId !== userId) {
    throw new Error('Achat introuvable');
  }
  const existing = raw.encrypted
    ? await decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey)
    : raw;
  const record = plainClone({
    ...existing,
    ...achat,
    id: existing.id,
    createdAt: existing.createdAt
  });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  const putRaw = { id: record.id, encrypted: true, payload, iv };
  if (raw.userId != null) putRaw.userId = raw.userId;
  await putAchatRaw(putRaw);
  return record;
}

export async function deleteAchat(id, userId = null) {
  return dbDeleteAchat(id, userId);
}

const COFFRE_FORT_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 Mo, aligné avec l’UI

/** Coffre-fort : ajoute un document (fichier chiffré). Retourne { record, fileHash } pour envoyer la preuve. */
export async function addDocument({ clientId, linkedInvoiceId, type, filename, file, metadata, userId }) {
  if (!_encryptionKey) throw new Error('Clé de chiffrement requise pour le coffre-fort');
  const fileSize = file?.size;
  console.log('[addDocument] Taille fichier:', { COFFRE_FORT_MAX_FILE_BYTES, fileSize, reject: fileSize > COFFRE_FORT_MAX_FILE_BYTES });
  if (fileSize > COFFRE_FORT_MAX_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${COFFRE_FORT_MAX_FILE_BYTES / (1024 * 1024)} Mo)`);
  }
  const fileHash = await hashFile(file);
  const { payload, iv, mimeType, originalSize } = await encryptFile(file, _encryptionKey);
  const record = await dbAddDocument({
    clientId,
    linkedInvoiceId: linkedInvoiceId || undefined,
    type: type || 'autre',
    filename,
    mimeType,
    size: originalSize,
    encrypted: true,
    payload,
    iv,
    metadata: metadata || undefined,
    fileHash,
    ...(userId != null && { userId })
  });
  return { record, fileHash };
}

/** Déchiffre un document et retourne un Blob (téléchargement). */
export async function decryptDocumentBlob(record) {
  if (!record?.encrypted || !record?.payload || !record?.iv) throw new Error('Document invalide ou non chiffré');
  if (!_encryptionKey) throw new Error('Clé de chiffrement requise');
  return decryptFile(
    { payload: record.payload, iv: record.iv, mimeType: record.mimeType },
    _encryptionKey
  );
}

export {
  getKeyDerivationSalt,
  setKeyDerivationSalt,
  addClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  getSociete,
  saveSociete,
  getDocument,
  getAllDocuments,
  getDocumentsByClientId,
  getDocumentsByInvoiceId,
  deleteDocument
} from './db.js';
