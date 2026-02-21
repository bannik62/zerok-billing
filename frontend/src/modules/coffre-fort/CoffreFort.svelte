<script>
  import { writable, get } from 'svelte/store';
  import {
    getAllDocuments,
    getAllClients,
    getAllDevis,
    getAllFactures,
    addDocument,
    deleteDocument,
    decryptDocumentBlob
  } from '$lib/dbEncrypted.js';
  import { sendDocumentProof, verifyDocumentProofs, getDocumentProofs } from '$lib/proofs.js';
  import { filterDocuments } from '$lib/coffreFortSearch.js';
  import { getDocTypeLabel, getCategoryLabel } from './constants.js';
  import UploadSection from './UploadSection.svelte';
  import DocumentTable from './DocumentTable.svelte';
  import DocumentPreviewModal from './DocumentPreviewModal.svelte';

  /** Orchestration du coffre-fort : données, recherche, upload, liste, aperçu. Pas de logique métier dans les sous-composants. */
  let { user = null } = $props();

  class CoffreFortSearchField {
    constructor() {
      this._searchStore = writable('');
    }

    // Aligné avec maxlength="200" de l'input de recherche.
    static SEARCH_MAX_LENGTH = 200;

    normalize(value) {
      let next = typeof value === 'string' ? value : '';
      next = next.replace(/[\u0000-\u001f\u007f]/g, '');
      if (next.length > CoffreFortSearchField.SEARCH_MAX_LENGTH) {
        next = next.slice(0, CoffreFortSearchField.SEARCH_MAX_LENGTH);
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
  let devisList = $state([]);
  let facturesList = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let uploading = $state(false);
  let uploadError = $state(null);
  let previewOpen = $state(false);
  let previewDoc = $state(null);
  let verifiedMap = $state({});
  let verifiedLoading = $state(false);
  let backendDocumentProofs = $state([]);
  let proofsPanelError = $state('');

  const clientsMap = $derived(Object.fromEntries((clients || []).map((c) => [c.id, c])));
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

  async function loadData() {
    if (!user) return;
    loading = true;
    error = null;
    try {
      const uid = user?.id ?? null;
      const [docs, cl, devis, factures] = await Promise.all([
        getAllDocuments(uid),
        getAllClients(uid),
        getAllDevis(uid),
        getAllFactures(uid)
      ]);
      documents = docs;
      clients = cl;
      devisList = devis;
      facturesList = factures;
      verifiedLoading = true;
      proofsPanelError = '';
      try {
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
      const { record, fileHash } = await addDocument({
        clientId: formData.clientId,
        linkedInvoiceId: formData.linkedInvoiceId,
        type: formData.type,
        filename: formData.file.name,
        file: formData.file,
        metadata: formData.metadata,
        userId: uid
      });
      try {
        await sendDocumentProof(record, fileHash);
      } catch (e) {
        await deleteDocument(record.id, uid);
        throw e;
      }
      await loadData();
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

  async function handleDownload(doc) {
    try {
      const blob = await decryptDocumentBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      error = e?.message || 'Impossible de télécharger';
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Supprimer « ${doc.filename} » du coffre-fort ?`)) return;
    try {
      await deleteDocument(doc.id, user?.id ?? null);
      await loadData();
    } catch (e) {
      error = e?.message || 'Erreur suppression';
    }
  }
</script>

<div class="coffre-fort">
  <h2 class="coffre-title">Coffre-fort</h2>
  <p class="coffre-desc">Documents chiffrés (justificatifs, contrats…). Seuls vous pouvez les déchiffrer.</p>

  {#if !user}
    <p class="coffre-msg coffre-msg--error">Session requise.</p>
  {:else if loading}
    <p class="coffre-msg">Chargement…</p>
  {:else if error}
    <p class="coffre-msg coffre-msg--error">{error}</p>
  {:else}
    <div class="coffre-layout">
      <aside class="coffre-proofs-panel" aria-label="Preuves documents — comparaison hash local / backend">
        <h3 class="coffre-proofs-title">Preuves documents (intégrité)</h3>
        <p class="coffre-proofs-hint">Hash enregistrés côté serveur. Comparaison avec le hash local (IndexedDB).</p>
        {#if proofsPanelError}
          <p class="coffre-proofs-error">{proofsPanelError}</p>
        {:else if backendDocumentProofs.length === 0}
          <p class="coffre-proofs-empty">Aucune preuve enregistrée.</p>
        {:else}
          <ul class="coffre-proofs-list">
            {#each backendDocumentProofs as p (p.documentId)}
              <li class="coffre-proof-item">
                <span class="coffre-proof-label" title={p.documentId}>{getDocumentProofLabel(p)}</span>
                <code class="coffre-proof-hash" title={p.fileHash}>{p.fileHash ? p.fileHash.slice(0, 12) + '…' : '—'}</code>
                {#if verifiedLoading && verifiedMap[p.documentId] === undefined}
                  <span class="coffre-proof-status coffre-proof-pending" title="Vérification…">—</span>
                {:else if verifiedMap[p.documentId] === true}
                  <span class="coffre-proof-status coffre-proof-ok" title="Hash local = hash backend">✓ conforme</span>
                {:else}
                  <span class="coffre-proof-status coffre-proof-diff" title="Hash local ≠ hash backend">✗ différent</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </aside>
      <div class="coffre-main">
    <UploadSection
      clients={clients}
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
        onPreview={openPreview}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </section>
      </div>
    </div>
  {/if}
</div>

<DocumentPreviewModal
  open={previewOpen}
  document={previewDoc}
  onClose={() => { previewOpen = false; previewDoc = null; }}
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
  .coffre-proofs-panel {
    flex: 0 0 280px;
    min-width: 240px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    background: #f8fafc;
  }
  .coffre-proofs-title {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #0f766e;
  }
  .coffre-proofs-hint {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0 0 0.75rem 0;
  }
  .coffre-proofs-error {
    color: #b91c1c;
    font-size: 0.85rem;
    margin: 0;
  }
  .coffre-proofs-empty {
    color: #64748b;
    font-size: 0.9rem;
    margin: 0;
  }
  .coffre-proofs-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .coffre-proof-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.8rem;
  }
  .coffre-proof-item:last-child {
    border-bottom: none;
  }
  .coffre-proof-label {
    flex: 0 0 100%;
    font-weight: 500;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .coffre-proof-hash {
    font-size: 0.75rem;
    background: #e2e8f0;
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    color: #475569;
  }
  .coffre-proof-status {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .coffre-proof-ok {
    color: #15803d;
  }
  .coffre-proof-diff {
    color: #b91c1c;
  }
  .coffre-proof-pending {
    color: #94a3b8;
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
    color: #0f766e;
    font-weight: 700;
  }
  .coffre-desc {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
  }
  .coffre-msg {
    margin: 0;
    color: #64748b;
  }
  .coffre-msg--error {
    color: #b91c1c;
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
    color: #475569;
  }
  .coffre-search-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .coffre-search-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #475569;
  }
  .coffre-search-input {
    padding: 0.4rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
    min-width: 12rem;
  }
</style>
