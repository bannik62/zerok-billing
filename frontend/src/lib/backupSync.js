/**
 * Orchestration metier : sync a l'ouverture (apres unlock) et PUT apres modifications.
 * Utilise le mot de passe en memoire (defini au deverrouillage, efface au logout) pour chiffrer l'archive.
 */

import { writable } from 'svelte/store';
import { getAllClients, getSociete, getAllDocuments, clearLocalDataForUser } from '$lib/db.js';
import {
  getAllDevis,
  getAllFactures,
  getAllAchats,
  getKeyDerivationSalt,
  setKeyDerivationSalt,
  clearKeyDataForUser,
  getEncryptionKey,
  initEncryption
} from '$lib/dbEncrypted.js';
import { createArchive, openArchive } from '$lib/archive.js';
import { applyRestore } from '$lib/restore.js';
import { computeStateHash } from '$lib/backupStateHash.js';
import { getBackup, putBackup } from '$lib/backupApi.js';
import { deriveKey, saltFromBase64, decryptFile, encryptFile } from '$lib/crypto/index.js';

/**
 * Resultat de la derniere sync apres unlock.
 * - null : pas de message (404, ou premier PUT)
 * - 'unchanged' : base locale a jour avec le serveur (aucun telechargement)
 * - 'restored_empty' : base etait vide, recuperee depuis le serveur
 * - 'restored_overwritten' : base locale avait des donnees mais differentes du serveur, reconstituee depuis le serveur
 */
export const syncResultStore = writable(/** @type {null | 'unchanged' | 'restored_empty' | 'restored_overwritten' | 'backup_error'} */ (null));

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
 * Fusionne deux bundles par id : union des entrées, serveur gagne en cas de doublon.
 * Permet l'agrégation multiposte (ajouter les éléments manquants sans perdre le local).
 * @param {Object} local - bundle local (buildBundle)
 * @param {Object} server - bundle serveur (openArchive)
 * @returns {Object} bundle fusionné
 */
function mergeBundles(local, server) {
  const mergeById = (localArr, serverArr) => {
    const byId = new Map();
    (serverArr || []).forEach((x) => { if (x?.id != null) byId.set(String(x.id), x); });
    (localArr || []).forEach((x) => { if (x?.id != null && !byId.has(String(x.id))) byId.set(String(x.id), x); });
    return [...byId.values()];
  };
  return {
    clients: mergeById(local.clients ?? [], server.clients ?? []),
    societe: server.societe != null && typeof server.societe === 'object' ? server.societe : (local.societe != null && typeof local.societe === 'object' ? local.societe : null),
    devis: mergeById(local.devis ?? [], server.devis ?? []),
    factures: mergeById(local.factures ?? [], server.factures ?? []),
    achats: mergeById(local.achats ?? [], server.achats ?? []),
    coffreFortDocuments: mergeById(local.coffreFortDocuments ?? [], server.coffreFortDocuments ?? []),
    includesAchats: server.includesAchats === true || (Array.isArray(local.achats) && local.achats.length > 0) || (Array.isArray(server.achats) && server.achats.length > 0)
  };
}

/**
 * Construit le bundle local complet pour la sauvegarde automatique serveur.
 * Inclut toujours tout (clients, societe, devis, factures, achats, coffreFortDocuments) — pas de filtre selon les cases de l'export manuel.
 * Pour l'export manuel (.zerok-archive), voir exportArchive dans sauvegarderRestaurerService.js qui respecte les options Coffre fort / Documents.
 */
export async function buildBundle(uid) {
  const [clients, societe, devis, factures, achats, coffreFortDocuments, keyDerivationSalt] =
    await Promise.all([
      getAllClients(uid),
      getSociete(uid),
      getAllDevis(uid),
      getAllFactures(uid),
      getAllAchats(uid),
      getAllDocuments(uid),
      getKeyDerivationSalt(uid)
    ]);
  return {
    clients: clients ?? [],
    societe: societe ? { id: 'societe', ...societe } : null,
    devis: devis ?? [],
    factures: factures ?? [],
    achats: achats ?? [],
    coffreFortDocuments: coffreFortDocuments ?? [],
    includesAchats: true,
    includesCoffreFortSection: true,
    includesDocumentsSection: true,
    // Option C (coffre-fort multiposte) : propage le sel de derivation pour que
    // tous les postes derivent la meme cle de chiffrement. Le sel voyage uniquement
    // dans l'archive chiffrée (createArchive/openArchive) et n'entre pas dans le
    // hash fonctionnel de contenu (backupStateHash).
    keyDerivationSalt: keyDerivationSalt || null
  };
}

/**
 * Sync après déverrouillage (sauvegarde automatique multiposte).
 * Règle : le serveur fait foi. À l’ouverture sur un poste (IndexedDB vide ou pleine), on décide
 * de télécharger le blob ou pas selon la comparaison de hash côté serveur.
 *
 * Logique mise à jour ou pas :
 * 1) IndexedDB vide (autre poste / premier usage)
 *    - GET /api/backup sans hash → si 404 : rien à faire ; si 200 + blob : on télécharge et on restaure (serveur fait foi).
 * 2) IndexedDB pleine (données locales présentes)
 *    - GET /api/backup avec hash = hash du bundle local.
 *    - Serveur compare hash avec son stateHash stocké :
 *      - hash identique → 200 { unchanged: true } → on ne fait rien (déjà à jour).
 *      - hash différent  → 200 + blob → on télécharge et on restaure (serveur fait foi).
 *      - 404 (pas de backup serveur) → on envoie notre bundle en PUT (création backup ; cas premier poste).
 * Après toute restauration, on envoie un PUT pour aligner le stateHash serveur sur l’état qu’on vient de restaurer.
 *
 * @param {string|number} uid
 * @param {string} password - Mot de passe (openArchive + PUT si première sauvegarde)
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
    && bundle.achats.length === 0
    && (bundle.coffreFortDocuments?.length ?? 0) === 0;

  try {
    if (isEmpty) {
      // IndexedDB vide : on demande le blob (pas de hash). Serveur fait foi.
      const result = await getBackup(null);
      if (result.status === 404) return { restored: false };
      if (result.status === 200 && result.payload) {
        const restoredBundle = await openArchive(result.payload, password);
        // Option C : si le bundle vient d'un autre poste, il contient un sel
        // different. On remet a zero les donnees de cle, on ecrit le sel du bundle,
        // puis on derive la cle AVANT de re-importer les donnees.
        if (uid != null && restoredBundle.keyDerivationSalt) {
          await clearKeyDataForUser(uid);
          await setKeyDerivationSalt(restoredBundle.keyDerivationSalt, uid);
        }
        await initEncryption(password, uid);
        await applyRestore(uid, restoredBundle);
        try {
          await _putCurrentState(uid, password);
          syncResultStore.set('restored_empty');
        } catch (err) {
          console.error('[zerok-billing] Échec mise à jour backup serveur après restauration:', err);
          syncResultStore.set('backup_error');
        }
        return { restored: true };
      }
      return { restored: false };
    }

    // IndexedDB pleine : on envoie notre hash. Serveur décide (unchanged vs blob).
    const stateHash = await computeStateHash(bundle);
    const result = await getBackup(stateHash);
    if (result.status === 404) {
      // Pas de backup serveur → on crée le backup avec notre état (ex. premier poste).
      const archive = await createArchive(bundle, password);
      await putBackup(JSON.stringify(archive), stateHash);
      return { restored: false };
    }
    if (result.status === 200 && result.unchanged) {
      // Hash identique : rien à télécharger.
      syncResultStore.set('unchanged');
      return { restored: false };
    }
    if (result.status === 200 && result.payload) {
      // Hash différent : on fusionne local + serveur (mergeBundles) pour ne pas perdre les données
      // créées sur ce poste et pas encore uploadées. Serveur gagne en cas de doublon d’id.
      const restoredBundle = await openArchive(result.payload, password);
      const mergedBundle = mergeBundles(bundle, restoredBundle);
      mergedBundle.keyDerivationSalt = restoredBundle.keyDerivationSalt;
      mergedBundle.includesAchats = restoredBundle.includesAchats ?? mergedBundle.includesAchats ?? true;
      mergedBundle.includesCoffreFortSection = restoredBundle.includesCoffreFortSection ?? true;
      mergedBundle.includesDocumentsSection = restoredBundle.includesDocumentsSection ?? true;

      // Re-chiffrement des fichiers coffre locaux si le sel change (key_B → key_A) : les docs
      // venant du serveur sont déjà en key_A ; les docs uniquement locaux sont en key_B.
      const oldKey = getEncryptionKey();
      const currentSaltBase64 = uid != null ? await getKeyDerivationSalt(uid) : null;
      const newSaltBase64 = restoredBundle.keyDerivationSalt;
      if (oldKey && newSaltBase64 && currentSaltBase64 && currentSaltBase64 !== newSaltBase64) {
        const newSalt = saltFromBase64(newSaltBase64);
        const newKey = await deriveKey(password, newSalt);
        const serverDocIds = new Set(
          (restoredBundle.coffreFortDocuments ?? []).map((d) => (d && d.id != null ? String(d.id) : null)).filter(Boolean)
        );
        mergedBundle.coffreFortDocuments = await Promise.all(
          (mergedBundle.coffreFortDocuments ?? []).map(async (doc) => {
            if (!doc?.id || serverDocIds.has(String(doc.id))) return doc;
            if (!doc.encrypted || !doc.payload || !doc.iv) return doc;
            try {
              const blob = await decryptFile(
                { payload: doc.payload, iv: doc.iv, mimeType: doc.mimeType },
                oldKey
              );
              const buffer = await blob.arrayBuffer();
              const reenc = await encryptFile(buffer, newKey);
              return { ...doc, payload: reenc.payload, iv: reenc.iv };
            } catch {
              return doc;
            }
          })
        );
      }

      if (uid != null && restoredBundle.keyDerivationSalt) {
        await clearKeyDataForUser(uid);
        await setKeyDerivationSalt(restoredBundle.keyDerivationSalt, uid);
      }
      if (uid != null) {
        await clearLocalDataForUser(uid, {
          coffre: true,
          documents: true,
          achats: true,
          coffreFortFiles: true
        });
      }
      await initEncryption(password, uid);
      await applyRestore(uid, mergedBundle);
      try {
        await _putCurrentState(uid, password);
        syncResultStore.set('restored_overwritten');
      } catch (err) {
        console.error('[zerok-billing] Échec mise à jour backup serveur après restauration:', err);
        syncResultStore.set('backup_error');
      }
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
 * Envoie l'état local uniquement (pas de merge avant PUT) pour que les suppressions soient bien prises en compte.
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
