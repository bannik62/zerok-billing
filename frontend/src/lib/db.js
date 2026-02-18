/**
 * IndexedDB – zerok-billing (stockage local navigateur).
 * Utilise Dexie. Stores : clients, societe, devis, layoutProfiles, factures, meta.
 */

import Dexie from 'dexie';

const DB_NAME = 'zerok-billing';
const DB_VERSION = 8;
const STORE_CLIENTS = 'clients';
const STORE_SOCIETE = 'societe';
export const STORE_DEVIS = 'devis';
const STORE_LAYOUT_PROFILES = 'layoutProfiles';
export const STORE_FACTURES = 'factures';
const STORE_META = 'meta';
export const STORE_DOCUMENTS = 'documents';
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

/** Clone profond pour IndexedDB (évite DataCloneError avec proxies Svelte). */
function plainClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Retourne l’instance Dexie (pour la couche chiffrée). */
export function openDB() {
  return Promise.resolve(db);
}

/**
 * Récupère le sel de dérivation de clé (stocké en clair dans meta).
 * @returns {Promise<string|null>} base64 du sel, ou null si pas encore défini
 */
export async function getKeyDerivationSalt() {
  const row = await db[STORE_META].get(META_KEY_SALT);
  const salt = row != null ? row.salt : undefined;
  return salt != null ? salt : null;
}

/**
 * Enregistre le sel de dérivation de clé (à appeler une fois après première génération).
 * @param {string} saltBase64 - Sel en base64
 */
export async function setKeyDerivationSalt(saltBase64) {
  await db[STORE_META].put({ key: META_KEY_SALT, salt: saltBase64 });
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
 * @returns {Promise<Object>}
 */
export async function updateClient(client) {
  const existing = await getClientById(client.id);
  if (!existing) throw new Error('Client introuvable');
  const record = { ...existing, ...client, id: existing.id, createdAt: existing.createdAt };
  await db[STORE_CLIENTS].put(record);
  return record;
}

/**
 * Supprime un client par id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteClient(id) {
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
 * Devis : { id, clientId?, entete: {}, lignes: [], reduction: {}, sousTotal, total, blockPositions: {}, createdAt, userId? }
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

/**
 * Slug pour le numéro de devis : basé sur raison sociale ou prénom+nom, unique parmi les clients.
 * @param {Object} client - { raisonSociale?, prenom?, nom? }
 * @param {Object[]} allClients - liste des clients pour garantir unicité du slug
 * @returns {string}
 */
export function getClientDevisSlug(client, allClients = []) {
  const raw =
    (client && (client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' '))) || '';
  const slug = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'client';
  const sameSlug = allClients.filter((c) => {
    const s =
      (c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' '))
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'client';
    return s === slug;
  });
  const index = sameSlug.findIndex((c) => c.id === client?.id);
  if (index < 0) return slug;
  return sameSlug.length > 1 ? `${slug}${index + 1}` : slug;
}

/**
 * Prochain numéro de devis : {clientSlug}-{année}-{NNN}, NNN par client.
 * @param {string} [clientId]
 * @param {Object[]} [clients] - liste des clients (pour le slug)
 * @param {string|number|null} [userId] - partition utilisateur
 * @returns {Promise<string>} numéro ou '' si pas de client
 */
export async function getNextDevisNumber(clientId, clients = [], userId = null) {
  if (!clientId || !Array.isArray(clients)) return '';
  const client = clients.find((c) => c.id === clientId);
  if (!client) return '';
  const slug = getClientDevisSlug(client, clients);
  const year = new Date().getFullYear();
  const prefix = `DEV-${slug}-${year}-`;
  const all = await getAllDevis(userId);
  const forClient = all.filter((d) => d.clientId === clientId && (d.entete?.numero || '').startsWith(prefix));
  let max = 0;
  for (const d of forClient) {
    const n = parseInt((d.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
}

export async function updateDevis(devis, userId = null) {
  const existing = await getDevis(devis.id, userId);
  if (!existing) throw new Error('Devis introuvable');
  const record = plainClone({ ...existing, ...devis, id: existing.id, createdAt: existing.createdAt });
  await db[STORE_DEVIS].put(record);
  return record;
}

export async function deleteDevis(id) {
  await db[STORE_DEVIS].delete(id);
}

/**
 * Profils de mise en page (templates de blocs pour devis/facture).
 * @typedef {{ id: string, name: string, blockPositions: Object, createdAt: string, userId? }} LayoutProfile
 */

export async function getAllLayoutProfiles(userId = null) {
  const all = await db[STORE_LAYOUT_PROFILES].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

export async function getLayoutProfile(id, userId = null) {
  const record = (await db[STORE_LAYOUT_PROFILES].get(id)) ?? null;
  if (!record) return null;
  if (userId != null && record.userId != null && record.userId !== userId) return null;
  return record;
}

export async function addLayoutProfile(profile, userId = null) {
  const id = crypto.randomUUID?.() ?? `profile-${Date.now()}`;
  const record = plainClone({
    id,
    name: profile.name?.trim() || 'Sans nom',
    blockPositions: profile.blockPositions ?? {},
    createdAt: new Date().toISOString(),
    ...(userId != null && { userId })
  });
  await db[STORE_LAYOUT_PROFILES].add(record);
  return record;
}

export async function updateLayoutProfile(id, updates, userId = null) {
  const existing = await getLayoutProfile(id, userId);
  if (!existing) throw new Error('Profil introuvable');
  const record = plainClone({ ...existing, ...updates, id: existing.id, createdAt: existing.createdAt });
  await db[STORE_LAYOUT_PROFILES].put(record);
  return record;
}

export async function deleteLayoutProfile(id, userId = null) {
  const existing = await getLayoutProfile(id, userId);
  if (!existing) throw new Error('Profil introuvable');
  await db[STORE_LAYOUT_PROFILES].delete(id);
}

/**
 * Facture : { id, clientId?, devisId?, entete: {}, lignes, reduction, sousTotal, total, tvaMontant?, totalTTC?, blockPositions, createdAt, userId? }
 * Numéro : FAC-{clientSlug}-{année}-{NNN} (par client).
 */
export async function getAllFactures(userId = null) {
  const all = await db[STORE_FACTURES].toArray();
  if (userId == null) return all;
  return all.filter((r) => r.userId === userId);
}

/**
 * Prochain numéro de facture : FAC-{clientSlug}-{année}-{NNN}, NNN par client.
 * @param {string} [clientId]
 * @param {Object[]} [clients]
 * @param {string|number|null} [userId] - partition utilisateur
 * @returns {Promise<string>}
 */
export async function getNextFactureNumber(clientId, clients = [], userId = null) {
  if (!clientId || !Array.isArray(clients)) return '';
  const client = clients.find((c) => c.id === clientId);
  if (!client) return '';
  const slug = getClientDevisSlug(client, clients);
  const year = new Date().getFullYear();
  const prefix = `FAC-${slug}-${year}-`;
  const all = await getAllFactures(userId);
  const forClient = all.filter(
    (f) => f.clientId === clientId && (f.entete?.numero || '').startsWith(prefix)
  );
  let max = 0;
  for (const f of forClient) {
    const n = parseInt((f.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, '0');
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

export async function deleteFacture(id) {
  await db[STORE_FACTURES].delete(id);
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

// ——— Coffre-fort : documents (fichiers chiffrés) ———
export async function addDocument(doc) {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `doc-${Date.now()}`;
  const record = plainClone({ id, ...doc, uploadedAt: (doc.uploadedAt || new Date().toISOString()) });
  await db[STORE_DOCUMENTS].add(record);
  return record;
}
export async function getDocument(id) {
  return (await db[STORE_DOCUMENTS].get(id)) ?? null;
}
export async function getAllDocuments() {
  return db[STORE_DOCUMENTS].toArray();
}
export async function getDocumentsByClientId(clientId) {
  return db[STORE_DOCUMENTS].where('clientId').equals(clientId).toArray();
}
export async function getDocumentsByInvoiceId(linkedInvoiceId) {
  return db[STORE_DOCUMENTS].where('linkedInvoiceId').equals(linkedInvoiceId).toArray();
}
export async function deleteDocument(id) {
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
 * @returns {Promise<{ clients: number, devis: number, factures: number, societe: boolean, layoutProfiles: number }>} nombre d'enregistrements migrés
 */
export async function migrateLegacyDataToUser(userId) {
  if (userId == null) return { clients: 0, devis: 0, factures: 0, societe: false, layoutProfiles: 0 };
  const out = { clients: 0, devis: 0, factures: 0, societe: false, layoutProfiles: 0 };

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

  const profiles = await db[STORE_LAYOUT_PROFILES].toArray();
  for (const r of profiles) {
    if (r.userId != null) continue;
    await db[STORE_LAYOUT_PROFILES].put(plainClone({ ...r, userId }));
    out.layoutProfiles++;
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
