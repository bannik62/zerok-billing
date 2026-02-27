/**
 * Orchestration metier : sync a l'ouverture (apres unlock) et PUT apres modifications.
 * Utilise le mot de passe en memoire (defini au deverrouillage, efface au logout) pour chiffrer l'archive.
 */

import { writable } from 'svelte/store';
import { getAllClients, getSociete } from '$lib/db.js';
import { getAllDevis, getAllFactures, getAllAchats } from '$lib/dbEncrypted.js';
import { createArchive, openArchive } from '$lib/archive.js';
import { applyRestore } from '$lib/restore.js';
import { computeStateHash } from '$lib/backupStateHash.js';
import { getBackup, putBackup } from '$lib/backupApi.js';

/**
 * Resultat de la derniere sync apres unlock.
 * - null : pas de message (404, ou premier PUT)
 * - 'unchanged' : base locale a jour avec le serveur (aucun telechargement)
 * - 'restored_empty' : base etait vide, recuperee depuis le serveur
 * - 'restored_overwritten' : base locale avait des donnees mais differentes du serveur, reconstituee depuis le serveur
 */
export const syncResultStore = writable(/** @type {null | 'unchanged' | 'restored_empty' | 'restored_overwritten'} */ (null));

/** True quand la sync post-unlock est terminee (safe d'afficher le menu). Faux pendant la sync. */
export const syncReadyStore = writable(true);

let _backupPassword = null;
let _uploadTimeout = null;
const UPLOAD_DEBOUNCE_MS = 2000;

export function setBackupPassword(password) {
  _backupPassword = password == null || password === '' ? null : String(password);
}

export function clearBackupPassword() {
  _backupPassword = null;
  if (_uploadTimeout) {
    clearTimeout(_uploadTimeout);
    _uploadTimeout = null;
  }
}

/**
 * Construit le bundle local (coffre + documents + achats) pour l'utilisateur.
 */
export async function buildBundle(uid) {
  const [clients, societe, devis, factures, achats] = await Promise.all([
    getAllClients(uid),
    getSociete(uid),
    getAllDevis(uid),
    getAllFactures(uid),
    getAllAchats(uid)
  ]);
  return {
    clients: clients ?? [],
    societe: societe ? { id: 'societe', ...societe } : null,
    devis: devis ?? [],
    factures: factures ?? [],
    achats: achats ?? []
  };
}

/**
 * Sync apres deverrouillage : BDD vide -> GET et restaurer si 200+blob ; BDD pleine -> GET avec hash (404->PUT, 200 unchanged->rien, 200+blob->restaurer).
 * @param {string|number} uid
 * @param {string} password - Mot de passe (utilise pour openArchive et pour PUT si premiere sauvegarde)
 * @returns {{ restored: boolean }}
 */
export async function syncAfterUnlock(uid, password) {
  syncResultStore.set(null);
  syncReadyStore.set(false);
  setBackupPassword(password);
  const bundle = await buildBundle(uid);
  const isEmpty = bundle.clients.length === 0
    && bundle.devis.length === 0
    && bundle.factures.length === 0
    && bundle.achats.length === 0;

  try {
    if (isEmpty) {
      const result = await getBackup(null);
      if (result.status === 404) return { restored: false };
      if (result.status === 200 && result.payload) {
        const restoredBundle = await openArchive(result.payload, password);
        await applyRestore(uid, restoredBundle);
        await _putCurrentState(uid, password).catch(() => {});
        syncResultStore.set('restored_empty');
        return { restored: true };
      }
      return { restored: false };
    }

    const stateHash = await computeStateHash(bundle);
    const result = await getBackup(stateHash);
    if (result.status === 404) {
      const archive = await createArchive(bundle, password);
      await putBackup(JSON.stringify(archive), stateHash);
      return { restored: false };
    }
    if (result.status === 200 && result.unchanged) {
      syncResultStore.set('unchanged');
      return { restored: false };
    }
    if (result.status === 200 && result.payload) {
      const restoredBundle = await openArchive(result.payload, password);
      await applyRestore(uid, restoredBundle);
      await _putCurrentState(uid, password).catch(() => {});
      syncResultStore.set('restored_overwritten');
      return { restored: true };
    }
    return { restored: false };
  } finally {
    syncReadyStore.set(true);
  }
}

/**
 * PUT /api/backup avec l'état réel de la base locale au moment de l'appel.
 * Utilisé après applyRestore pour aligner le hash serveur sur ce qui est en base.
 */
async function _putCurrentState(uid, password) {
  const currentBundle = await buildBundle(uid);
  const currentHash = await computeStateHash(currentBundle);
  const archive = await createArchive(currentBundle, password);
  await putBackup(JSON.stringify(archive), currentHash);
}

/**
 * Declenche un PUT /api/backup en arriere-plan (debounce). No-op si mot de passe non defini.
 * A appeler apres chaque modification (devis, facture, achats, coffre).
 */
export function scheduleBackupUpload(uid) {
  if (_backupPassword == null || uid == null) return;
  if (_uploadTimeout) clearTimeout(_uploadTimeout);
  _uploadTimeout = setTimeout(async () => {
    _uploadTimeout = null;
    try {
      const bundle = await buildBundle(uid);
      const stateHash = await computeStateHash(bundle);
      const archive = await createArchive(bundle, _backupPassword);
      await putBackup(JSON.stringify(archive), stateHash);
    } catch (_) {
      // echec silencieux (reseau, etc.)
    }
  }, UPLOAD_DEBOUNCE_MS);
}

/**
 * Declenche un PUT immediat (ex. bouton "Sauvegarder maintenant"). Retourne une Promise.
 */
export async function uploadBackupNow(uid) {
  if (_backupPassword == null || uid == null) return;
  const bundle = await buildBundle(uid);
  const stateHash = await computeStateHash(bundle);
  const archive = await createArchive(bundle, _backupPassword);
  await putBackup(JSON.stringify(archive), stateHash);
}
