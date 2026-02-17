<script>
  import { BLOCK_TYPES, getBlockLabel, formatMontant } from './utils.js';

  let {
    document = null,
    documentType = 'devis',
    resolvedClient = null,
    resolvedSociete = null,
    onDragStart = () => {}
  } = $props();
</script>

<aside class="editor-sidebar">
  <h3 class="sidebar-title">Blocs</h3>
  <p class="sidebar-hint">Glissez un bloc sur la feuille pour le placer.</p>
  {#each BLOCK_TYPES as type}
    <div
      class="sidebar-block"
      draggable="true"
      role="button"
      tabindex="0"
      ondragstart={(e) => onDragStart(e, type)}
    >
      <span class="sidebar-block-label">{getBlockLabel(type)}</span>
      {#if type === 'logo'}
        <span class="sidebar-block-preview">{resolvedSociete?.logo ? 'Image' : '—'}</span>
      {:else if type === 'societe' && resolvedSociete}
        <span class="sidebar-block-preview">{resolvedSociete.nom || 'Ma société'}</span>
      {:else if type === 'entete' && document?.entete}
        <span class="sidebar-block-preview">N° {document.entete.numero || '—'}</span>
        {#if resolvedClient}
          <span class="sidebar-block-preview">{resolvedClient.raisonSociale || [resolvedClient.prenom, resolvedClient.nom].filter(Boolean).join(' ')}</span>
        {/if}
      {:else if type === 'lignes' && document?.lignes?.length}
        <span class="sidebar-block-preview">{document.lignes.length} ligne(s)</span>
      {:else if type === 'sousTotal' && document != null}
        <span class="sidebar-block-preview">{formatMontant(document.sousTotal ?? 0)} €</span>
      {:else if type === 'reduction' && document?.reduction}
        <span class="sidebar-block-preview">{document.reduction.type === 'percent' ? document.reduction.value + '%' : document.reduction.value + ' €'}</span>
      {:else if type === 'total' && document != null}
        <span class="sidebar-block-preview">{formatMontant(document.total ?? 0)} €</span>
      {/if}
    </div>
  {/each}
</aside>

<style>
  .editor-sidebar {
    flex: 0 0 200px;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .sidebar-title {
    margin: 0 0 0.25rem 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f172a;
  }
  .sidebar-hint {
    margin: 0 0 0.5rem 0;
    font-size: 0.8rem;
    color: #64748b;
  }
  .sidebar-block {
    padding: 0.5rem 0.75rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: grab;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .sidebar-block:active {
    cursor: grabbing;
  }
  .sidebar-block-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #0f172a;
  }
  .sidebar-block-preview {
    font-size: 0.8rem;
    color: #64748b;
  }
</style>
