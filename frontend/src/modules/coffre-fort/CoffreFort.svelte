<script>
  import {
    getAllDocuments,
    getAllClients,
    getAllDevis,
    getAllFactures,
    addDocument,
    deleteDocument,
    decryptDocumentBlob
  } from '$lib/dbEncrypted.js';
  import { sendDocumentProof, verifyDocumentProofs } from '$lib/proofs.js';
  import { filterDocuments } from '$lib/coffreFortSearch.js';
  import { getDocTypeLabel, getCategoryLabel } from './constants.js';
  import UploadSection from './UploadSection.svelte';
  import DocumentTable from './DocumentTable.svelte';
  import DocumentPreviewModal from './DocumentPreviewModal.svelte';

  /** Orchestration du coffre-fort : données, recherche, upload, liste, aperçu. Pas de logique métier dans les sous-composants. */
  let { user = null } = $props();

  let documents = $state([]);
  let clients = $state([]);
  let devisList = $state([]);
  let facturesList = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let uploading = $state(false);
  let uploadError = $state(null);
  let searchQuery = $state('');
  let previewOpen = $state(false);
  let previewDoc = $state(null);
  let verifiedMap = $state({});
  let verifiedLoading = $state(false);

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
    filterDocuments(documents, searchQuery, clientsMap, getDocTypeLabel, getCategoryLabel)
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

  async function loadData() {
    if (!user) return;
    loading = true;
    error = null;
    try {
      const uid = user?.id ?? null;
      const [docs, cl, devis, factures] = await Promise.all([
        getAllDocuments(),
        getAllClients(uid),
        getAllDevis(uid),
        getAllFactures(uid)
      ]);
      documents = docs;
      clients = cl;
      devisList = devis;
      facturesList = factures;
      verifiedLoading = true;
      try {
        verifiedMap = await verifyDocumentProofs(docs);
      } catch (_) {
        verifiedMap = {};
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
      const { record, fileHash } = await addDocument({
        clientId: formData.clientId,
        linkedInvoiceId: formData.linkedInvoiceId,
        type: formData.type,
        filename: formData.file.name,
        file: formData.file,
        metadata: formData.metadata
      });
      try {
        await sendDocumentProof(record, fileHash);
      } catch (e) {
        await deleteDocument(record.id);
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
      await deleteDocument(doc.id);
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
            bind:value={searchQuery}
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
