<script>
  import { decryptDocumentBlob } from '$lib/dbEncrypted.js';

  /** Modal d'aperçu d'un document (PDF ou image). Responsabilité unique : afficher ou proposer téléchargement. */
  let { open = false, document: doc = null, onClose = () => {} } = $props();

  let blobUrl = $state(null);
  let loading = $state(false);
  let error = $state(null);
  let previewKind = $state('none'); // 'image' | 'pdf' | 'none' | 'unsupported'

  $effect(() => {
    if (!open || !doc) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = null;
      loading = false;
      error = null;
      previewKind = 'none';
      return;
    }
    const mime = (doc.mimeType || '').toLowerCase();
    if (mime.startsWith('image/')) previewKind = 'image';
    else if (mime === 'application/pdf') previewKind = 'pdf';
    else previewKind = 'unsupported';

    if (previewKind === 'unsupported') return;

    let cancelled = false;
    loading = true;
    error = null;
    decryptDocumentBlob(doc)
      .then((blob) => {
        if (cancelled) return;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(blob);
      })
      .catch((e) => {
        if (!cancelled) error = e?.message ?? 'Impossible d’afficher l’aperçu';
      })
      .finally(() => {
        if (!cancelled) loading = false;
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  });

  function handleClose() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
    onClose();
  }
</script>

{#if open}
  <div class="preview-overlay" role="dialog" aria-modal="true" aria-label="Aperçu du document">
    <div class="preview-backdrop" onclick={handleClose} onkeydown={(e) => e.key === 'Escape' && handleClose()} tabindex="-1"></div>
    <div class="preview-box">
      <div class="preview-header">
        <span class="preview-title">{doc?.filename ?? 'Document'}</span>
        <button type="button" class="preview-close" onclick={handleClose} aria-label="Fermer">×</button>
      </div>
      <div class="preview-body">
        {#if loading}
          <p class="preview-loading">Chargement…</p>
        {:else if error}
          <div class="preview-error-block">
            <p class="preview-error">{error}</p>
            <p class="preview-error-hint">Vérifiez que la clé est chargée (déverrouillage), puis réessayez ou utilisez « Télécharger ».</p>
          </div>
        {:else if previewKind === 'unsupported'}
          <p class="preview-unsupported">Aperçu non disponible pour ce type de fichier. Utilisez « Télécharger ».</p>
        {:else if previewKind === 'image' && blobUrl}
          <img src={blobUrl} alt={doc?.filename} class="preview-img" />
        {:else if previewKind === 'pdf' && blobUrl}
          <embed src={blobUrl} type="application/pdf" title={doc?.filename} class="preview-pdf" />
          <p class="preview-pdf-fallback">Si l’aperçu ne s’affiche pas, utilisez « Télécharger » dans la liste.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .preview-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    box-sizing: border-box;
  }
  .preview-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    cursor: pointer;
  }
  .preview-box {
    position: relative;
    background: var(--color-bg-elevated);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .preview-title {
    font-weight: 600;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preview-close {
    width: 2rem;
    height: 2rem;
    border: none;
    background: var(--color-bg-muted);
    border-radius: 6px;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    color: var(--color-text-soft);
  }
  .preview-close:hover {
    background: var(--color-border);
  }
  .preview-body {
    flex: 1;
    min-height: 200px;
    overflow: auto;
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .preview-loading,
  .preview-error,
  .preview-unsupported {
    margin: 0;
    color: var(--color-text-muted);
  }
  .preview-error {
    color: var(--color-error);
  }
  .preview-img {
    max-width: 100%;
    max-height: 75vh;
    object-fit: contain;
  }
  .preview-pdf {
    width: 100%;
    min-width: 320px;
    height: 70vh;
    border: none;
  }
  .preview-pdf-fallback {
    margin: 0.75rem 0 0 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .preview-error-block {
    text-align: center;
  }
  .preview-error-hint {
    margin: 0.5rem 0 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
</style>
