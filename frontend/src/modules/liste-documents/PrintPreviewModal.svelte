<script>
  import { getDevis, getFacture, getClientById, getSociete } from '$lib/dbEncrypted.js';
  import SheetA4 from '../editor/SheetA4.svelte';

  /** Modal d'aperçu pour impression / PDF. Reçoit documentId + documentType ('devis' | 'facture') + userId (partition). */
  let { open = false, documentId = null, documentType = 'devis', userId = null, onClose = () => {} } = $props();

  let document = $state(null);
  let resolvedClient = $state(null);
  let resolvedSociete = $state(null);
  let loading = $state(false);

  $effect(() => {
    if (!open || !documentId) {
      document = null;
      resolvedClient = null;
      resolvedSociete = null;
      return;
    }
    let cancelled = false;
    loading = true;
    const uid = userId ?? null;
    (documentType === 'facture' ? getFacture(documentId, uid) : getDevis(documentId, uid))
      .then((doc) => {
        if (cancelled) return;
        document = doc;
        if (doc?.entete?.clientId) {
          return getClientById(doc.entete.clientId, uid).then((c) => {
            if (cancelled) return;
            resolvedClient = c;
          });
        }
        resolvedClient = null;
      })
      .then(() => (cancelled ? undefined : getSociete(uid)))
      .then((s) => {
        if (cancelled) return;
        resolvedSociete = s;
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        document = null;
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => { cancelled = true; };
  });

  const blockPositions = $derived(document?.blockPositions ?? {});

  function doPrint() {
    window.print();
  }
</script>

{#if open}
  <div class="print-preview-overlay" role="dialog" aria-modal="true" aria-label="Aperçu pour impression">
    <div class="print-preview-content">
      <div class="print-preview-actions">
        <p class="print-preview-hint">Pour un PDF sans adresse ni date : dans la fenêtre d’impression, décocher « En-têtes et pieds de page ».</p>
        <button type="button" class="btn-print" onclick={doPrint}>Imprimer / PDF</button>
        <button type="button" class="btn-close" onclick={onClose}>Fermer</button>
      </div>
      {#if loading}
        <p class="print-preview-loading">Chargement…</p>
      {:else if document}
        <div class="print-preview-sheet-wrap">
          <SheetA4
            blockPositions={blockPositions}
            selectedBlock={null}
            document={document}
            documentType={documentType}
            {resolvedClient}
            {resolvedSociete}
            onDrop={() => {}}
            onOver={() => {}}
            onCanvasMouseDown={() => {}}
            onMouseMove={() => {}}
            onMouseUp={() => {}}
            onPlacedBlockMouseDown={() => {}}
            onResizeMouseDown={() => {}}
            onUpdateBlockStyle={() => {}}
            onCloseToolbar={() => {}}
          />
        </div>
      {:else}
        <p class="print-preview-error">Document introuvable.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .print-preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    box-sizing: border-box;
  }
  .print-preview-content {
    background: var(--color-bg-muted);
    border-radius: 12px;
    padding: 1rem;
    max-width: 100%;
    max-height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .print-preview-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .print-preview-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    width: 100%;
  }
  .btn-print {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: var(--color-primary);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-print:hover {
    background: var(--color-primary-hover);
  }
  .btn-close {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 6px;
    background: var(--color-bg-elevated);
    color: var(--color-text);
    cursor: pointer;
  }
  .btn-close:hover {
    background: var(--color-bg-muted);
  }
  .print-preview-sheet-wrap {
    max-width: 595px;
    width: 100%;
  }
  .print-preview-loading {
    margin: 0;
    color: var(--color-text-muted);
  }
  .print-preview-error {
    margin: 0;
    color: var(--color-error);
  }
  @media print {
    .print-preview-overlay {
      position: static;
      background: none;
      padding: 0;
    }
    .print-preview-content {
      background: none;
      padding: 0;
      box-shadow: none;
    }
    .print-preview-actions,
    .print-preview-hint {
      display: none !important;
    }
  }
</style>
