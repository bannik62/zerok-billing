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
  // Ne toucher une section que si elle était explicitement incluse (flag === true).
  // buildBundle et openArchive fournissent ces flags ; sans flag, on ne clear ni ne restaure (évite d'effacer le coffre-fort à chaque sync serveur).
  const hasCoffre = Array.isArray(bundle.clients) || (bundle.societe != null && typeof bundle.societe === 'object');
  const hasDocuments = bundle.includesDocumentsSection === true;
  const hasAchats = bundle.includesAchats === true;
  const hasCoffreFortFiles = bundle.includesCoffreFortSection === true;
  const coffreDocsCount = Array.isArray(bundle.coffreFortDocuments) ? bundle.coffreFortDocuments.length : 0;
  console.log('[zerok restore] applyRestore — hasCoffreFortFiles:', hasCoffreFortFiles, '| coffreFortDocuments à réinsérer:', coffreDocsCount);
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
    for (const doc of bundle.linkedDocuments || []) {
      const toPut = { ...doc, ...(uid != null && { userId: uid }) };
      await putDocumentRaw(toPut);
    }
  }
  if (hasAchats) {
    for (const a of bundle.achats || []) {
      await addAchat(a, uid);
    }
  }
  if (hasCoffreFortFiles) {
    const docs = Array.isArray(bundle.coffreFortDocuments) ? bundle.coffreFortDocuments : [];
    for (const doc of docs) {
      if (doc && (doc.id != null || doc.payload != null)) {
        const toPut = { ...doc, ...(uid != null && { userId: uid }) };
        await putDocumentRaw(toPut);
      }
    }
  }
}
