/**
 * IndexedDB – zerok-billing (stockage local navigateur).
 * Utilise Dexie. Stores : clients, societe, devis, factures, meta, documents (layoutProfiles supprimé en v10).
 */

import Dexie from 'dexie';
import { getClientDevisSlug, computeNextDevisNumber, computeNextFactureNumber } from './numbering.js';

const DB_NAME = 'zerok-billing';
const DB_VERSION = 8;
const STORE_CLIENTS = 'clients';
const STORE_SOCIETE = 'societe';
export const STORE_DEVIS = 'devis';
const STORE_LAYOUT_PROFILES = 'layoutProfiles';
export const STORE_FACTURES = 'factures';
const STORE_META = 'meta';
export const STORE_DOCUMENTS = 'documents';
const STORE_ACHATS = 'achats';
const SOCIETE_ID = 'societe';
const META_KEY_SALT = 'keyDerivationSalt';

/** Instance Dexie (même nom et version que l’ancienne base pour compatibilité). */
const db = new Dexie(DB_NAME);
db.version(DB_VERSION).stores({
  [STORE_CLIENTS]: 'id',
  [STORE_SOCIETE]: 'id',
  [STORE_DEVIS]: 'id',
  [STORE_LAYOUT_PROFILES]: 'id',
  [STORE_FACTURES]: 'id',
  [STORE_META]: 'key'
});
db.version(9).stores({
  [STORE_DOCUMENTS]: 'id, clientId, linkedInvoiceId, type, uploadedAt'
});

// Version 10 : suppression du store layoutProfiles + nettoyage blockPositions sur devis/factures
db.version(10).stores({
  [STORE_CLIENTS]: 'id',
  [STORE_SOCIETE]: 'id',
  [STORE_DEVIS]: 'id',
  [STORE_FACTURES]: 'id',
  [STORE_META]: 'key',
  [STORE_DOCUMENTS]: 'id, clientId, linkedInvoiceId, type, uploadedAt',
  [STORE_ACHATS]: 'id, userId, date'
}).upgrade((tx) => {
  // Supprimer le store layoutProfiles (IndexedDB)
  try {
    const idbTrans = tx.idbtrans ?? tx._idbtrans;
    if (idbTrans?.db?.objectStoreNames?.contains('layoutProfiles')) {
      idbTrans.db.deleteObjectStore('layoutProfiles');
    }
  } catch (_) {}
  // Nettoyer blockPositions sur les enregistrements devis et factures (clé obsolète)
  return Promise.all([
    tx.table(STORE_DEVIS).toCollection().modify((r) => { if (r && 'blockPositions' in r) delete r.blockPositions; }),
    tx.table(STORE_FACTURES).toCollection().modify((r) => { if (r && 'blockPositions' in r) delete r.blockPositions; })
  ]);
});

/** Clone profond pour IndexedDB (évite DataCloneError avec proxies Svelte). */
function plainClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Retourne l’instance Dexie (pour la couche chiffrée). */
export function openDB() {
  return Promise.resolve(db);
}

/**
 * Clé meta pour le sel de dérivation (legacy, un seul utilisateur).
 * Pour multi-utilisateurs on utilise key = `keyDerivationSalt-${userId}`.
 */
function getSaltMetaKey(userId) {
  if (userId == null || userId === '') return META_KEY_SALT;
  return `keyDerivationSalt-${String(userId)}`;
}

function getKeyCheckMetaKey(userId) {
  if (userId == null || userId === '') return 'keyCheck';
  return `keyCheck-${String(userId)}`;
}

/**
 * Récupère le sel de dérivation de clé pour un utilisateur (stocké en clair dans meta).
 * @param {string|number|null} [userId] - id du compte ; si null, utilise le sel legacy (un seul pour toute la base)
 * @returns {Promise<string|null>} base64 du sel, ou null si pas encore défini
 */
export async function getKeyDerivationSalt(userId = null) {
  const key = getSaltMetaKey(userId);
  let row = await db[STORE_META].get(key);
  if (row != null && row.salt != null) return row.salt;
  if (userId != null && userId !== '') {
    row = await db[STORE_META].get(META_KEY_SALT);
    if (row != null && row.salt != null) {
      await db[STORE_META].put({ key, salt: row.salt });
      return row.salt;
    }
  }
  return null;
}

/**
 * Enregistre le sel de dérivation de clé pour un utilisateur.
 * @param {string} saltBase64 - Sel en base64
 * @param {string|number|null} [userId] - id du compte ; si null, utilise la clé legacy
 */
export async function setKeyDerivationSalt(saltBase64, userId = null) {
  const key = getSaltMetaKey(userId);
  await db[STORE_META].put({ key, salt: saltBase64 });
}

/**
 * Récupère le jeton de vérification du mot de passe (chiffré avec la clé dérivée).
 * @param {string|number|null} [userId]
 * @returns {Promise<{ payload: string, iv: string }|null>}
 */
export async function getKeyCheck(userId = null) {
  const key = getKeyCheckMetaKey(userId);
  const row = await db[STORE_META].get(key);
  if (row != null && row.payload != null && row.iv != null) return { payload: row.payload, iv: row.iv };
  return null;
}

/**
 * Enregistre le jeton de vérification (après premier déverrouillage ou création du sel).
 * @param {string|number|null} [userId]
 * @param {{ payload: string, iv: string }} data
 */
export async function setKeyCheck(userId, data) {
  const key = getKeyCheckMetaKey(userId);
  await db[STORE_META].put({ key, payload: data.payload, iv: data.iv });
}

/**
 * Supprime le sel et le keyCheck pour un utilisateur (ex. après reset mdp pour permettre une nouvelle clé).
 * @param {string|number|null} [userId]
 */
export async function clearKeyDataForUser(userId = null) {
  const saltKey = getSaltMetaKey(userId);
  const checkKey = getKeyCheckMetaKey(userId);
  await db[STORE_META].delete(saltKey);
  await db[STORE_META].delete(checkKey);
}

/**
 * Ajoute un client.
 * @param {Object} client - { raisonSociale, nom, prenom, email, telephone, adresse, codePostal, ville, siret }
 * @param {string|number|null} [userId] - id du compte propriétaire (partition par utilisateur)
 * @returns {Promise<Object>} client avec id et createdAt
 */
export async function addClient(client, userId = null) {
  const uuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  const id = uuid != null ? uuid : `client-${Date.now()}`;
  const record = { id, ...client, createdAt: new Date().toISOString(), ...(userId != null && { userId }) };
  await db[STORE_CLIENTS].add(record);
  return record;
}

/**
 * Récupère tous les clients (optionnellement filtrés par utilisateur).
 * @param {string|number|null} [userId] - si fourni, ne retourne que les clients de cet utilisateur ou sans userId (legacy)
 * @returns {Promise<Object[]>}
 */
export async function getAllClients(userId = null) {
  const all = await db[STORE_CLIENTS].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

/**
 * Récupère un client par id (optionnellement vérifie le propriétaire).
 * @param {string} id
 * @param {string|number|null} [userId] - si fourni et le client a un userId, doit correspondre
 * @returns {Promise<Object|null>}
 */
export async function getClientById(id, userId = null) {
  const record = (await db[STORE_CLIENTS].get(id)) ?? null;
  if (!record) return null;
  if (userId != null && record.userId != null && record.userId !== userId) return null;
  return record;
}

/**
 * Met à jour un client existant.
 * @param {Object} client - doit contenir id + champs à mettre à jour
 * @param {string|number|null} [userId] - si fourni, le client doit appartenir à cet utilisateur
 * @returns {Promise<Object>}
 */
export async function updateClient(client, userId = null) {
  const existing = await getClientById(client.id, userId);
  if (!existing) throw new Error('Client introuvable');
  const record = { ...existing, ...client, id: existing.id, createdAt: existing.createdAt };
  await db[STORE_CLIENTS].put(record);
  return record;
}

/**
 * Supprime un client par id.
 * @param {string} id
 * @param {string|number|null} [userId] - si fourni, supprime seulement si le client appartient à cet utilisateur
 */
export async function deleteClient(id, userId = null) {
  if (userId != null) {
    const existing = await getClientById(id, userId);
    if (!existing) throw new Error('Client introuvable ou non autorisé');
  }
  await db[STORE_CLIENTS].delete(id);
}

const DEFAULT_SOCIETE = {
  logo: '', nom: '', formeJuridique: '', siret: '', rcs: '', capital: '', siegeSocial: '', tvaIntra: ''
};

/**
 * Récupère les données société (données personnelles) pour un utilisateur.
 * @param {string|number|null} [userId] - partition utilisateur (si null, lecture legacy id 'societe')
 * @returns {Promise<Object>} { logo, nom, formeJuridique, siret, rcs, capital, siegeSocial, tvaIntra }
 */
export async function getSociete(userId = null) {
  const id = userId != null ? `societe-${userId}` : SOCIETE_ID;
  const raw = await db[STORE_SOCIETE].get(id);
  return raw ? { ...raw } : { ...DEFAULT_SOCIETE };
}

/**
 * Enregistre les données société (données personnelles) pour un utilisateur.
 * @param {Object} data - { logo, nom, formeJuridique, siret, rcs, capital, siegeSocial, tvaIntra }
 * @param {string|number|null} [userId] - partition utilisateur
 * @returns {Promise<Object>}
 */
export async function saveSociete(data, userId = null) {
  const id = userId != null ? `societe-${userId}` : SOCIETE_ID;
  const record = plainClone({ id, ...data, ...(userId != null && { userId }) });
  await db[STORE_SOCIETE].put(record);
  return record;
}

/**
 * Devis : { id, clientId?, entete: {}, lignes: [], reduction: {}, sousTotal, total, layoutId?, createdAt, userId? }
 */
export async function addDevis(devis, userId = null) {
  const uuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  const id = uuid != null ? uuid : `devis-${Date.now()}`;
  const record = plainClone({ id, ...devis, createdAt: new Date().toISOString(), ...(userId != null && { userId }) });
  await db[STORE_DEVIS].add(record);
  return record;
}

export async function getDevis(id, userId = null) {
  const record = (await db[STORE_DEVIS].get(id)) ?? null;
  if (!record) return null;
  if (userId != null && record.userId != null && record.userId !== userId) return null;
  return record;
}

export async function getAllDevis(userId = null) {
  const all = await db[STORE_DEVIS].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

/** Pour la couche chiffrée : put/get/getAll bruts sur le store devis. */
export async function putDevisRaw(record) {
  await db[STORE_DEVIS].put(record);
  return record;
}
export async function getDevisRaw(id) {
  return (await db[STORE_DEVIS].get(id)) ?? null;
}
export async function getAllDevisRaw(userId = null) {
  const all = await db[STORE_DEVIS].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

export { getClientDevisSlug };

/**
 * Prochain numéro de devis : DEV-{clientSlug}-{année}-NNN, NNN par client.
 * @param {string} [clientId]
 * @param {Object[]} [clients] - liste des clients (pour le slug)
 * @param {string|number|null} [userId] - partition utilisateur
 * @returns {Promise<string>} numéro ou '' si pas de client
 */
export async function getNextDevisNumber(clientId, clients = [], userId = null) {
  const all = await getAllDevis(userId);
  return computeNextDevisNumber(clientId, clients, all);
}

export async function updateDevis(devis, userId = null) {
  const existing = await getDevis(devis.id, userId);
  if (!existing) throw new Error('Devis introuvable');
  const record = plainClone({ ...existing, ...devis, id: existing.id, createdAt: existing.createdAt });
  await db[STORE_DEVIS].put(record);
  return record;
}

/**
 * @param {string} id
 * @param {string|number|null} [userId] - si fourni, supprime seulement si le devis appartient à cet utilisateur
 */
export async function deleteDevis(id, userId = null) {
  if (userId != null) {
    const existing = await getDevis(id, userId);
    if (!existing) throw new Error('Devis introuvable ou non autorisé');
  }
  await db[STORE_DEVIS].delete(id);
}

/**
 * Facture : { id, clientId?, devisId?, entete: {}, lignes, reduction, sousTotal, total, tvaMontant?, totalTTC?, layoutId?, createdAt, userId? }
 * Numéro : FAC-{clientSlug}-{année}-{NNN} (par client).
 */
export async function getAllFactures(userId = null) {
  const all = await db[STORE_FACTURES].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

/**
 * Prochain numéro de facture : FAC-{clientSlug}-{année}-NNN, NNN par client.
 * @param {string} [clientId]
 * @param {Object[]} [clients]
 * @param {string|number|null} [userId] - partition utilisateur
 * @returns {Promise<string>}
 */
export async function getNextFactureNumber(clientId, clients = [], userId = null) {
  const all = await getAllFactures(userId);
  return computeNextFactureNumber(clientId, clients, all);
}

export async function addFacture(facture, userId = null) {
  const id = crypto.randomUUID?.() ?? `facture-${Date.now()}`;
  const record = plainClone({ id, ...facture, createdAt: new Date().toISOString(), ...(userId != null && { userId }) });
  await db[STORE_FACTURES].add(record);
  return record;
}

export async function getFacture(id, userId = null) {
  const record = (await db[STORE_FACTURES].get(id)) ?? null;
  if (!record) return null;
  if (userId != null && record.userId != null && record.userId !== userId) return null;
  return record;
}

export async function updateFacture(facture, userId = null) {
  const existing = await getFacture(facture.id, userId);
  if (!existing) throw new Error('Facture introuvable');
  const record = plainClone({ ...existing, ...facture, id: existing.id, createdAt: existing.createdAt });
  await db[STORE_FACTURES].put(record);
  return record;
}

/**
 * @param {string} id
 * @param {string|number|null} [userId] - si fourni, supprime seulement si la facture appartient à cet utilisateur
 */
export async function deleteFacture(id, userId = null) {
  if (userId != null) {
    const existing = await getFacture(id, userId);
    if (!existing) throw new Error('Facture introuvable ou non autorisée');
  }
  await db[STORE_FACTURES].delete(id);
}

/**
 * Achats : enregistrements d'achats/factures fournisseurs.
 * { id, date, fournisseur, categorie, description, montantHT, tva, montantTTC, modePaiement, numeroFacture, documentId?, createdAt, userId? }
 */
export async function addAchat(achat, userId = null) {
  const id = crypto.randomUUID?.() ?? `achat-${Date.now()}`;
  const record = plainClone({
    id,
    ...achat,
    createdAt: new Date().toISOString(),
    ...(userId != null && { userId })
  });
  await db[STORE_ACHATS].add(record);
  return record;
}

export async function getAchat(id, userId = null) {
  const record = (await db[STORE_ACHATS].get(id)) ?? null;
  if (!record) return null;
  if (userId != null && record.userId != null && record.userId !== userId) return null;
  return record;
}

export async function getAllAchats(userId = null) {
  const all = await db[STORE_ACHATS].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

export async function updateAchat(achat, userId = null) {
  const existing = await getAchat(achat.id, userId);
  if (!existing) throw new Error('Achat introuvable');
  const record = plainClone({
    ...existing,
    ...achat,
    id: existing.id,
    createdAt: existing.createdAt
  });
  await db[STORE_ACHATS].put(record);
  return record;
}

export async function deleteAchat(id, userId = null) {
  if (userId != null) {
    const existing = await getAchat(id, userId);
    if (!existing) throw new Error('Achat introuvable ou non autorisé');
  }
  await db[STORE_ACHATS].delete(id);
}

/**
 * Options pour clearLocalDataForUser : quelles données effacer avant restauration.
 * @typedef {{ coffre?: boolean, documents?: boolean, achats?: boolean, coffreFortFiles?: boolean }} ClearLocalDataOptions
 * - coffre: clients, société (défaut true si non fourni)
 * - documents: devis et factures (défaut true si non fourni)
 * - achats: achats/factures fournisseur (défaut: suit `documents` si absent)
 * - coffreFortFiles: pièces jointes du coffre-fort / store documents (défaut false)
 */

/**
 * Supprime uniquement les données locales appartenant à un utilisateur (ou les données legacy si userId === null).
 * Utilisé avant restauration d'archive pour ne pas effacer les données d'autres comptes sur le même navigateur.
 * @param {string|number|null} userId - utilisateur courant ; si null, supprime seulement les enregistrements sans userId (legacy)
 * @param {ClearLocalDataOptions} [options] - si fourni, n'efface que coffre et/ou documents selon les flags (défaut : les deux)
 */
export async function clearLocalDataForUser(userId, options = {}) {
  const clearCoffre = options.coffre !== false;
  const clearDocuments = options.documents !== false;
  const clearAchats = options.achats != null ? options.achats !== false : clearDocuments;
  const clearCoffreFortFiles = options.coffreFortFiles === true;

  const match = (r) =>
    userId != null ? r.userId === userId : (r.userId == null || r.userId === '');

  if (clearCoffre) {
    const clients = await db[STORE_CLIENTS].toArray();
    const clientIds = clients.filter(match).map((r) => r.id);
    if (clientIds.length > 0) await db[STORE_CLIENTS].bulkDelete(clientIds);

    if (userId != null) {
      await db[STORE_SOCIETE].delete(`societe-${userId}`);
    } else {
      await db[STORE_SOCIETE].delete(SOCIETE_ID);
    }
  }

  if (clearDocuments) {
    const devis = await db[STORE_DEVIS].toArray();
    const devisIds = devis.filter(match).map((r) => r.id);
    if (devisIds.length > 0) await db[STORE_DEVIS].bulkDelete(devisIds);

    const factures = await db[STORE_FACTURES].toArray();
    const factureIds = factures.filter(match).map((r) => r.id);
    if (factureIds.length > 0) await db[STORE_FACTURES].bulkDelete(factureIds);
  }

  if (clearAchats) {
    const achats = await db[STORE_ACHATS].toArray();
    const achatIds = achats.filter(match).map((r) => r.id);
    if (achatIds.length > 0) await db[STORE_ACHATS].bulkDelete(achatIds);
  }

  if (clearCoffreFortFiles) {
    const docs = await db[STORE_DOCUMENTS].toArray();
    const docIds = docs.filter(match).map((r) => r.id);
    if (docIds.length > 0) await db[STORE_DOCUMENTS].bulkDelete(docIds);
  }
}

/** Pour la couche chiffrée : put/get/getAll bruts sur le store factures. */
export async function putFactureRaw(record) {
  await db[STORE_FACTURES].put(record);
  return record;
}
export async function getFactureRaw(id) {
  return (await db[STORE_FACTURES].get(id)) ?? null;
}
export async function getAllFacturesRaw(userId = null) {
  const all = await db[STORE_FACTURES].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

/** Pour la couche chiffrée : put/get/getAll bruts sur le store achats. */
export async function putAchatRaw(record) {
  await db[STORE_ACHATS].put(record);
  return record;
}

export async function getAchatRaw(id) {
  return (await db[STORE_ACHATS].get(id)) ?? null;
}

export async function getAllAchatsRaw(userId = null) {
  const all = await db[STORE_ACHATS].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

// ——— Coffre-fort : documents (fichiers chiffrés, partition par userId) ———
export async function addDocument(doc) {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `doc-${Date.now()}`;
  const record = plainClone({
    id,
    ...doc,
    uploadedAt: doc.uploadedAt || new Date().toISOString(),
    ...(doc.userId != null && { userId: doc.userId })
  });
  await db[STORE_DOCUMENTS].add(record);
  return record;
}
export async function getDocument(id, userId = null) {
  const record = (await db[STORE_DOCUMENTS].get(id)) ?? null;
  if (!record) return null;
  if (userId != null && record.userId != userId) return null;
  return record;
}
export async function getAllDocuments(userId = null) {
  const all = await db[STORE_DOCUMENTS].toArray();
  if (userId == null) return all;
  // Inclut les docs de l'utilisateur + les docs sans userId (legacy) pour l'export/restore
  return all.filter((r) => r.userId == userId || r.userId == null || r.userId === '');
}
export async function getDocumentsByClientId(clientId, userId = null) {
  const rows = await db[STORE_DOCUMENTS].where('clientId').equals(clientId).toArray();
  if (userId == null) return rows;
  return rows.filter((r) => r.userId == userId);
}
export async function getDocumentsByInvoiceId(linkedInvoiceId, userId = null) {
  const rows = await db[STORE_DOCUMENTS].where('linkedInvoiceId').equals(linkedInvoiceId).toArray();
  if (userId == null) return rows;
  return rows.filter((r) => r.userId == userId);
}
export async function deleteDocument(id, userId = null) {
  if (userId != null) {
    const record = await db[STORE_DOCUMENTS].get(id);
    if (!record || record.userId != userId) throw new Error('Document introuvable ou non autorisé');
  }
  await db[STORE_DOCUMENTS].delete(id);
}
export async function putDocumentRaw(record) {
  await db[STORE_DOCUMENTS].put(plainClone(record));
  return record;
}
export async function getDocumentRaw(id) {
  return (await db[STORE_DOCUMENTS].get(id)) ?? null;
}
export async function getAllDocumentsRaw() {
  return db[STORE_DOCUMENTS].toArray();
}

const LEGACY_MIGRATED_KEY = 'zerok-legacy-migrated';

/**
 * Attribue au compte userId toutes les données sans userId (migration legacy).
 * À appeler une fois par utilisateur (ex. au premier chargement).
 * @param {string|number} userId
 * @returns {Promise<{ clients: number, devis: number, factures: number, societe: boolean, documents: number }>} nombre d'enregistrements migrés
 */
export async function migrateLegacyDataToUser(userId) {
  if (userId == null) return { clients: 0, devis: 0, factures: 0, societe: false, documents: 0 };
  const out = { clients: 0, devis: 0, factures: 0, societe: false, documents: 0 };

  const clients = await db[STORE_CLIENTS].toArray();
  for (const r of clients) {
    if (r.userId != null) continue;
    await db[STORE_CLIENTS].put(plainClone({ ...r, userId }));
    out.clients++;
  }

  const devis = await db[STORE_DEVIS].toArray();
  for (const r of devis) {
    if (r.userId != null) continue;
    await db[STORE_DEVIS].put(plainClone({ ...r, userId }));
    out.devis++;
  }

  const factures = await db[STORE_FACTURES].toArray();
  for (const r of factures) {
    if (r.userId != null) continue;
    await db[STORE_FACTURES].put(plainClone({ ...r, userId }));
    out.factures++;
  }

  const legacySociete = await db[STORE_SOCIETE].get(SOCIETE_ID);
  if (legacySociete) {
    const newId = `societe-${userId}`;
    await db[STORE_SOCIETE].put(plainClone({ ...legacySociete, id: newId, userId }));
    await db[STORE_SOCIETE].delete(SOCIETE_ID);
    out.societe = true;
  }

  const documents = await db[STORE_DOCUMENTS].toArray();
  for (const r of documents) {
    if (r.userId != null) continue;
    await db[STORE_DOCUMENTS].put(plainClone({ ...r, userId }));
    out.documents++;
  }

  return out;
}

/**
 * Indique si la migration legacy a déjà été faite pour cet utilisateur.
 * @param {string|number} userId
 */
export function isLegacyMigratedForUser(userId) {
  if (userId == null) return true;
  try {
    return localStorage.getItem(`${LEGACY_MIGRATED_KEY}-${userId}`) === '1';
  } catch {
    return false;
  }
}

/**
 * Marque la migration comme faite pour cet utilisateur.
 * @param {string|number} userId
 */
export function setLegacyMigratedForUser(userId) {
  if (userId == null) return;
  try {
    localStorage.setItem(`${LEGACY_MIGRATED_KEY}-${userId}`, '1');
  } catch {}
}
