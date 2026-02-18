<script>
  import { getDocTypeLabel, getCategoryLabel } from './constants.js';

  /** Tableau des documents : affichage + actions. Pas d’appel données, uniquement callbacks. */
  let {
    documents = [],
    clientsMap = {},
    invoiceOptions = [],
    clientDisplayName = (c) => c?.raisonSociale ?? '—',
    formatSize = (n) => (n != null ? `${n} o` : '—'),
    onPreview = () => {},
    onDownload = () => {},
    onDelete = () => {}
  } = $props();

  function invoiceLabel(invoiceId) {
    if (!invoiceId) return '—';
    const opt = invoiceOptions.find((o) => o.id === invoiceId);
    return opt ? opt.label : invoiceId;
  }

  function canPreview(mimeType) {
    const m = (mimeType || '').toLowerCase();
    return m.startsWith('image/') || m === 'application/pdf';
  }
</script>

<div class="doc-table-wrap">
  <table class="doc-table">
    <thead>
      <tr>
        <th>Fichier</th>
        <th>Client</th>
        <th>Type</th>
        <th>Description</th>
        <th>Taille</th>
        <th>Date</th>
        <th>Lien facture / devis</th>
        <th class="doc-col-actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each documents as doc (doc.id)}
        <tr>
          <td class="doc-cell-filename">📄 {doc.filename}</td>
          <td>{clientDisplayName(clientsMap[doc.clientId])}</td>
          <td>{getDocTypeLabel(doc.type)}</td>
          <td class="doc-cell-desc">{doc.metadata?.description || '—'}</td>
          <td>{formatSize(doc.size)}</td>
          <td>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('fr-FR') : '—'}</td>
          <td>{invoiceLabel(doc.linkedInvoiceId)}</td>
          <td class="doc-col-actions">
            {#if canPreview(doc.mimeType)}
              <button type="button" class="doc-btn doc-btn-preview" onclick={() => onPreview(doc)} title="Aperçu">Aperçu</button>
            {/if}
            <button type="button" class="doc-btn doc-btn-dl" onclick={() => onDownload(doc)} title="Télécharger">Télécharger</button>
            <button type="button" class="doc-btn doc-btn-del" onclick={() => onDelete(doc)} title="Supprimer">Supprimer</button>
          </td>
        </tr>
      {:else}
        <tr>
          <td colspan="8" class="doc-empty">Aucun document.</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .doc-table-wrap {
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
  .doc-col-actions {
    white-space: nowrap;
  }
  .doc-btn {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    margin-right: 0.35rem;
  }
  .doc-btn-preview {
    background: #f0fdfa;
    color: #0f766e;
    border-color: #0f766e;
  }
  .doc-btn-dl {
    background: #f0fdfa;
    color: #0f766e;
    border-color: #0f766e;
  }
  .doc-btn-del {
    background: #fef2f2;
    color: #b91c1c;
    border-color: #b91c1c;
  }
  .doc-cell-filename {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doc-cell-desc {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doc-empty {
    color: #64748b;
    font-style: italic;
    text-align: center;
  }
</style>
