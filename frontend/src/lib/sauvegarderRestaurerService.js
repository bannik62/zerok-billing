/**
 * Service sauvegarde/restauration : logique métier d'export, import et backup PDF avant restauration.
 */

import { getAllClients, getSociete, getAllDocuments, getDocument } from '$lib/db.js';
import { getAllDevis, getAllFactures, getAllAchats, decryptDocumentBlob, hasEncryptionKey } from '$lib/dbEncrypted.js';
import { createArchive, openArchive } from '$lib/archive.js';
import { applyRestore } from '$lib/restore.js';
import { syncProofsAfterRestore } from '$lib/proofs.js';
import { buildPdfDocumentHtml } from '$lib/pdfDocumentHtml.js';
import { downloadBlob } from '$lib/coffreFortExport.js';
import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';

/**
 * Nom de fichier sûr pour un PDF (sans caractères interdits).
 * @param {string} prefix - ex. "Devis" ou "Facture"
 * @param {string} numero - numéro du document
 * @param {string} id - id de secours si pas de numéro
 * @returns {string}
 */
export function  safePdfFilename(prefix, numero, id) {
  const base = numero && String(numero).trim() ? String(numero).replace(/[/\\?*:|"]/g, '-') : (id || '');
  return (prefix + (base ? `-${base}` : '') + '.pdf').trim() || prefix + '.pdf';
}

/**
 * Crée et télécharge une archive chiffrée.
 * @param {Object} options
 * @param {string|null} options.uid - Id utilisateur
 * @param {boolean} options.exportCoffre - inclure coffre fort
 * @param {boolean} options.exportDocuments - inclure devis/factures
 * @param {boolean} options.exportAchats - inclure achats
 * @param {string} options.password - mot de passe de l'archive
 * @returns {Promise<{ success: string } | { error: string }>}
 */
export async function exportArchive({ uid, exportCoffre, exportDocuments, exportAchats, password }) {
  const includeCoffre = Boolean(exportCoffre);
  const includeDocuments = Boolean(exportDocuments);
  const pwd = (password != null && typeof password === 'string' ? password : '').trim();
  if (!pwd || pwd.length < 6) {
    return { error: 'Le mot de passe doit faire au moins 6 caractères.' };
  }
  if (!includeCoffre && !includeDocuments) {
    return { error: 'Cochez au moins une option : Coffre fort ou Documents.' };
  }

  const bundle = {};
  const needDocuments = includeCoffre || includeDocuments;
  const allDocuments = needDocuments ? await getAllDocuments(uid) : [];
  const allDocs = Array.isArray(allDocuments) ? allDocuments : [];

  if (includeDocuments) {
    const [devis, factures] = await Promise.all([
      getAllDevis(uid),
      getAllFactures(uid)
    ]);
    const linkedToInvoices = allDocs.filter((d) => d && d.linkedInvoiceId);
    bundle.devis = Array.isArray(devis) ? devis : [];
    bundle.factures = Array.isArray(factures) ? factures : [];
    bundle.linkedDocuments = linkedToInvoices;
    if (exportAchats) {
      const achats = await getAllAchats(uid);
      bundle.achats = Array.isArray(achats) ? achats : [];
    }
  }

  if (includeCoffre) {
    bundle.coffreFortDocuments = allDocs.filter((d) => !d || !d.linkedInvoiceId).map((d) => ({ ...d }));
  }

  if (!includeDocuments) {
    delete bundle.devis;
    delete bundle.factures;
    delete bundle.linkedDocuments;
    delete bundle.achats;
  }
  if (!includeCoffre) {
    delete bundle.coffreFortDocuments;
  }

  const archive = await createArchive(bundle, pwd);
  const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `zerok-archive-${new Date().toISOString().slice(0, 10)}.zerok-archive`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  const parts = [];
  if (includeCoffre) parts.push('coffre fort');
  if (includeDocuments) {
    parts.push(exportAchats ? 'documents + achats' : 'documents (sans achats)');
  }
  return { success: `Archive téléchargée (${parts.join(', ')}). Pour l'ouvrir ailleurs, utilisez « Restaurer » et le même mot de passe.` };
}

/**
 * Télécharge l'état actuel en fichier JSON déchiffré (lisible). Pas de mot de passe.
 * @param {Object} options
 * @param {string|null} options.uid - Id utilisateur
 * @returns {Promise<{ success: string } | { error: string }>}
 */
export async function exportArchiveDecrypted({ uid }) {
  const bundle = {};
  const allDocuments = await getAllDocuments(uid);
  const [devis, factures, achats] = await Promise.all([
    getAllDevis(uid),
    getAllFactures(uid),
    getAllAchats(uid)
  ]);
  const linkedToInvoices = Array.isArray(allDocuments)
    ? allDocuments.filter((d) => d && d.linkedInvoiceId)
    : [];
  bundle.devis = Array.isArray(devis) ? devis : [];
  bundle.factures = Array.isArray(factures) ? factures : [];
  bundle.linkedDocuments = linkedToInvoices;
  bundle.achats = Array.isArray(achats) ? achats : [];
  const coffreOnly = (Array.isArray(allDocuments) ? allDocuments : []).filter((d) => !d || !d.linkedInvoiceId).map((d) => ({ ...d }));
  bundle.coffreFortDocuments = coffreOnly;

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `zerok-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  return { success: 'Fichier déchiffré téléchargé (coffre fort + documents + achats). Conservez-le en lieu sûr.' };
}

/**
 * Télécharge un ZIP avec les vrais fichiers : PDF devis/factures + fichiers du coffre fort + pièces jointes (déchiffrés).
 * @param {Object} options
 * @param {string|null} options.uid - Id utilisateur
 * @returns {Promise<{ success: string } | { error: string }>}
 */
export async function exportZipWithFiles({ uid }) {
  if (!hasEncryptionKey()) {
    return { error: 'Déverrouillez d\'abord avec votre mot de passe.' };
  }
  const [devis, factures, clients, societe, allDocuments] = await Promise.all([
    getAllDevis(uid),
    getAllFactures(uid),
    getAllClients(uid),
    getSociete(uid),
    getAllDocuments(uid)
  ]);
  const clientsMap = {};
  for (const c of clients) {
    if (c && c.id != null) clientsMap[c.id] = c;
  }
  const zip = new JSZip();
  const usedPdfNames = new Set();

  const addPdfToZip = async (document, docType) => {
    const clientId = document?.entete?.clientId ?? document?.clientId;
    const client = clientId ? clientsMap[clientId] : null;
    const numero = document?.entete?.numero ?? '';
    const prefix = docType === 'devis' ? 'Devis' : 'Facture';
    let filename = safePdfFilename(prefix, numero, document?.id);
    if (usedPdfNames.has(filename)) {
      let n = 1;
      while (usedPdfNames.has(prefix + '-' + n + '.pdf')) n++;
      filename = prefix + '-' + n + '.pdf';
    }
    usedPdfNames.add(filename);
    const htmlString = buildPdfDocumentHtml(document, client, societe, docType);
    const blob = await html2pdf()
      .set({
        margin: 4,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(htmlString)
      .outputPdf('blob');
    zip.file(filename, blob);
  };

  for (const doc of devis) {
    if (doc) await addPdfToZip(doc, 'devis');
  }
  for (const doc of factures) {
    if (doc) await addPdfToZip(doc, 'facture');
  }

  const coffreDocs = Array.isArray(allDocuments) ? allDocuments.filter((d) => !d || !d.linkedInvoiceId) : [];
  const usedCoffreNames = new Set();
  for (const d of coffreDocs) {
    if (!d?.id) continue;
    try {
      const full = await getDocument(d.id, uid);
      if (!full?.encrypted || !full?.payload || !full?.iv) continue;
      const blob = await decryptDocumentBlob(full);
      let name = (full.filename || 'document').replace(/[/\\?*:|"]/g, '-');
      if (usedCoffreNames.has(name)) {
        const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
        const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
        let n = 1;
        while (usedCoffreNames.has(base + '_' + n + ext)) n++;
        name = base + '_' + n + ext;
      }
      usedCoffreNames.add(name);
      zip.file('coffre-fort/' + name, blob);
    } catch (_) {}
  }

  const linkedDocs = Array.isArray(allDocuments) ? allDocuments.filter((d) => d && d.linkedInvoiceId) : [];
  const usedPjNames = new Set();
  for (const d of linkedDocs) {
    if (!d?.id) continue;
    try {
      const full = await getDocument(d.id, uid);
      if (!full?.encrypted || !full?.payload || !full?.iv) continue;
      const blob = await decryptDocumentBlob(full);
      let name = (full.filename || full.linkedInvoiceId || 'piece').replace(/[/\\?*:|"]/g, '-');
      if (usedPjNames.has(name)) {
        const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
        const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
        let n = 1;
        while (usedPjNames.has(base + '_' + n + ext)) n++;
        name = base + '_' + n + ext;
      }
      usedPjNames.add(name);
      zip.file('pieces-jointes/' + name, blob);
    } catch (_) {}
  }

  zip.file(
    'LISEZMOI.txt',
    'Ce ZIP contient :\n' +
      '- Les PDF des devis et factures (à la racine)\n' +
      '- Le contenu du coffre fort (dossier coffre-fort/)\n' +
      '- Les pièces jointes des devis/factures (dossier pieces-jointes/)\n'
  );

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `zerok-export-fichiers-${new Date().toISOString().slice(0, 10)}.zip`;
  downloadBlob(zipBlob, zipFilename);
  const countPdf = (devis?.length || 0) + (factures?.length || 0);
  const countCoffre = coffreDocs.length;
  const countPj = linkedDocs.length;
  return {
    success: `ZIP téléchargé : ${countPdf} PDF, ${countCoffre} fichier(s) coffre fort, ${countPj} pièce(s) jointe(s).`
  };
}

/**
 * Restaure une archive depuis un fichier.
 * @param {Object} options
 * @param {File} options.file - fichier d'archive
 * @param {string} options.password - mot de passe
 * @param {string|null} options.uid - Id utilisateur
 * @returns {Promise<{ success: string } | { error: string }>}
 */
export async function importArchive({ file, password, uid }) {
  const content = await file.text();
  const pwd = (password != null && typeof password === 'string' ? password : '').trim();
  if (!pwd || pwd.length < 6) {
    return { error: 'Le mot de passe de l\'archive doit faire au moins 6 caractères.' };
  }
  const bundle = await openArchive(content, pwd);
  await applyRestore(uid, bundle);
  let syncMessage = '';
  try {
    const { count } = await syncProofsAfterRestore(uid);
    syncMessage = count > 0 ? ` Preuves d'intégrité synchronisées (${count}).` : ' Preuves d\'intégrité synchronisées.';
  } catch (e) {
    console.warn('[zerok import] syncProofsAfterRestore failed:', e);
    syncMessage = ' Les preuves d\'intégrité n\'ont pas pu être synchronisées (réessayez plus tard ou depuis la liste des documents).';
  }
  // Ne pas appeler scheduleBackupUpload ici : une archive peut être partielle (ex. coffre seul).
  // Envoyer cet état au serveur écraserait le backup serveur complet. L'utilisateur peut cliquer « Sauvegarder maintenant » s'il souhaite pousser l'état restauré.
  const restored = [];
  if (bundle.clients?.length > 0 || bundle.societe != null) restored.push('coffre fort');
  if (bundle.devis?.length > 0 || bundle.factures?.length > 0 || bundle.achats?.length > 0) restored.push('documents');
  if (bundle.coffreFortDocuments?.length > 0) restored.push('fichiers coffre-fort');
  if (bundle.linkedDocuments?.length > 0) restored.push('pièces jointes devis/factures');
  return { success: `Restauration terminée (${restored.join(', ')}). Données réimportées et chiffrées avec la clé actuelle.${syncMessage} Pour synchroniser le backup avec le serveur, cliquez sur « Sauvegarder maintenant ».` };
}

/**
 * Télécharge les devis et factures actuels en PDF dans un ZIP (avant restauration destructive).
 * @param {Object} options
 * @param {string|null} options.uid - Id utilisateur
 * @returns {Promise<{ success: string } | { error: string }>}
 */
export async function preRestoreBackupPdf({ uid }) {
  const [devis, factures, clients, societe] = await Promise.all([
    getAllDevis(uid),
    getAllFactures(uid),
    getAllClients(uid),
    getSociete(uid)
  ]);
  const clientsMap = {};
  for (const c of clients) {
    if (c && c.id != null) clientsMap[c.id] = c;
  }
  const zip = new JSZip();
  const usedNames = new Set();

  const addPdfToZip = async (document, docType) => {
    const clientId = document?.entete?.clientId ?? document?.clientId;
    const client = clientId ? clientsMap[clientId] : null;
    const numero = document?.entete?.numero ?? '';
    const prefix = docType === 'devis' ? 'Devis' : 'Facture';
    let filename = safePdfFilename(prefix, numero, document?.id);
    if (usedNames.has(filename)) {
      let n = 1;
      while (usedNames.has(prefix + '-' + n + '.pdf')) n++;
      filename = prefix + '-' + n + '.pdf';
    }
    usedNames.add(filename);
    const htmlString = buildPdfDocumentHtml(document, client, societe, docType);
    const blob = await html2pdf()
      .set({
        margin: 4,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(htmlString)
      .outputPdf('blob');
    zip.file(filename, blob);
  };

  for (const doc of devis) {
    if (doc) await addPdfToZip(doc, 'devis');
  }
  for (const doc of factures) {
    if (doc) await addPdfToZip(doc, 'facture');
  }

  zip.file(
    'LISEZMOI.txt',
    'Ce ZIP contient UNIQUEMENT les PDF des devis et factures.\n\n' +
      'Il ne contient PAS les fichiers du coffre fort (lettre de motivation, etc.).\n\n' +
      'Pour sauvegarder ou restaurer le coffre fort, utilisez plutôt :\n' +
      '« Créer une archive et l\'exporter » (cochez Coffre fort) puis « Restaurer » dans l\'app avec le fichier .zerok-archive.'
  );

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `zerok-devis-factures-pdf-${new Date().toISOString().slice(0, 10)}.zip`;
  downloadBlob(zipBlob, zipFilename);
  const count = devis.length + factures.length;
  return {
    success: count > 0
      ? `${count} PDF devis/factures dans le ZIP. Ce ZIP ne contient pas le coffre fort ; pour celui-ci, utilisez « Créer et télécharger l\'archive » avec Coffre fort coché.`
      : 'Aucun devis ni facture. ZIP vide téléchargé. Vous pouvez quand même lancer la restauration.'
  };
}
