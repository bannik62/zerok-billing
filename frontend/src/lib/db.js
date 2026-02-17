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
 * @returns {Promise<Object>} client avec id et createdAt
 */
export async function addClient(client) {
  const uuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  const id = uuid != null ? uuid : `client-${Date.now()}`;
  const record = { id, ...client, createdAt: new Date().toISOString() };
  await db[STORE_CLIENTS].add(record);
  return record;
}

/**
 * Récupère tous les clients.
 * @returns {Promise<Object[]>}
 */
export async function getAllClients() {
  return db[STORE_CLIENTS].toArray();
}

/**
 * Récupère un client par id.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getClientById(id) {
  return (await db[STORE_CLIENTS].get(id)) ?? null;
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

/**
 * Récupère les données société (données personnelles).
 * @returns {Promise<Object>} { logo, nom, formeJuridique, siret, rcs, capital, siegeSocial, tvaIntra }
 */
export async function getSociete() {
  const raw = await db[STORE_SOCIETE].get(SOCIETE_ID);
  return raw ? { ...raw } : {
    logo: '', nom: '', formeJuridique: '', siret: '', rcs: '', capital: '', siegeSocial: '', tvaIntra: ''
  };
}

/**
 * Enregistre les données société (données personnelles).
 * @param {Object} data - { logo, nom, formeJuridique, siret, rcs, capital, siegeSocial, tvaIntra }
 * @returns {Promise<Object>}
 */
export async function saveSociete(data) {
  const record = { id: SOCIETE_ID, ...data };
  await db[STORE_SOCIETE].put(record);
  return record;
}

/**
 * Devis : { id, clientId?, entete: {}, lignes: [], reduction: {}, sousTotal, total, blockPositions: {}, createdAt }
 */
export async function addDevis(devis) {
  const uuid = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null;
  const id = uuid != null ? uuid : `devis-${Date.now()}`;
  const record = plainClone({ id, ...devis, createdAt: new Date().toISOString() });
  await db[STORE_DEVIS].add(record);
  return record;
}

export async function getDevis(id) {
  return (await db[STORE_DEVIS].get(id)) ?? null;
}

export async function getAllDevis() {
  return db[STORE_DEVIS].toArray();
}

/** Pour la couche chiffrée : put/get/getAll bruts sur le store devis. */
export async function putDevisRaw(record) {
  await db[STORE_DEVIS].put(record);
  return record;
}
export async function getDevisRaw(id) {
  return (await db[STORE_DEVIS].get(id)) ?? null;
}
export async function getAllDevisRaw() {
  return db[STORE_DEVIS].toArray();
}

/** Prochain numéro de devis pour l'année en cours (DEV-YYYY-NNN). */
export async function getNextDevisNumber() {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const all = await getAllDevis();
  const thisYear = all.filter((d) => (d.entete?.numero || '').startsWith(prefix));
  let max = 0;
  for (const d of thisYear) {
    const n = parseInt((d.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  const seq = String(max + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

export async function updateDevis(devis) {
  const existing = await getDevis(devis.id);
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
 * @typedef {{ id: string, name: string, blockPositions: Object, createdAt: string }} LayoutProfile
 */

export async function getAllLayoutProfiles() {
  return db[STORE_LAYOUT_PROFILES].toArray();
}

export async function getLayoutProfile(id) {
  return (await db[STORE_LAYOUT_PROFILES].get(id)) ?? null;
}

export async function addLayoutProfile(profile) {
  const id = crypto.randomUUID?.() ?? `profile-${Date.now()}`;
  const record = plainClone({
    id,
    name: profile.name?.trim() || 'Sans nom',
    blockPositions: profile.blockPositions ?? {},
    createdAt: new Date().toISOString()
  });
  await db[STORE_LAYOUT_PROFILES].add(record);
  return record;
}

export async function updateLayoutProfile(id, updates) {
  const existing = await getLayoutProfile(id);
  if (!existing) throw new Error('Profil introuvable');
  const record = plainClone({ ...existing, ...updates, id: existing.id, createdAt: existing.createdAt });
  await db[STORE_LAYOUT_PROFILES].put(record);
  return record;
}

export async function deleteLayoutProfile(id) {
  await db[STORE_LAYOUT_PROFILES].delete(id);
}

/**
 * Facture : { id, clientId?, devisId?, entete: {}, lignes, reduction, sousTotal, total, tvaMontant?, totalTTC?, blockPositions, createdAt }
 * Numéro : FAC-YYYY-NNN.
 */
export async function getAllFactures() {
  return db[STORE_FACTURES].toArray();
}

/** Prochain numéro de facture pour l'année en cours (FAC-YYYY-NNN). */
export async function getNextFactureNumber() {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const all = await getAllFactures();
  const thisYear = all.filter((f) => (f.entete?.numero || '').startsWith(prefix));
  let max = 0;
  for (const f of thisYear) {
    const n = parseInt((f.entete?.numero || '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  const seq = String(max + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

export async function addFacture(facture) {
  const id = crypto.randomUUID?.() ?? `facture-${Date.now()}`;
  const record = plainClone({ id, ...facture, createdAt: new Date().toISOString() });
  await db[STORE_FACTURES].add(record);
  return record;
}

export async function getFacture(id) {
  return (await db[STORE_FACTURES].get(id)) ?? null;
}

export async function updateFacture(facture) {
  const existing = await getFacture(facture.id);
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
export async function getAllFacturesRaw() {
  return db[STORE_FACTURES].toArray();
}
