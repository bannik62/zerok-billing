/**
 * Service liste documents : export ZIP, envoi signature, chargement, suppression.
 */

import {
  getAllDevis,
  getAllFactures,
  getAllClients,
  getSociete,
  deleteDevis,
  deleteFacture,
  updateDevis,
  updateFacture,
  getDocumentsByInvoiceId,
  decryptDocumentBlob
} from '$lib/dbEncrypted.js';
import { hashDocument } from '$lib/crypto/index.js';
import { getProofs, verifyProofs, deleteProof } from '$lib/proofs.js';
import { buildAttachmentsZip, downloadBlob } from '$lib/coffreFortExport.js';
import { buildPdfDocumentHtml } from '$lib/pdfDocumentHtml.js';
import { scheduleBackupUpload, uploadBackupNow } from '$lib/backupSync.js';
import { apiClient } from '$lib/apiClient.js';
import html2pdf from 'html2pdf.js';

/**
 * Exporte les pièces jointes d'un devis/facture en ZIP.
 * @param {string} invoiceId
 * @param {'devis'|'facture'} type
 * @param {string} numero - pour le nom du fichier
 * @param {string|null} uid
 * @returns {Promise<{ success: true } | { error: string }>}
 */
export async function exportPiecesJointesZip(invoiceId, type, numero, uid) {
  if (!invoiceId) return { error: 'ID invalide.' };
  const docs = await getDocumentsByInvoiceId(invoiceId, uid);
  if (!docs.length) return { error: 'Aucune pièce jointe pour ce document.' };
  const decrypted = [];
  for (const doc of docs) {
    const blob = await decryptDocumentBlob(doc);
    decrypted.push({ id: doc.id, filename: doc.filename || 'document', blob });
  }
  const baseName = type === 'devis'
    ? `Devis-${numero || invoiceId}-pieces-jointes`
    : `Facture-${numero || invoiceId}-pieces-jointes`;
  const zipBlob = await buildAttachmentsZip(decrypted, baseName);
  downloadBlob(zipBlob, `${baseName}.zip`);
  return { success: true };
}

/**
 * Envoie un devis/facture par email avec PDF en pièce jointe.
 * @param {Object} document - devis ou facture
 * @param {'devis'|'facture'} docType
 * @param {Object} client - client avec email
 * @param {string|null} uid - id utilisateur (pour getSociete)
 * @returns {Promise<{ success: string } | { error: string }>}
 */
export async function sendForSignature(document, docType, client, uid) {
  const id = document?.id;
  if (!id) return { error: 'Document invalide.' };
  const email = client?.email;
  if (!email) return { error: 'Email du client manquant.' };
  const societe = await getSociete(uid);
  const numero = String(document?.entete?.numero ?? '').trim();
  const pdfFilename = (docType === 'devis' ? 'Devis' : 'Facture') + (numero ? `-${numero}` : '') + '.pdf';
  const htmlString = buildPdfDocumentHtml(document, client, societe, docType);
  const blob = await html2pdf()
    .set({
      margin: 4,
      filename: pdfFilename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .from(htmlString)
    .outputPdf('blob');
  const pdfBase64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result;
      const str = typeof dataUrl === 'string' ? dataUrl : '';
      res(str.includes(',') ? str.split(',')[1] : '');
    };
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const payload = {
    to: email,
    invoiceId: id,
    documentType: docType,
    numero,
    pdfBase64,
    pdfFilename
  };
  if (docType === 'facture') {
    const totalTTC = Number(document?.totalTTC) ?? Number(document?.total) ?? 0;
    const amountCents = Math.round(totalTTC * 100);
    if (amountCents < 50) {
      return { error: 'Le montant minimum pour paiement en ligne est de 0,50 €' };
    }
    payload.amountCents = amountCents;
    payload.currency = 'eur';
  }
  await apiClient.post('/api/documents/send-for-signature', payload);
  return { success: `Email envoyé à ${email} avec le PDF` };
}


/**
 * Charge devis, factures, clients, sync signatures, statut paiement, preuves.
 * @param {string|null} uid
 * @returns {Promise<{
 *   devis: any[],
 *   factures: any[],
 *   clientsMap: Record<string, object>,
 *   paymentStatusMap: Record<string, object>,
 *   backendProofs: any[],
 *   proofsPanelError: string,
 *   verifiedMap: Record<string, boolean>,
 *   error?: string
 * }>}
 */
export async function loadListeDocuments(uid) {
  const [devis, factures, clients] = await Promise.all([
    getAllDevis(uid),
    getAllFactures(uid),
    getAllClients(uid)
  ]);
  let devisList = devis ?? [];
  let facturesList = factures ?? [];
  const clientsMap = Object.fromEntries((clients || []).map((c) => [c.id, c]));

  // Sync « Accepté » depuis les signatures enregistrées côté serveur
  try {
    const res = await apiClient.get('/api/signatures');
    const signedIds = new Set(res.data?.signedInvoiceIds || []);
    for (const id of signedIds) {
      const d = devisList.find((doc) => doc.id === id);
      if (d && d.accepted !== true) await updateDevis({ ...d, accepted: true }, uid);
      const f = facturesList.find((doc) => doc.id === id);
      if (f) await updateFacture({ ...f, accepted: true }, uid);
    }
    if (signedIds.size > 0) {
      devisList = devisList.map((doc) => (signedIds.has(doc.id) ? { ...doc, accepted: true } : doc));
      facturesList = facturesList.map((doc) => (signedIds.has(doc.id) ? { ...doc, accepted: true } : doc));
      scheduleBackupUpload(uid);
    }
  } catch (_) {
    // ignore (non connecté ou route absente)
  }

  // Statut payé des factures
  let paymentStatusMap = {};
  try {
    const ids = facturesList.map((f) => f.id).filter(Boolean);
    if (ids.length > 0) {
      const res = await apiClient.get('/api/invoices/payment-status', { params: { ids: ids.join(',') } });
      if (res.data && typeof res.data === 'object') paymentStatusMap = res.data;
    }
  } catch (_) {}

  // Preuves backend
  let backendProofs = [];
  let proofsPanelError = '';
  try {
    backendProofs = await getProofs();
  } catch (e) {
    const status = e.response?.status;
    if (status === 401) proofsPanelError = 'Non connecté';
    else if (status === 404) proofsPanelError = 'Route introuvable (404). Démarrez le backend.';
    else proofsPanelError = e?.message || 'Erreur chargement preuves';
  }

  // Vérification intégrité (verifiedMap)
  let verifiedMap = {};
  try {
    const checks = [];
    for (const d of devisList) {
      const invoiceHash = await hashDocument(d, 'devis');
      checks.push({ invoiceId: d.id, invoiceHash });
    }
    for (const f of facturesList) {
      const invoiceHash = await hashDocument(f, 'facture');
      checks.push({ invoiceId: f.id, invoiceHash });
    }
    if (checks.length > 0) {
      const results = await verifyProofs(checks);
      for (const r of results) verifiedMap[r.invoiceId] = r.verified;
    }
  } catch (_) {}

  return {
    devis: devisList,
    factures: facturesList,
    clientsMap,
    paymentStatusMap,
    backendProofs,
    proofsPanelError,
    verifiedMap
  };
}

/**
 * Supprime les devis sélectionnés + preuves associées.
 * @param {string[]} ids
 * @param {string|null} uid
 * @returns {Promise<{ devis: any[], backendProofs: any[] } | { error: string }>}
 */
export async function deleteDevisSelection(ids, uid) {
  for (const id of ids) {
    await deleteDevis(id, uid);
    await deleteProof(id).catch(() => {});
  }
  scheduleBackupUpload(uid);
  await uploadBackupNow(uid);
  const [devis, backendProofs] = await Promise.all([
    getAllDevis(uid),
    getProofs()
  ]);
  return { devis, backendProofs };
}

/**
 * Supprime les factures sélectionnées + preuves associées.
 * @param {string[]} ids
 * @param {string|null} uid
 * @returns {Promise<{ factures: any[], backendProofs: any[] } | { error: string }>}
 */
export async function deleteFacturesSelection(ids, uid) {
  for (const id of ids) {
    await deleteFacture(id, uid);
    await deleteProof(id).catch(() => {});
  }
  scheduleBackupUpload(uid);
  await uploadBackupNow(uid);
  const [factures, backendProofs] = await Promise.all([
    getAllFactures(uid),
    getProofs()
  ]);
  return { factures, backendProofs };
}

/**
 * Supprime une preuve orpheline du serveur.
 * @param {string} invoiceId
 * @returns {Promise<{ backendProofs: any[] } | { error: string }>}
 */
export async function deleteProofFromServer(invoiceId) {
  if (!invoiceId) return { error: 'ID invalide.' };
  await deleteProof(invoiceId);
  const backendProofs = await getProofs();
  return { backendProofs };
}
