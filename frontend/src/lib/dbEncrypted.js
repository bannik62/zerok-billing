/**
 * Couche de stockage chiffre pour devis et factures.
 * Delegation vers db.js quand aucune cle; chiffrement AES-GCM sinon.
 */

import { writable } from 'svelte/store';
import {
  getKeyDerivationSalt,
  setKeyDerivationSalt,
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
  getClientDevisSlug,
  addDocument as dbAddDocument,
  putDocumentRaw,
  getDocument,
  getAllDocuments,
  getDocumentsByClientId,
  getDocumentsByInvoiceId,
  deleteDocument
} from './db.js';
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

export async function initEncryption(password) {
  let saltBase64 = await getKeyDerivationSalt();
  if (!saltBase64) {
    const salt = generateSalt(16);
    saltBase64 = saltToBase64(salt);
    await setKeyDerivationSalt(saltBase64);
  }
  const salt = saltFromBase64(saltBase64);
  const key = await deriveKey(password, salt);
  setEncryptionKey(key);
  return key;
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

export async function deleteDevis(id) {
  return dbDeleteDevis(id);
}

export async function getNextDevisNumber(clientId, clients = [], userId = null) {
  if (!clientId || !Array.isArray(clients)) return '';
  const client = clients.find((c) => c.id === clientId);
  if (!client) return '';
  const slug = getClientDevisSlug(client, clients);
  const year = new Date().getFullYear();
  const prefix = `DEV-${slug}-${year}-`;
  const all = await getAllDevis(userId);
  const getNumero = (d) => (d && d.entete && d.entete.numero) ? d.entete.numero : '';
  const forClient = all.filter(
    (d) => d.clientId === clientId && getNumero(d).startsWith(prefix)
  );
  let max = 0;
  for (const d of forClient) {
    const n = parseInt(getNumero(d).slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
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

export async function deleteFacture(id) {
  await dbDeleteFacture(id);
}

function getFactureNumero(f) {
  return f && f.entete && f.entete.numero ? f.entete.numero : '';
}

export async function getNextFactureNumber(clientId, clients = [], userId = null) {
  if (!clientId || !Array.isArray(clients)) return '';
  const client = clients.find((c) => c.id === clientId);
  if (!client) return '';
  const slug = getClientDevisSlug(client, clients);
  const year = new Date().getFullYear();
  const prefix = `FAC-${slug}-${year}-`;
  const all = await getAllFactures(userId);
  const forClient = all.filter(
    (f) => f.clientId === clientId && getFactureNumero(f).startsWith(prefix)
  );
  let max = 0;
  for (const f of forClient) {
    const n = parseInt(getFactureNumero(f).slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
}

/** Coffre-fort : ajoute un document (fichier chiffré). Retourne { record, fileHash } pour envoyer la preuve. */
export async function addDocument({ clientId, linkedInvoiceId, type, filename, file, metadata }) {
  if (!_encryptionKey) throw new Error('Clé de chiffrement requise pour le coffre-fort');
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
    metadata: metadata || undefined
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
  getAllLayoutProfiles,
  getLayoutProfile,
  addLayoutProfile,
  updateLayoutProfile,
  deleteLayoutProfile,
  getDocument,
  getAllDocuments,
  getDocumentsByClientId,
  getDocumentsByInvoiceId,
  deleteDocument
} from './db.js';
