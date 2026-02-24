<script>
  import { onMount } from 'svelte';
  import { ListeDocumentsControlsFields, LISTE_DOCS_SEARCH_MAX_LENGTH } from '$lib/liste-documents/ListeDocumentsControlsFields.js';
  import { clientDisplayName, getProofLabel } from '$lib/liste-documents/listeDocumentsHelpers.js';
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
    decryptDocumentBlob,
    verifyPassword
  } from '$lib/dbEncrypted.js';
  import { hashDocument } from '$lib/crypto/index.js';
  import { getProofs, verifyProofs, deleteProof } from '$lib/proofs.js';
  import { buildAttachmentsZip, downloadBlob } from '$lib/coffreFortExport.js';
  import PrintPreviewModal from './PrintPreviewModal.svelte';
  import PasswordConfirmModal from '$lib/PasswordConfirmModal.svelte';
  import ListeDocumentsSearch from './ListeDocumentsSearch.svelte';
  import DevisTable from './DevisTable.svelte';
  import FacturesTable from './FacturesTable.svelte';
  import ProofsPanel from '$lib/ProofsPanel.svelte';
  import SheetA4 from '../editor/SheetA4.svelte';
  import { apiClient } from '$lib/apiClient.js';
  import { tick } from 'svelte';
  import html2pdf from 'html2pdf.js';

  const controlsFields = new ListeDocumentsControlsFields();
  const searchStore = controlsFields.searchStore;
  const selectedDevisIdsStore = controlsFields.selectedDevisIdsStore;
  const selectedFactureIdsStore = controlsFields.selectedFactureIdsStore;

  let { user = null, onOpenFactureFromDevis = () => {} } = $props();
  let mounted = $state(true);
  onMount(() => {
    mounted = true;
    return () => { mounted = false; };
  });

  let printPreviewOpen = $state(false);
  let printDocumentId = $state(null);
  let printDocumentType = $state('devis');

  /** Pending action après vérification du mot de passe : 'print' | 'zip' + args. */
  let passwordModalOpen = $state(false);
  let pendingPrint = $state(null); // { id, type }
  let pendingZip = $state(null);   // { invoiceId, type, numero }

  function openPrintPreview(id, type) {
    printDocumentId = id;
    printDocumentType = type;
    printPreviewOpen = true;
  }
  function closePrintPreview() {
    printPreviewOpen = false;
    printDocumentId = null;
  }

  function requestPrintPreview(id, type) {
    pendingPrint = { id, type };
    pendingZip = null;
    passwordModalOpen = true;
  }

  function requestExportZip(invoiceId, type, numero) {
    pendingZip = { invoiceId, type, numero };
    pendingPrint = null;
    passwordModalOpen = true;
  }

  async function onPasswordConfirm(pwd) {
    const uid = user?.id ?? null;
    const ok = await verifyPassword(pwd, uid);
    if (!ok) return false;
    if (pendingPrint) {
      openPrintPreview(pendingPrint.id, pendingPrint.type);
    }
    if (pendingZip) {
      await doExportPiecesJointesZip(pendingZip.invoiceId, pendingZip.type, pendingZip.numero);
    }
    return true;
  }

  /** Exporte les pièces jointes du coffre-fort liées à un devis/facture en ZIP. */
  async function doExportPiecesJointesZip(invoiceId, type, numero) {
    if (!invoiceId) return;
    zipExportingId = invoiceId;
    try {
      const docs = await getDocumentsByInvoiceId(invoiceId, user?.id ?? null);
      if (!docs.length) {
        alert('Aucune pièce jointe pour ce document.');
        return;
      }
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
    } catch (e) {
      error = e?.message || 'Erreur lors de l’export ZIP.';
    } finally {
      zipExportingId = null;
    }
  }

  /** Demande le mot de passe puis exporte ZIP (point d'entrée depuis la table). */
  async function exportPiecesJointesZip(invoiceId, type, numero) {
    if (!invoiceId) return;
    requestExportZip(invoiceId, type, numero);
  }

  /** Envoi du document au client pour signature (email + PDF en pièce jointe). */
  let sendingForSignatureId = $state(null);
  let sendSignatureFeedback = $state(null); // { type: 'success'|'error', text }
  let pdfGenState = $state(null);
  let pdfGenContainer = $state(null);

  async function handleSendForSignature(document, docType) {
    const id = document?.id;
    if (!id) return;
    const client = document?.entete?.clientId ? clientsMap[document.entete.clientId] : null;
    const email = client?.email;
    if (!email) return;
    const numero = String(document?.entete?.numero ?? '').trim();
    sendingForSignatureId = id;
    sendSignatureFeedback = null;
    try {
      const uid = user?.id ?? null;
      const societe = await getSociete(uid);
      pdfGenState = { document, client, societe, type: docType };
      await tick();
      await new Promise((r) => setTimeout(r, 700));
      const container = pdfGenContainer;
      let pdfBase64 = null;
      const pdfFilename = (docType === 'devis' ? 'Devis' : 'Facture') + (numero ? `-${numero}` : '') + '.pdf';
      if (container) {
        try {
          const blob = await html2pdf()
            .set({
              margin: 4,
              filename: pdfFilename,
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(container)
            .outputPdf('blob');
          pdfBase64 = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => {
              const dataUrl = r.result;
              const str = typeof dataUrl === 'string' ? dataUrl : '';
              res(str.includes(',') ? str.split(',')[1] : '');
            };
            r.onerror = rej;
            r.readAsDataURL(blob);
          });
        } finally {
          pdfGenState = null;
        }
      } else {
        pdfGenState = null;
      }
      await apiClient.post('/api/documents/send-for-signature', {
        to: email,
        invoiceId: id,
        documentType: docType,
        numero,
        ...(pdfBase64 && { pdfBase64, pdfFilename })
      });
      sendSignatureFeedback = { type: 'success', text: pdfBase64 ? `Email envoyé à ${email} avec le PDF` : `Email envoyé à ${email}` };
      setTimeout(() => { sendSignatureFeedback = null; }, 4000);
    } catch (e) {
      const msg = e.response?.data?.error ?? e?.message ?? 'Erreur lors de l’envoi';
      sendSignatureFeedback = { type: 'error', text: msg };
    } finally {
      sendingForSignatureId = null;
      pdfGenState = null;
    }
  }

  let devisList = $state([]);
  let facturesList = $state([]);
  let clientsMap = $state({});
  let loading = $state(true);
  let error = $state(null);
  let verifiedMap = $state({});
  let verifiedLoading = $state(false);
  /** Preuves backend (pour l'encart gauche). */
  let backendProofs = $state([]);
  let proofsPanelError = $state('');
  let deletingDevis = $state(false);
  let deleting = $state(false);
  let zipExportingId = $state(null); // id du devis/facture en cours d'export ZIP

  const filteredDevisList = $derived.by(() => {
    const q = ($searchStore || '').trim().toLowerCase();
    if (!q) return devisList;
    return devisList.filter((d) => {
      const clientName = clientDisplayName(clientsMap[d.entete?.clientId]).toLowerCase();
      const numero = (d.entete?.numero || '').toLowerCase();
      const objet = (d.entete?.objet || '').toLowerCase();
      const dateEmission = (d.entete?.dateEmission || '').toLowerCase();
      const totalStr = (typeof d.total === 'number' ? d.total.toFixed(2) : String(d.total ?? '')).toLowerCase();
      const createdAt = (d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : '').toLowerCase();
      return [clientName, numero, objet, dateEmission, totalStr, createdAt].some((s) => s.includes(q));
    });
  });

  const filteredFacturesList = $derived.by(() => {
    const q = ($searchStore || '').trim().toLowerCase();
    if (!q) return facturesList;
    return facturesList.filter((f) => {
      const clientName = clientDisplayName(clientsMap[f.entete?.clientId]).toLowerCase();
      const numero = (f.entete?.numero || '').toLowerCase();
      const objet = (f.entete?.objet || '').toLowerCase();
      const dateEmission = (f.entete?.dateEmission || '').toLowerCase();
      const delai = (f.entete?.delaiPaiement || '').toLowerCase();
      const totalStr = (typeof f.total === 'number' ? f.total.toFixed(2) : String(f.total ?? '')).toLowerCase();
      const createdAt = (f.createdAt ? new Date(f.createdAt).toLocaleDateString('fr-FR') : '').toLowerCase();
      return [clientName, numero, objet, dateEmission, delai, totalStr, createdAt].some((s) => s.includes(q));
    });
  });

  const allDevisSelected = $derived(
    filteredDevisList.length > 0 && $selectedDevisIdsStore.size === filteredDevisList.length
  );
  const someDevisSelected = $derived($selectedDevisIdsStore.size > 0);
  const allFacturesSelected = $derived(
    filteredFacturesList.length > 0 && $selectedFactureIdsStore.size === filteredFacturesList.length
  );
  const someFacturesSelected = $derived($selectedFactureIdsStore.size > 0);

  /** Pour chaque devis, la facture créée à partir de ce devis (devisId), s'il y en a une. */
  const factureByDevisId = $derived.by(() => {
    const map = {};
    for (const f of facturesList) {
      if (f.devisId && !map[f.devisId]) map[f.devisId] = f;
    }
    return map;
  });

  /** Items pour l’encart Preuves : id, hash, label, isOrphan, documentType ('devis' | 'facture' | 'orphan'). */
  const proofItems = $derived.by(() => {
    const devisIds = new Set(devisList.map((d) => d.id));
    const factureIds = new Set(facturesList.map((f) => f.id));
    return backendProofs.map((p) => {
      const isDevis = devisIds.has(p.invoiceId);
      const isFacture = factureIds.has(p.invoiceId);
      const documentType = isDevis ? 'devis' : isFacture ? 'facture' : 'orphan';
      return {
        id: p.invoiceId,
        hash: p.invoiceHash || '',
        label: getProofLabel(p.invoiceId, devisList, facturesList, clientsMap),
        isOrphan: !isDevis && !isFacture,
        documentType
      };
    });
  });

  let deletingProofId = $state(null);

  function toggleDevis(id) {
    controlsFields.toggleDevisSelection(id);
  }
  function toggleAllDevis() {
    if (allDevisSelected) controlsFields.selectAllDevis([]);
    else controlsFields.selectAllDevis(filteredDevisList.map((d) => d.id));
  }
  async function supprimerDevisSelection() {
    if (!someDevisSelected) return;
    const n = $selectedDevisIdsStore.size;
    const msg = n === 1 ? 'Supprimer ce devis ?' : `Supprimer les ${n} devis sélectionnés ?`;
    if (!confirm(msg)) return;
    deletingDevis = true;
    try {
      for (const id of $selectedDevisIdsStore) {
        await deleteDevis(id, user?.id ?? null);
        await deleteProof(id).catch(() => {});
      }
      controlsFields.selectedDevisIds = new Set();
      devisList = await getAllDevis(user?.id ?? null);
      backendProofs = await getProofs();
    } catch (e) {
      error = e?.message || 'Erreur lors de la suppression.';
    } finally {
      deletingDevis = false;
    }
  }

  function toggleFacture(id) {
    controlsFields.toggleFactureSelection(id);
  }

  function toggleAllFactures() {
    if (allFacturesSelected) controlsFields.selectAllFactures([]);
    else controlsFields.selectAllFactures(filteredFacturesList.map((f) => f.id));
  }

  async function supprimerFacturesSelection() {
    if (!someFacturesSelected) return;
    const n = $selectedFactureIdsStore.size;
    const msg =
      n === 1
        ? 'Supprimer cette facture ?'
        : `Supprimer les ${n} factures sélectionnées ?`;
    if (!confirm(msg)) return;
    deleting = true;
    try {
      for (const id of $selectedFactureIdsStore) {
        await deleteFacture(id, user?.id ?? null);
        await deleteProof(id).catch(() => {});
      }
      controlsFields.selectedFactureIds = new Set();
      facturesList = await getAllFactures(user?.id ?? null);
      backendProofs = await getProofs();
    } catch (e) {
      error = e?.message || 'Erreur lors de la suppression.';
    } finally {
      deleting = false;
    }
  }

  /** Filet de secours : supprime du serveur une preuve orpheline (document plus présent en local). */
  async function handleDeleteProofFromServer(invoiceId) {
    if (!invoiceId) return;
    deletingProofId = invoiceId;
    try {
      await deleteProof(invoiceId);
      backendProofs = await getProofs();
    } catch (e) {
      error = e?.message || 'Erreur suppression preuve sur le serveur.';
    } finally {
      deletingProofId = null;
    }
  }

  async function loadLists() {
    if (!user) return;
    const uid = user?.id ?? null;
    loading = true;
    error = null;
    verifiedMap = {};
    try {
      const [devis, factures, clients] = await Promise.all([
        getAllDevis(uid),
        getAllFactures(uid),
        getAllClients(uid)
      ]);
      if (!mounted) return;
      devisList = devis;
      facturesList = factures;
      clientsMap = Object.fromEntries((clients || []).map((c) => [c.id, c]));
      controlsFields.clearSelections();

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
        if (signedIds.size > 0 && mounted) {
          devisList = devisList.map((doc) => (signedIds.has(doc.id) ? { ...doc, accepted: true } : doc));
          facturesList = facturesList.map((doc) => (signedIds.has(doc.id) ? { ...doc, accepted: true } : doc));
        }
      } catch (_) {
        // ignore (non connecté ou route absente)
      }

      verifiedLoading = true;
      proofsPanelError = '';
      try {
        backendProofs = await getProofs();
      } catch (e) {
        backendProofs = [];
        const status = e.response?.status;
        if (status === 401) proofsPanelError = 'Non connecté';
        else if (status === 404) proofsPanelError = 'Route introuvable (404). Démarrez le backend.';
        else proofsPanelError = e?.message || 'Erreur chargement preuves';
      }
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
        if (checks.length > 0 && mounted) {
          const results = await verifyProofs(checks);
          if (!mounted) return;
          const next = {};
          for (const r of results) next[r.invoiceId] = r.verified;
          verifiedMap = next;
        }
      } catch (_) {
        if (mounted) verifiedMap = {};
      } finally {
        if (mounted) verifiedLoading = false;
      }
    } catch (e) {
      if (!mounted) return;
      error = e?.message || 'Erreur lors du chargement des listes.';
      devisList = [];
      facturesList = [];
    } finally {
      if (mounted) loading = false;
    }
  }

  $effect(() => {
    if (user) loadLists();
  });
</script>

<div class="liste-documents">
  <h2 class="liste-documents-title">Liste documents</h2>

  {#if !user}
    <p class="liste-documents-msg liste-documents-msg--error">
      Session non validée. Veuillez vous reconnecter.
    </p>
  {:else if loading}
    <p class="liste-documents-msg">Chargement des listes…</p>
  {:else if error}
    <p class="liste-documents-msg liste-documents-msg--error">{error}</p>
    <p class="liste-documents-hint">Si l’erreur concerne la base de données, essayez de rafraîchir la page.</p>
  {:else}
    {#if sendSignatureFeedback}
      <p class="liste-documents-msg liste-documents-msg--{sendSignatureFeedback.type}">
        {sendSignatureFeedback.text}
      </p>
    {/if}
    <div class="liste-layout">
      <div class="liste-main">
    <ListeDocumentsSearch {controlsFields} maxLength={LISTE_DOCS_SEARCH_MAX_LENGTH} />
    <DevisTable
      list={filteredDevisList}
      {clientsMap}
      factureByDevisId={factureByDevisId}
      {verifiedMap}
      {verifiedLoading}
      selectedDevisIdsStore={selectedDevisIdsStore}
      searchQuery={$searchStore}
      {zipExportingId}
      sendingForSignatureId={sendingForSignatureId}
      {deletingDevis}
      {allDevisSelected}
      {someDevisSelected}
      onToggle={toggleDevis}
      onToggleAll={toggleAllDevis}
      onDeleteSelection={supprimerDevisSelection}
      onOpenFactureFromDevis={onOpenFactureFromDevis}
      onExportPdf={requestPrintPreview}
      onExportZip={exportPiecesJointesZip}
      onSendForSignature={(d) => handleSendForSignature(d, 'devis')}
    />
    <FacturesTable
      list={filteredFacturesList}
      {clientsMap}
      {verifiedMap}
      {verifiedLoading}
      selectedFactureIdsStore={selectedFactureIdsStore}
      searchQuery={$searchStore}
      {zipExportingId}
      sendingForSignatureId={sendingForSignatureId}
      deleting={deleting}
      {allFacturesSelected}
      {someFacturesSelected}
      onToggle={toggleFacture}
      onToggleAll={toggleAllFactures}
      onDeleteSelection={supprimerFacturesSelection}
      onExportPdf={requestPrintPreview}
      onExportZip={exportPiecesJointesZip}
      onSendForSignature={(f) => handleSendForSignature(f, 'facture')}
    />
      </div>
      <ProofsPanel
        title="Preuves (intégrité)"
        error={proofsPanelError}
        items={proofItems}
        verifiedMap={verifiedMap}
        verifiedLoading={verifiedLoading}
        onDeleteFromServer={handleDeleteProofFromServer}
        deletingProofId={deletingProofId}
      />
    </div>
  {/if}

  <PrintPreviewModal
    open={printPreviewOpen}
    documentId={printDocumentId}
    documentType={printDocumentType}
    userId={user?.id ?? null}
    onClose={closePrintPreview}
  />
  <PasswordConfirmModal
    open={passwordModalOpen}
    title="Mot de passe requis"
    message="Entrez votre mot de passe pour continuer."
    submitLabel="Confirmer"
    onConfirm={onPasswordConfirm}
    onCancel={() => { passwordModalOpen = false; pendingPrint = null; pendingZip = null; }}
  />

  {#if pdfGenState}
    <div class="pdf-gen-hidden" bind:this={pdfGenContainer}>
      <SheetA4
        blockPositions={pdfGenState.document?.blockPositions ?? {}}
        document={pdfGenState.document}
        documentType={pdfGenState.type}
        resolvedClient={pdfGenState.client}
        resolvedSociete={pdfGenState.societe}
        selectedBlock={null}
        onDrop={() => {}}
        onOver={() => {}}
        onCanvasMouseDown={() => {}}
        onMouseMove={() => {}}
        onMouseUp={() => {}}
        onPlacedBlockMouseDown={() => {}}
        onResizeMouseDown={() => {}}
        onUpdateBlockStyle={() => {}}
        onCloseToolbar={() => {}}
      />
    </div>
  {/if}
</div>

<style>
  .liste-documents {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-height: 0;
  }
  .liste-layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .liste-main {
    flex: 1;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .liste-documents-title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-primary);
    font-weight: 700;
  }
  .liste-documents-msg {
    margin: 0;
    color: var(--color-text-muted);
  }
  .liste-documents-msg--error {
    color: var(--color-error);
    font-weight: 500;
  }
  .liste-documents-msg--success {
    color: var(--color-primary);
  }
  .liste-documents-hint {
    margin: 0.25rem 0 0 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  /* Conteneur dans le viewport pour que le navigateur peigne le contenu (html2canvas capture sinon une page blanche). Invisible et non cliquable. */
  .pdf-gen-hidden {
    position: fixed;
    left: 0;
    top: 0;
    width: 595px;
    height: 842px;
    background: #fff;
    opacity: 0;
    pointer-events: none;
    z-index: 9998;
    overflow: hidden;
  }
</style>
