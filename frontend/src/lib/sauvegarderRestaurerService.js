/**
 * Service sauvegarde/restauration : logique métier d'export, import et backup PDF avant restauration.
 */

import { getAllClients, getSociete } from '$lib/db.js';
import { getAllDevis, getAllFactures, getAllAchats } from '$lib/dbEncrypted.js';
import { createArchive, openArchive } from '$lib/archive.js';
import { applyRestore } from '$lib/restore.js';
import { scheduleBackupUpload } from '$lib/backupSync.js';
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
export function safePdfFilename(prefix, numero, id) {
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
  if (!exportCoffre && !exportDocuments) {
    return { error: 'Cochez au moins une option : Coffre fort ou Documents.' };
  }
  const bundle = {};
  if (exportCoffre) {
    const [clients, societe] = await Promise.all([
      getAllClients(uid),
      getSociete(uid)
    ]);
    bundle.clients = clients;
    bundle.societe = { id: 'societe', ...societe };
  }
  if (exportDocuments) {
    const [devis, factures] = await Promise.all([
      getAllDevis(uid),
      getAllFactures(uid)
    ]);
    bundle.devis = devis;
    bundle.factures = factures;
    if (exportAchats) {
      bundle.achats = await getAllAchats(uid);
    }
  }
  const archive = await createArchive(bundle, password);
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
  if (exportCoffre) parts.push('coffre fort');
  if (exportDocuments) {
    parts.push(exportAchats ? 'documents + achats' : 'documents (sans achats)');
  }
  return { success: `Archive téléchargée (${parts.join(', ')}). Pour l'ouvrir ailleurs, utilisez « Restaurer » et le même mot de passe.` };
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
  const bundle = await openArchive(content, password);
  await applyRestore(uid, bundle);
  scheduleBackupUpload(uid);
  const restored = [];
  if (bundle.clients?.length > 0 || bundle.societe != null) restored.push('coffre fort');
  if (bundle.devis?.length > 0 || bundle.factures?.length > 0 || bundle.achats?.length > 0) restored.push('documents');
  if (bundle.coffreFortDocuments?.length > 0) restored.push('pièces jointes');
  return { success: `Restauration terminée (${restored.join(', ')}). Données réimportées et chiffrées avec la clé actuelle.` };
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

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `zerok-documents-avant-restore-${new Date().toISOString().slice(0, 10)}.zip`;
  downloadBlob(zipBlob, zipFilename);
  const count = devis.length + factures.length;
  return {
    success: count > 0
      ? `${count} document(s) PDF téléchargé(s) dans le ZIP. Enregistrez le fichier où vous voulez, puis cliquez sur « Régénérer la BDD » pour lancer la restauration.`
      : 'Aucun devis ni facture. ZIP vide téléchargé. Vous pouvez quand même lancer la restauration.'
  };
}
