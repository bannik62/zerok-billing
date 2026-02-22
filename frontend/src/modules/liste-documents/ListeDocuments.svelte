<script>
  import { onMount } from 'svelte';
  import { ListeDocumentsControlsFields, LISTE_DOCS_SEARCH_MAX_LENGTH } from '$lib/liste-documents/ListeDocumentsControlsFields.js';
  import { clientDisplayName, getProofLabel } from '$lib/liste-documents/listeDocumentsHelpers.js';
  import {
    getAllDevis,
    getAllFactures,
    getAllClients,
    deleteDevis,
    deleteFacture,
    getDocumentsByInvoiceId,
    decryptDocumentBlob
  } from '$lib/dbEncrypted.js';
  import { hashDocument } from '$lib/crypto/index.js';
  import { getProofs, verifyProofs, deleteProof } from '$lib/proofs.js';
  import { buildAttachmentsZip, downloadBlob } from '$lib/coffreFortExport.js';
  import PrintPreviewModal from './PrintPreviewModal.svelte';
  import ListeDocumentsSearch from './ListeDocumentsSearch.svelte';
  import ProofsPanel from '$lib/ProofsPanel.svelte';

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

  function openPrintPreview(id, type) {
    printDocumentId = id;
    printDocumentType = type;
    printPreviewOpen = true;
  }
  function closePrintPreview() {
    printPreviewOpen = false;
    printDocumentId = null;
  }

  /** Exporte les pièces jointes du coffre-fort liées à un devis/facture en ZIP. */
  async function exportPiecesJointesZip(invoiceId, type, numero) {
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

  /** Items pour l’encart Preuves : id, hash, label, isOrphan (document plus présent en local). */
  const proofItems = $derived.by(() => {
    const devisIds = new Set(devisList.map((d) => d.id));
    const factureIds = new Set(facturesList.map((f) => f.id));
    return backendProofs.map((p) => ({
      id: p.invoiceId,
      hash: p.invoiceHash || '',
      label: getProofLabel(p.invoiceId, devisList, facturesList, clientsMap),
      isOrphan: !devisIds.has(p.invoiceId) && !factureIds.has(p.invoiceId)
    }));
  });

  let deletingProofId = $state(null);

  let selectAllDevisCheckboxEl = $state(null);
  let selectAllCheckboxEl = $state(null);
  $effect(() => {
    if (selectAllDevisCheckboxEl) selectAllDevisCheckboxEl.indeterminate = someDevisSelected && !allDevisSelected;
  });
  $effect(() => {
    if (!selectAllCheckboxEl) return;
    selectAllCheckboxEl.indeterminate = someFacturesSelected && !allFacturesSelected;
  });

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
        await deleteDevis(id);
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
        await deleteFacture(id);
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
    <div class="liste-layout">
      <div class="liste-main">
    <ListeDocumentsSearch {controlsFields} maxLength={LISTE_DOCS_SEARCH_MAX_LENGTH} />
    <section class="liste-section" aria-label="Liste des devis">
      <div class="liste-section-head">
        <h3 class="liste-section-title">Devis</h3>
        <button
          type="button"
          class="btn-delete"
          disabled={!someDevisSelected || deletingDevis}
          onclick={supprimerDevisSelection}
          title="Supprimer les devis sélectionnés"
        >
          {deletingDevis ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
      <div class="table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th class="col-checkbox">
                <label class="checkbox-label">
                  <input
                    bind:this={selectAllDevisCheckboxEl}
                    type="checkbox"
                    checked={allDevisSelected}
                    onchange={toggleAllDevis}
                    aria-label="Tout sélectionner"
                  />
                </label>
              </th>
              <th>N°</th>
              <th>Client</th>
              <th>Objet</th>
              <th>Date émission</th>
              <th>Total HT</th>
              <th>Créé le</th>
              <th class="col-accepted">Accepté</th>
              <th class="col-verified" title="Comparaison hash local = hash backend">Hash vérifié</th>
              <th class="col-facture">Facture</th>
              <th class="col-action">Exporter</th>
              <th class="col-pieces">Pièces jointes</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredDevisList as d (d.id)}
              {@const factureFromDevis = factureByDevisId[d.id]}
              <tr>
                <td class="col-checkbox">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={$selectedDevisIdsStore.has(d.id)}
                      onchange={() => toggleDevis(d.id)}
                      aria-label="Sélectionner le devis {d.entete?.numero || d.id}"
                    />
                  </label>
                </td>
                <td>{d.entete?.numero || '—'}</td>
                <td>{clientDisplayName(clientsMap[d.entete?.clientId])}</td>
                <td>{d.entete?.objet || '—'}</td>
                <td>{d.entete?.dateEmission || '—'}</td>
                <td>{typeof d.total === 'number' ? d.total.toFixed(2) : (d.total ?? '—')} €</td>
                <td>{d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                <td class="col-accepted" aria-label={d.accepted === true ? 'Devis accepté' : 'Devis non accepté'}>
                  {d.accepted === true ? 'Oui' : 'Non'}
                </td>
                <td class="col-verified" aria-label={verifiedMap[d.id] === true ? 'Hash vérifié' : verifiedMap[d.id] === false ? 'Hash non vérifié' : 'Vérification…'}>
                  {#if verifiedLoading && verifiedMap[d.id] === undefined}
                    <span class="icon icon-pending" aria-hidden="true">—</span>
                  {:else if verifiedMap[d.id] === true}
                    <span class="icon icon-ok" title="Hash local = hash backend">✓</span>
                  {:else}
                    <span class="icon icon-ko" title="Hash différent ou absent côté serveur">✗</span>
                  {/if}
                </td>
                <td class="col-facture" aria-label={factureFromDevis ? `Facture créée : ${factureFromDevis.entete?.numero || factureFromDevis.id}` : 'Aucune facture'}>
                  {#if factureFromDevis}
                    <span class="facture-created" title="Facture {factureFromDevis.entete?.numero || factureFromDevis.id}">{factureFromDevis.entete?.numero || 'Oui'}</span>
                  {:else}
                    <button
                      type="button"
                      class="btn-create-facture"
                      onclick={() => onOpenFactureFromDevis(d)}
                      title="Créer une facture à partir de ce devis"
                    >
                      Créer facture
                    </button>
                  {/if}
                </td>
                <td class="col-action">
                  <button type="button" class="btn-export-row" onclick={() => openPrintPreview(d.id, 'devis')} title="Exporter en PDF">Exporter</button>
                </td>
                <td class="col-pieces">
                  <button
                    type="button"
                    class="btn-zip-row"
                    disabled={zipExportingId === d.id}
                    onclick={() => exportPiecesJointesZip(d.id, 'devis', d.entete?.numero)}
                    title="Télécharger les pièces jointes (ZIP)"
                  >
                    {zipExportingId === d.id ? '…' : 'ZIP'}
                  </button>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="12" class="doc-table-empty">{($searchStore || '').trim() ? 'Aucun devis ne correspond à la recherche.' : 'Aucun devis.'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="liste-section" aria-label="Liste des factures">
      <div class="liste-section-head">
        <h3 class="liste-section-title">Factures</h3>
        <button
          type="button"
          class="btn-delete"
          disabled={!someFacturesSelected || deleting}
          onclick={supprimerFacturesSelection}
          title="Supprimer les factures sélectionnées"
        >
          {deleting ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
      <div class="table-wrap">
        <table class="doc-table">
          <thead>
            <tr>
              <th class="col-checkbox">
                <label class="checkbox-label">
                  <input
                    bind:this={selectAllCheckboxEl}
                    type="checkbox"
                    checked={allFacturesSelected}
                    onchange={toggleAllFactures}
                    aria-label="Tout sélectionner"
                  />
                </label>
              </th>
              <th>N°</th>
              <th>Client</th>
              <th>Objet</th>
              <th>Date émission</th>
              <th>Délai paiement</th>
              <th>Total HT</th>
              <th>Créée le</th>
              <th class="col-verified" title="Comparaison hash local = hash backend">Hash vérifié</th>
              <th class="col-action">Exporter</th>
              <th class="col-pieces">Pièces jointes</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredFacturesList as f (f.id)}
              <tr>
                <td class="col-checkbox">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={$selectedFactureIdsStore.has(f.id)}
                      onchange={() => toggleFacture(f.id)}
                      aria-label="Sélectionner la facture {f.entete?.numero || f.id}"
                    />
                  </label>
                </td>
                <td>{f.entete?.numero || '—'}</td>
                <td>{clientDisplayName(clientsMap[f.entete?.clientId])}</td>
                <td>{f.entete?.objet || '—'}</td>
                <td>{f.entete?.dateEmission || '—'}</td>
                <td>{f.entete?.delaiPaiement || '—'}</td>
                <td>{typeof f.total === 'number' ? f.total.toFixed(2) : (f.total ?? '—')} €</td>
                <td>{f.createdAt ? new Date(f.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                <td class="col-verified" aria-label={verifiedMap[f.id] === true ? 'Hash vérifié' : verifiedMap[f.id] === false ? 'Hash non vérifié' : 'Vérification…'}>
                  {#if verifiedLoading && verifiedMap[f.id] === undefined}
                    <span class="icon icon-pending" aria-hidden="true">—</span>
                  {:else if verifiedMap[f.id] === true}
                    <span class="icon icon-ok" title="Hash local = hash backend">✓</span>
                  {:else}
                    <span class="icon icon-ko" title="Hash différent ou absent côté serveur">✗</span>
                  {/if}
                </td>
                <td class="col-action">
                  <button type="button" class="btn-export-row" onclick={() => openPrintPreview(f.id, 'facture')} title="Exporter en PDF">Exporter</button>
                </td>
                <td class="col-pieces">
                  <button
                    type="button"
                    class="btn-zip-row"
                    disabled={zipExportingId === f.id}
                    onclick={() => exportPiecesJointesZip(f.id, 'facture', f.entete?.numero)}
                    title="Télécharger les pièces jointes (ZIP)"
                  >
                    {zipExportingId === f.id ? '…' : 'ZIP'}
                  </button>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="11" class="doc-table-empty">{($searchStore || '').trim() ? 'Aucune facture ne correspond à la recherche.' : 'Aucune facture.'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
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
    color: #0f766e;
    font-weight: 700;
  }
  .liste-documents-msg {
    margin: 0;
    color: #64748b;
  }
  .liste-documents-msg--error {
    color: #b91c1c;
    font-weight: 500;
  }
  .liste-documents-hint {
    margin: 0.25rem 0 0 0;
    font-size: 0.85rem;
    color: #64748b;
  }
  .liste-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .liste-section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .liste-section-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #475569;
  }
  .btn-delete {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #b91c1c;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-delete:hover:not(:disabled) {
    background: #fee2e2;
  }
  .btn-delete:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .col-checkbox {
    width: 2.25rem;
    text-align: center;
    vertical-align: middle;
  }
  .checkbox-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin: 0;
  }
  .checkbox-label input {
    width: 1.1rem;
    height: 1.1rem;
    cursor: pointer;
  }
  .table-wrap {
    overflow: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
  }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .doc-table th,
  .doc-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
  }
  .doc-table th {
    background: #f1f5f9;
    font-weight: 600;
    color: #475569;
  }
  .doc-table tbody tr:hover {
    background: #f8fafc;
  }
  .doc-table-empty {
    color: #64748b;
    font-style: italic;
    text-align: center;
  }
  .col-verified {
    text-align: center;
    width: 3rem;
  }
  .col-accepted {
    text-align: center;
    min-width: 4rem;
  }
  .col-facture {
    text-align: center;
    min-width: 5.5rem;
  }
  .facture-created {
    font-size: 0.85rem;
    color: #0369a1;
    font-weight: 500;
  }
  .btn-create-facture {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #0369a1;
    background: #f0f9ff;
    color: #0369a1;
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-create-facture:hover {
    background: #e0f2fe;
  }
  .icon {
    display: inline-block;
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
  }
  .icon-ok {
    color: #15803d;
  }
  .icon-ko {
    color: #b91c1c;
  }
  .icon-pending {
    color: #94a3b8;
  }
  .col-action {
    white-space: nowrap;
  }
  .col-pieces {
    white-space: nowrap;
  }
  .btn-export-row,
  .btn-zip-row {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #0f766e;
    background: #f0fdfa;
    color: #0f766e;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .btn-export-row:hover:not(:disabled),
  .btn-zip-row:hover:not(:disabled) {
    background: #ccfbf1;
  }
  .btn-zip-row:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
