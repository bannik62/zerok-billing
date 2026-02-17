<script>
  import { onMount } from 'svelte';
  import { getAllDevis, getAllFactures, getAllClients, deleteDevis, deleteFacture } from '$lib/dbEncrypted.js';
  import { hashDocument } from '$lib/crypto/index.js';
  import { verifyProofs } from '$lib/proofs.js';
  import PrintPreviewModal from './PrintPreviewModal.svelte';

  /**
   * Liste documents – devis et factures.
   * Cases à cocher, Supprimer, et Exporter (PDF/impression) par document.
   */
  let { user = null } = $props();
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

  let devisList = $state([]);
  let facturesList = $state([]);
  let clientsMap = $state({});
  let searchQuery = $state('');
  let loading = $state(true);
  let error = $state(null);
  let verifiedMap = $state({});
  let verifiedLoading = $state(false);
  let selectedDevisIds = $state(new Set());
  let selectedFactureIds = $state(new Set());
  let deletingDevis = $state(false);
  let deleting = $state(false);

  function clientDisplayName(client) {
    if (!client) return '—';
    return client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(' ') || '—';
  }

  const filteredDevisList = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
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
    const q = searchQuery.trim().toLowerCase();
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

  const allDevisSelected = $derived(filteredDevisList.length > 0 && selectedDevisIds.size === filteredDevisList.length);
  const someDevisSelected = $derived(selectedDevisIds.size > 0);
  const allFacturesSelected = $derived(
    filteredFacturesList.length > 0 && selectedFactureIds.size === filteredFacturesList.length
  );
  const someFacturesSelected = $derived(selectedFactureIds.size > 0);

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
    const next = new Set(selectedDevisIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedDevisIds = next;
  }
  function toggleAllDevis() {
    if (allDevisSelected) selectedDevisIds = new Set();
    else selectedDevisIds = new Set(filteredDevisList.map((d) => d.id));
  }
  async function supprimerDevisSelection() {
    if (!someDevisSelected) return;
    const n = selectedDevisIds.size;
    const msg = n === 1 ? 'Supprimer ce devis ?' : `Supprimer les ${n} devis sélectionnés ?`;
    if (!confirm(msg)) return;
    deletingDevis = true;
    try {
      for (const id of selectedDevisIds) await deleteDevis(id);
      selectedDevisIds = new Set();
      devisList = await getAllDevis();
    } catch (e) {
      error = e?.message || 'Erreur lors de la suppression.';
    } finally {
      deletingDevis = false;
    }
  }

  function toggleFacture(id) {
    const next = new Set(selectedFactureIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedFactureIds = next;
  }

  function toggleAllFactures() {
    if (allFacturesSelected) {
      selectedFactureIds = new Set();
    } else {
      selectedFactureIds = new Set(filteredFacturesList.map((f) => f.id));
    }
  }

  async function supprimerFacturesSelection() {
    if (!someFacturesSelected) return;
    const n = selectedFactureIds.size;
    const msg =
      n === 1
        ? 'Supprimer cette facture ?'
        : `Supprimer les ${n} factures sélectionnées ?`;
    if (!confirm(msg)) return;
    deleting = true;
    try {
      for (const id of selectedFactureIds) {
        await deleteFacture(id);
      }
      selectedFactureIds = new Set();
      facturesList = await getAllFactures();
    } catch (e) {
      error = e?.message || 'Erreur lors de la suppression.';
    } finally {
      deleting = false;
    }
  }

  async function loadLists() {
    if (!user) return;
    loading = true;
    error = null;
    verifiedMap = {};
    try {
      const [devis, factures, clients] = await Promise.all([
        getAllDevis(),
        getAllFactures(),
        getAllClients()
      ]);
      if (!mounted) return;
      devisList = devis;
      facturesList = factures;
      clientsMap = Object.fromEntries((clients || []).map((c) => [c.id, c]));
      selectedDevisIds = new Set();
      selectedFactureIds = new Set();

      verifiedLoading = true;
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
    <div class="liste-search-wrap">
      <label for="liste-search" class="liste-search-label">Rechercher</label>
      <input
        id="liste-search"
        type="search"
        class="liste-search-input"
        placeholder="N°, client, objet, date, montant…"
        bind:value={searchQuery}
        maxlength="200"
        aria-label="Filtrer devis et factures"
      />
    </div>
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
              <th class="col-verified">Vérifié</th>
              <th class="col-action">Exporter</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredDevisList as d (d.id)}
              <tr>
                <td class="col-checkbox">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedDevisIds.has(d.id)}
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
                <td class="col-verified" aria-label={verifiedMap[d.id] === true ? 'Hash vérifié' : verifiedMap[d.id] === false ? 'Hash non vérifié' : 'Vérification…'}>
                  {#if verifiedLoading && verifiedMap[d.id] === undefined}
                    <span class="icon icon-pending" aria-hidden="true">—</span>
                  {:else if verifiedMap[d.id] === true}
                    <span class="icon icon-ok" title="Hash vérifié">✓</span>
                  {:else}
                    <span class="icon icon-ko" title="Non vérifié">✗</span>
                  {/if}
                </td>
                <td class="col-action">
                  <button type="button" class="btn-export-row" onclick={() => openPrintPreview(d.id, 'devis')} title="Exporter en PDF">Exporter</button>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="9" class="doc-table-empty">{searchQuery.trim() ? 'Aucun devis ne correspond à la recherche.' : 'Aucun devis.'}</td>
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
              <th class="col-verified">Vérifié</th>
              <th class="col-action">Exporter</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredFacturesList as f (f.id)}
              <tr>
                <td class="col-checkbox">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedFactureIds.has(f.id)}
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
                    <span class="icon icon-ok" title="Hash vérifié">✓</span>
                  {:else}
                    <span class="icon icon-ko" title="Non vérifié">✗</span>
                  {/if}
                </td>
                <td class="col-action">
                  <button type="button" class="btn-export-row" onclick={() => openPrintPreview(f.id, 'facture')} title="Exporter en PDF">Exporter</button>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="10" class="doc-table-empty">{searchQuery.trim() ? 'Aucune facture ne correspond à la recherche.' : 'Aucune facture.'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  <PrintPreviewModal
    open={printPreviewOpen}
    documentId={printDocumentId}
    documentType={printDocumentType}
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
  .liste-search-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .liste-search-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #475569;
  }
  .liste-search-input {
    flex: 1;
    max-width: 20rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .liste-search-input:focus {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
  }
  .liste-search-input::placeholder {
    color: #94a3b8;
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
  .btn-export-row {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #0f766e;
    background: #f0fdfa;
    color: #0f766e;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .btn-export-row:hover {
    background: #ccfbf1;
  }
</style>
