/**
 * Logique metier de restauration d'un bundle (clients, societe, devis, factures, achats, coffre-fort) en local.
 * Partagee entre import manuel (fichier) et restauration depuis la sauvegarde serveur.
 */

import { openDB, clearLocalDataForUser, putDocumentRaw } from '$lib/db.js';
import { addDevis, addFacture, addAchat } from '$lib/dbEncrypted.js';

/**
 * Applique un bundle restaure en base locale.
 * @param {string|number|null} uid - Id utilisateur (null = legacy)
 * @param {Object} bundle - { devis?, factures?, achats?, includesAchats?, clients?, societe?, coffreFortDocuments? } (format normalise openArchive)
 */
export async function applyRestore(uid, bundle) {
  // Présence du tableau = on restaure cette section (y compris liste vide → suppressions propagées).
  const hasCoffre = Array.isArray(bundle.clients) || (bundle.societe != null && typeof bundle.societe === 'object');
  const hasDocuments = Array.isArray(bundle.devis) || Array.isArray(bundle.factures);
  const hasAchats = bundle?.includesAchats === true || Array.isArray(bundle.achats);
  const hasCoffreFortFiles = Array.isArray(bundle.coffreFortDocuments);
  await clearLocalDataForUser(uid, {
    coffre: hasCoffre,
    documents: hasDocuments,
    achats: hasAchats,
    coffreFortFiles: hasCoffreFortFiles
  });
  const db = await openDB();
  if (hasCoffre) {
    for (const c of bundle.clients || []) {
      await db.clients.put(uid != null ? { ...c, userId: uid } : c);
    }
    if (bundle.societe && bundle.societe.id) {
      const societeId = uid != null ? `societe-${uid}` : bundle.societe.id;
      await db.societe.put({ ...bundle.societe, id: societeId, ...(uid != null && { userId: uid }) });
    }
  }
  if (hasDocuments) {
    for (const d of bundle.devis || []) {
      await addDevis(d, uid);
    }
    for (const f of bundle.factures || []) {
      await addFacture(f, uid);
    }
  }
  if (hasAchats) {
    for (const a of bundle.achats || []) {
      await addAchat(a, uid);
    }
  }
  if (hasCoffreFortFiles) {
    for (const doc of bundle.coffreFortDocuments) {
      await putDocumentRaw({ ...doc, ...(uid != null && { userId: uid }) });
    }
  }
}
