<script>
  import { clientDisplayName } from '$lib/liste-documents/listeDocumentsHelpers.js';

  let {
    list = [],
    clientsMap = {},
    factureByDevisId = {},
    verifiedMap = {},
    verifiedLoading = false,
    selectedDevisIdsStore,
    searchQuery = '',
    zipExportingId = null,
    deletingDevis = false,
    allDevisSelected = false,
    someDevisSelected = false,
    onToggle = () => {},
    onToggleAll = () => {},
    onDeleteSelection = () => {},
    onOpenFactureFromDevis = () => {},
    onExportPdf = () => {},
    onExportZip = () => {}
  } = $props();

  let selectAllCheckboxEl = $state(null);
  $effect(() => {
    if (selectAllCheckboxEl) selectAllCheckboxEl.indeterminate = someDevisSelected && !allDevisSelected;
  });
</script>

<section class="liste-section" aria-label="Liste des devis">
  <div class="liste-section-head">
    <h3 class="liste-section-title">Devis</h3>
    <button
      type="button"
      class="btn-delete"
      disabled={!someDevisSelected || deletingDevis}
      onclick={onDeleteSelection}
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
                bind:this={selectAllCheckboxEl}
                type="checkbox"
                checked={allDevisSelected}
                onchange={onToggleAll}
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
        {#each list as d (d.id)}
          {@const factureFromDevis = factureByDevisId[d.id]}
          <tr>
            <td class="col-checkbox">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={$selectedDevisIdsStore.has(d.id)}
                  onchange={() => onToggle(d.id)}
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
              <button type="button" class="btn-export-row" onclick={() => onExportPdf(d.id, 'devis')} title="Exporter en PDF">Exporter</button>
            </td>
            <td class="col-pieces">
              <button
                type="button"
                class="btn-zip-row"
                disabled={zipExportingId === d.id}
                onclick={() => onExportZip(d.id, 'devis', d.entete?.numero)}
                title="Télécharger les pièces jointes (ZIP)"
              >
                {zipExportingId === d.id ? '…' : 'ZIP'}
              </button>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="12" class="doc-table-empty">{(searchQuery || '').trim() ? 'Aucun devis ne correspond à la recherche.' : 'Aucun devis.'}</td>
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
