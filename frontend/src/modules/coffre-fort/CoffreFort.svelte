<script>
  import { writable, get } from 'svelte/store';
  import {
    getAllDocuments,
    getAllClients,
    getAllDevis,
    getAllFactures,
    getSociete,
    addDocument,
    deleteDocument,
    decryptDocumentBlob,
    verifyPassword
  } from '$lib/dbEncrypted.js';
  import { sendDocumentProof, verifyDocumentProofs, getDocumentProofs, deleteDocumentProof, cleanupDocumentProofs } from '$lib/proofs.js';
  import { scheduleBackupUpload, uploadBackupNow } from '$lib/backupSync.js';
  import { filterDocuments } from '$lib/coffreFortSearch.js';
  import { getDocTypeLabel, getCategoryLabel, MAX_FILE_SIZE_MB } from './constants.js';
  import UploadSection from './UploadSection.svelte';
  import DocumentTable from './DocumentTable.svelte';
  import DocumentPreviewModal from './DocumentPreviewModal.svelte';
  import PasswordConfirmModal from '$lib/PasswordConfirmModal.svelte';
  import ProofsPanel from '$lib/ProofsPanel.svelte';

  /** Orchestration du coffre-fort : données, recherche, upload, liste, aperçu. Pas de logique métier dans les sous-composants. */
  let { user = null } = $props();

  const SEARCH_MAX_LENGTH = 200;

  class CoffreFortSearchField {
    constructor() {
      this._searchStore = writable('');
    }

    normalize(value) {
      let next = typeof value === 'string' ? value : '';
      next = next.replace(/[\u0000-\u001f\u007f]/g, '');
      if (next.length > SEARCH_MAX_LENGTH) {
        next = next.slice(0, SEARCH_MAX_LENGTH);
      }
      return next;
    }

    get store() {
      return this._searchStore;
    }

    get searchQuery() {
      return get(this._searchStore);
    }

    set searchQuery(value) {
      this._searchStore.set(this.normalize(value));
    }
  }

  const searchField = new CoffreFortSearchField();
  const searchStore = searchField.store;

  let documents = $state([]);
  let clients = $state([]);
  let societe = $state(null);
  let devisList = $state([]);
  let facturesList = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let uploading = $state(false);
  let uploadError = $state(null);
  let previewOpen = $state(false);
  let previewDoc = $state(null);
  let passwordModalOpen = $state(false);
  let pendingPreview = $state(null);  // doc
  let pendingDownload = $state(null); // doc
  let verifiedMap = $state({});
  let verifiedLoading = $state(false);
  let backendDocumentProofs = $state([]);
  let proofsPanelError = $state('');

  const clientsMap = $derived.by(() => {
    const map = Object.fromEntries((clients || []).map((c) => [c.id, c]));
    const uid = user?.id;
    if (uid != null && societe) {
      map[`societe-${uid}`] = { raisonSociale: (societe.nom || '').trim() || 'Mon entreprise' };
    }
    return map;
  });
  const companyOption = $derived.by(() => {
    const uid = user?.id;
    if (uid == null || !societe) return null;
    return { id: `societe-${uid}`, label: (societe.nom || '').trim() || 'Mon entreprise' };
  });
  const invoiceOptions = $derived.by(() => {
    const out = [];
    for (const d of devisList) {
      out.push({ id: d.id, label: `Devis ${d.entete?.numero || d.id}`, type: 'devis' });
    }
    for (const f of facturesList) {
      out.push({ id: f.id, label: `Facture ${f.entete?.numero || f.id}`, type: 'facture' });
    }
    return out;
  });
  const filteredDocuments = $derived.by(() =>
    filterDocuments(documents, $searchStore, clientsMap, getDocTypeLabel, getCategoryLabel)
  );

  function clientDisplayName(client) {
    if (!client) return '—';
    return client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' ') || '—';
  }

  function formatSize(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  /** Libellé lisible pour une preuve document (fichier — client ou filename). */
  function getDocumentProofLabel(p) {
    const doc = documents.find((d) => d.id === p.documentId);
    if (doc) return `${doc.filename} — ${clientDisplayName(clientsMap[doc.clientId])}`;
    return p.filename || (p.documentId.length > 20 ? p.documentId.slice(0, 18) + '…' : p.documentId);
  }

  /** Items pour l’encart Preuves : id, hash, label (documents coffre-fort). */
  const proofItems = $derived.by(() => {
    const docIds = new Set(documents.map((d) => d.id));
    return backendDocumentProofs.map((p) => ({
      id: p.documentId,
      hash: p.fileHash || '',
      label: getDocumentProofLabel(p),
      isOrphan: !docIds.has(p.documentId)
    }));
  });

  let deletingProofId = $state(null);

  async function handleDeleteProofFromServer(documentId) {
    if (!documentId) return;
    deletingProofId = documentId;
    try {
      await deleteDocumentProof(documentId);
      backendDocumentProofs = await getDocumentProofs();
      verifiedMap = await verifyDocumentProofs(documents);
    } catch (e) {
      error = e?.message || 'Erreur suppression preuve sur le serveur.';
    } finally {
      deletingProofId = null;
    }
  }

  async function loadData() {
    if (!user) return;
    loading = true;
    error = null;
    try {
      const uid = user?.id ?? null;
      const [docs, cl, soc, devis, factures] = await Promise.all([
        getAllDocuments(uid),
        getAllClients(uid),
        getSociete(uid),
        getAllDevis(uid),
        getAllFactures(uid)
      ]);
      documents = docs;
      clients = cl;
      societe = soc;
      devisList = devis;
      facturesList = factures;
      verifiedLoading = true;
      proofsPanelError = '';
      try {
        if (docs.length > 0) {
          await cleanupDocumentProofs(docs.map((d) => d.id));
        }
        backendDocumentProofs = await getDocumentProofs();
        verifiedMap = await verifyDocumentProofs(docs);
      } catch (e) {
        verifiedMap = {};
        backendDocumentProofs = [];
        const status = e.response?.status;
        if (status === 401) proofsPanelError = 'Non connecté';
        else if (status === 404) proofsPanelError = 'Route introuvable (404). Démarrez le backend.';
        else proofsPanelError = e?.message || 'Erreur chargement preuves';
      } finally {
        verifiedLoading = false;
      }
    } catch (e) {
      error = e?.message || 'Erreur chargement';
      documents = [];
      clients = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (user) loadData();
  });

  async function handleUpload(formData) {
    uploading = true;
    uploadError = null;
    try {
      const uid = user?.id ?? null;
      const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
      if (formData?.file?.size > maxBytes) {
        throw new Error(`Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo)`);
      }
      const { record, fileHash } = await addDocument({
        clientId: formData.clientId,
        linkedInvoiceId: formData.linkedInvoiceId,
        type: formData.type,
        filename: formData.file.name,
        file: formData.file,
        metadata: formData.metadata,
        userId: uid
      });
      // Preuve envoyée uniquement après addDocument réussi (évite hash orphelin si taille / erreur avant persistance).
      try {
        await sendDocumentProof(record, fileHash);
      } catch (e) {
        await deleteDocument(record.id, uid);
        throw e;
      }
      await loadData();
      scheduleBackupUpload(uid);
      await uploadBackupNow(uid);
    } catch (e) {
      uploadError = e?.message || 'Erreur lors de l’ajout du document';
    } finally {
      uploading = false;
    }
  }

  function openPreview(doc) {
    previewDoc = doc;
    previewOpen = true;
  }

  function requestPreview(doc) {
    pendingPreview = doc;
    pendingDownload = null;
    passwordModalOpen = true;
  }

  function requestDownload(doc) {
    pendingDownload = doc;
    pendingPreview = null;
    passwordModalOpen = true;
  }

  async function onPasswordConfirm(pwd) {
    const uid = user?.id ?? null;
    const ok = await verifyPassword(pwd, uid);
    if (!ok) return false;
    if (pendingPreview) {
      openPreview(pendingPreview);
    }
    if (pendingDownload) {
      await doDownload(pendingDownload);
    }
    return true;
  }

  async function doDownload(doc) {
    try {
      const blob = await decryptDocumentBlob(doc);
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename || 'document';
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      error = e?.message || 'Impossible de télécharger';
    }
  }

  async function handleDownload(doc) {
    requestDownload(doc);
  }

  async function handleDelete(doc) {
    if (!confirm(`Supprimer « ${doc.filename} » du coffre-fort ?`)) return;
    try {
      const uid = user?.id ?? null;
      await deleteDocument(doc.id, uid);
      try {
        await deleteDocumentProof(doc.id);
      } catch (_) {
        error = 'Document supprimé localement ; la preuve n\'a pas pu être retirée du serveur.';
      }
      await loadData();
      scheduleBackupUpload(uid);
      await uploadBackupNow(uid);
    } catch (e) {
      error = e?.message || 'Erreur suppression';
    }
  }
</script>

<div class="coffre-fort">
  <h2 class="coffre-title">Coffre fort</h2>
  <p class="coffre-desc">Documents chiffrés (justificatifs, contrats…). Seuls vous pouvez les déchiffrer.</p>

  {#if !user}
    <p class="coffre-msg coffre-msg--error">Session requise.</p>
  {:else if loading}
    <p class="coffre-msg">Chargement…</p>
  {:else if error}
    <p class="coffre-msg coffre-msg--error">{error}</p>
  {:else}
    <div class="coffre-layout">
      <div class="coffre-main">
    <UploadSection
      clients={clients}
      companyOption={companyOption}
      invoiceOptions={invoiceOptions}
      uploading={uploading}
      uploadError={uploadError}
      clientDisplayName={clientDisplayName}
      onUpload={handleUpload}
      onClearError={() => { uploadError = null; }}
    />

    <section class="coffre-list" aria-label="Documents perso">
      <div class="coffre-list-head">
        <h3 class="coffre-section-title">Documents perso ({filteredDocuments.length})</h3>
        <div class="coffre-search-wrap">
          <label for="coffre-search" class="coffre-search-label">Rechercher</label>
          <input
            id="coffre-search"
            type="search"
            class="coffre-search-input"
            placeholder="Fichier, client, description, montant…"
            value={$searchStore}
            oninput={(e) => (searchField.searchQuery = e.currentTarget.value)}
            maxlength="200"
            aria-label="Filtrer les documents"
          />
        </div>
      </div>
      <DocumentTable
        documents={filteredDocuments}
        clientsMap={clientsMap}
        invoiceOptions={invoiceOptions}
        clientDisplayName={clientDisplayName}
        formatSize={formatSize}
        verifiedMap={verifiedMap}
        verifiedLoading={verifiedLoading}
        onPreview={requestPreview}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </section>
      </div>
      <ProofsPanel
        title="Preuves documents (intégrité)"
        error={proofsPanelError}
        items={proofItems}
        verifiedMap={verifiedMap}
        verifiedLoading={verifiedLoading}
        ariaLabel="Preuves documents — comparaison hash local / backend"
        onDeleteFromServer={handleDeleteProofFromServer}
        deletingProofId={deletingProofId}
      />
    </div>
  {/if}
</div>

<DocumentPreviewModal
  open={previewOpen}
  document={previewDoc}
  onClose={() => { previewOpen = false; previewDoc = null; }}
/>
<PasswordConfirmModal
  open={passwordModalOpen}
  title="Mot de passe requis"
  message="Entrez votre mot de passe pour continuer."
  submitLabel="Confirmer"
  onConfirm={onPasswordConfirm}
  onCancel={() => { passwordModalOpen = false; pendingPreview = null; pendingDownload = null; }}
/>

<style>
  .coffre-fort {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .coffre-layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .coffre-main {
    flex: 1;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .coffre-title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-primary);
    font-weight: 700;
  }
  .coffre-desc {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  .coffre-msg {
    margin: 0;
    color: var(--color-text-muted);
  }
  .coffre-msg--error {
    color: var(--color-error);
    font-weight: 500;
  }
  .coffre-list-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .coffre-section-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-soft);
  }
  .coffre-search-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .coffre-search-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-soft);
  }
  .coffre-search-input {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 0.9rem;
    min-width: 12rem;
    background: var(--color-bg-elevated);
    color: var(--color-text);
  }
</style>
