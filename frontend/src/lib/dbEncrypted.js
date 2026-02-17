/**
 * Couche de stockage chiffre pour devis et factures.
 * Delegation vers db.js quand aucune cle; chiffrement AES-GCM sinon.
 */

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
  deleteFacture as dbDeleteFacture
} from './db.js';
import { deriveKey, generateSalt, saltToBase64, saltFromBase64, encrypt, decrypt } from '$lib/crypto/index.js';

function plainClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

let _encryptionKey = null;

export function setEncryptionKey(key) {
  _encryptionKey = key;
}

export function clearEncryptionKey() {
  _encryptionKey = null;
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

export async function addDevis(devis) {
  if (!_encryptionKey) return dbAddDevis(devis);
  const id = devis.id || crypto.randomUUID?.() || 'devis-' + Date.now();
  const record = plainClone({ id, ...devis, createdAt: new Date().toISOString() });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  await putDevisRaw({ id, encrypted: true, payload, iv });
  return record;
}

export async function getDevis(id) {
  if (!_encryptionKey) return dbGetDevis(id);
  const raw = await getDevisRaw(id);
  if (!raw) return null;
  if (raw.encrypted) return decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey);
  return raw;
}

export async function getAllDevis() {
  if (!_encryptionKey) return dbGetAllDevis();
  const list = await getAllDevisRaw();
  const out = [];
  for (const raw of list) {
    out.push(raw.encrypted ? await decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey) : raw);
  }
  return out;
}

export async function updateDevis(devis) {
  if (!_encryptionKey) return dbUpdateDevis(devis);
  const existing = await getDevis(devis.id);
  if (!existing) throw new Error('Devis introuvable');
  const record = plainClone({ ...existing, ...devis, id: existing.id, createdAt: existing.createdAt });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  await putDevisRaw({ id: record.id, encrypted: true, payload, iv });
  return record;
}

export async function deleteDevis(id) {
  await dbDeleteDevis(id);
}

export async function getNextDevisNumber() {
  const all = await getAllDevis();
  const year = new Date().getFullYear();
  const prefix = 'DEV-' + year + '-';
  const thisYear = all.filter((d) => (d.entete?.numero || '').startsWith(prefix));
  let max = 0;
  for (const d of thisYear) {
    const n = parseInt((d.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
}

export async function addFacture(facture) {
  if (!_encryptionKey) return dbAddFacture(facture);
  const id = facture.id || crypto.randomUUID?.() || 'facture-' + Date.now();
  const record = plainClone({ id, ...facture, createdAt: new Date().toISOString() });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  await putFactureRaw({ id, encrypted: true, payload, iv });
  return record;
}

export async function getFacture(id) {
  if (!_encryptionKey) return dbGetFacture(id);
  const raw = await getFactureRaw(id);
  if (!raw) return null;
  if (raw.encrypted) return decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey);
  return raw;
}

export async function getAllFactures() {
  if (!_encryptionKey) return dbGetAllFactures();
  const list = await getAllFacturesRaw();
  const out = [];
  for (const raw of list) {
    out.push(raw.encrypted ? await decrypt({ payload: raw.payload, iv: raw.iv }, _encryptionKey) : raw);
  }
  return out;
}

export async function updateFacture(facture) {
  if (!_encryptionKey) return dbUpdateFacture(facture);
  const existing = await getFacture(facture.id);
  if (!existing) throw new Error('Facture introuvable');
  const record = plainClone({ ...existing, ...facture, id: existing.id, createdAt: existing.createdAt });
  const { payload, iv } = await encrypt(record, _encryptionKey);
  await putFactureRaw({ id: record.id, encrypted: true, payload, iv });
  return record;
}

export async function deleteFacture(id) {
  await dbDeleteFacture(id);
}

export async function getNextFactureNumber() {
  const all = await getAllFactures();
  const year = new Date().getFullYear();
  const prefix = 'FAC-' + year + '-';
  const thisYear = all.filter((f) => (f.entete?.numero || '').startsWith(prefix));
  let max = 0;
  for (const f of thisYear) {
    const n = parseInt((f.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
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
  deleteLayoutProfile
} from './db.js';
