<script>
  import { clientDisplayName } from '$lib/liste-documents/listeDocumentsHelpers.js';

  let {
    list = [],
    clientsMap = {},
    verifiedMap = {},
    verifiedLoading = false,
    paymentStatusMap = {},
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
    onExportZip = () => {},
    onSendForSignature = () => {},
    sendingForSignatureId = null
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
          <th class="col-send">Envoyer</th>
          <th class="col-paid" title="Paiement enregistré (Stripe)">Payé</th>
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
            <td class="col-send" aria-label={!clientsMap[f.entete?.clientId]?.email ? 'Email client manquant' : 'Envoyer à signer'}>
              <button
                type="button"
                class="btn-send-row"
                disabled={sendingForSignatureId === f.id || (!paymentStatusMap[f.id]?.paid && !clientsMap[f.entete?.clientId]?.email)}
                title={!clientsMap[f.entete?.clientId]?.email && !paymentStatusMap[f.id]?.paid ? 'Ajoutez un email au client' : 'Envoyer la facture au client pour signature'}
                onclick={() => onSendForSignature(f)}
              >
                {sendingForSignatureId === f.id ? '…' : 'Envoyer'}
              </button>
            </td>
            <td class="col-paid">
              {#if paymentStatusMap[f.id]?.paid}
                <span class="paid-badge" title={paymentStatusMap[f.id]?.paidAt ? `Payé le ${new Date(paymentStatusMap[f.id].paidAt).toLocaleString('fr-FR')}` : 'Payé'}>Oui</span>
              {:else}
                <span class="paid-badge paid-badge--no">—</span>
              {/if}
            </td>
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
            <td colspan="13" class="doc-table-empty">{(searchQuery || '').trim() ? 'Aucune facture ne correspond à la recherche.' : 'Aucune facture.'}</td>
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
    color: var(--color-text-soft);
  }
  .btn-delete {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-error);
    background: var(--color-error-bg);
    color: var(--color-error);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-delete:hover:not(:disabled) {
    filter: brightness(0.95);
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
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-elevated);
  }
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .doc-table th,
  .doc-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
    text-align: left;
    color: var(--color-text);
  }
  .doc-table th {
    background: var(--color-bg-muted);
    font-weight: 600;
    color: var(--color-text-soft);
  }
  .doc-table tbody tr:hover {
    background: var(--color-bg-muted);
  }
  .doc-table-empty {
    color: var(--color-text-muted);
    font-style: italic;
    text-align: center;
  }
  .col-send {
    text-align: center;
    white-space: nowrap;
  }
  .col-paid {
    text-align: center;
    white-space: nowrap;
  }
  .paid-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    background: var(--color-primary-bg, #ecfdf5);
    color: var(--color-primary, #059669);
  }
  .paid-badge--no {
    background: transparent;
    color: var(--color-text-muted);
  }
  .btn-send-row {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--color-primary);
    background: var(--color-bg-muted);
    color: var(--color-primary);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .btn-send-row:hover:not(:disabled) {
    filter: brightness(0.95);
  }
  .btn-send-row:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    color: var(--color-primary);
  }
  .icon-ko {
    color: var(--color-error);
  }
  .icon-pending {
    color: var(--color-text-muted);
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
    border: 1px solid var(--color-primary);
    background: var(--color-bg-muted);
    color: var(--color-primary);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .btn-export-row:hover:not(:disabled),
  .btn-zip-row:hover:not(:disabled) {
    filter: brightness(0.95);
  }
  .btn-zip-row:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
