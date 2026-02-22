<script>
  import { clientDisplayName } from '$lib/liste-documents/listeDocumentsHelpers.js';

  let {
    list = [],
    clientsMap = {},
    verifiedMap = {},
    verifiedLoading = false,
    selectedFactureIdsStore,
    searchQuery = '',
    zipExportingId = null,
    deleting = false,
    allFacturesSelected = false,
    someFacturesSelected = false,
    onToggle = () => {},
    onToggleAll = () => {},
    onDeleteSelection = () => {},
    onExportPdf = () => {},
    onExportZip = () => {}
  } = $props();

  let selectAllCheckboxEl = $state(null);
  $effect(() => {
    if (selectAllCheckboxEl) selectAllCheckboxEl.indeterminate = someFacturesSelected && !allFacturesSelected;
  });
</script>

<section class="liste-section" aria-label="Liste des factures">
  <div class="liste-section-head">
    <h3 class="liste-section-title">Factures</h3>
    <button
      type="button"
      class="btn-delete"
      disabled={!someFacturesSelected || deleting}
      onclick={onDeleteSelection}
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
                onchange={onToggleAll}
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
        {#each list as f (f.id)}
          <tr>
            <td class="col-checkbox">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={$selectedFactureIdsStore.has(f.id)}
                  onchange={() => onToggle(f.id)}
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
              <button type="button" class="btn-export-row" onclick={() => onExportPdf(f.id, 'facture')} title="Exporter en PDF">Exporter</button>
            </td>
            <td class="col-pieces">
              <button
                type="button"
                class="btn-zip-row"
                disabled={zipExportingId === f.id}
                onclick={() => onExportZip(f.id, 'facture', f.entete?.numero)}
                title="Télécharger les pièces jointes (ZIP)"
              >
                {zipExportingId === f.id ? '…' : 'ZIP'}
              </button>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="11" class="doc-table-empty">{(searchQuery || '').trim() ? 'Aucune facture ne correspond à la recherche.' : 'Aucune facture.'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
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
