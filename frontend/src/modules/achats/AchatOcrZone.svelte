<script>
  /**
   * Zone drop + fichier pour OCR facture fournisseur.
   * Responsabilité UI uniquement : capture fichier, appelle scanFile, notifie le parent.
   */
  import { scanFile } from '$lib/ocr/index.js';

  let {
    onResult = () => {},
    onError = () => {}
  } = $props();

  let scanning = $state(false);
  let dragOver = $state(false);
  let fileInputEl = $state(null);

  const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/bmp';

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) runScan(file);
  }

  function handleInputChange() {
    const file = fileInputEl?.files?.[0];
    if (file) runScan(file);
    if (fileInputEl) fileInputEl.value = '';
  }

  async function runScan(file) {
    scanning = true;
    try {
      const result = await scanFile(file);
      onResult(result);
    } catch (err) {
      onError(err?.message ?? 'Erreur OCR');
    } finally {
      scanning = false;
    }
  }
</script>

<div class="ocr-zone">
  <label for="ocr-file" class="ocr-label">Pré-remplir depuis une facture (OCR)</label>
  <div
    class="ocr-dropzone"
    class:scanning
    class:is-dragover={dragOver}
    role="button"
    tabindex="0"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => { dragOver = false; }}
    ondrop={handleDrop}
    onclick={() => fileInputEl?.click()}
    onkeydown={(e) => e.key === 'Enter' && fileInputEl?.click()}
  >
    <input
      id="ocr-file"
      bind:this={fileInputEl}
      type="file"
      accept={ACCEPT}
      onchange={handleInputChange}
      disabled={scanning}
      class="ocr-input-hidden"
      aria-label="Choisir une facture PDF ou image"
    />
    {#if scanning}
      <span class="ocr-status">Analyse en cours…</span>
    {:else}
      <span class="ocr-drop-text">Déposer un PDF ou une image de facture ici</span>
    {/if}
  </div>
</div>

<style>
  .ocr-zone {
    margin-bottom: 0.75rem;
  }
  .ocr-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-soft);
    margin-bottom: 0.25rem;
  }
  .ocr-dropzone {
    border: 2px dashed var(--color-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    text-align: center;
    cursor: pointer;
    background: var(--color-bg-muted);
    transition: border-color 0.2s, background 0.2s;
  }
  .ocr-dropzone:hover:not(.scanning) {
    border-color: var(--color-primary);
    background: var(--color-bg-elevated);
  }
  .ocr-dropzone.is-dragover {
    border-color: var(--color-primary);
    background: var(--color-bg-elevated);
  }
  .ocr-dropzone.scanning {
    cursor: wait;
    opacity: 0.85;
  }
  .ocr-input-hidden {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }
  .ocr-drop-text,
  .ocr-status {
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .ocr-status {
    font-style: italic;
  }
</style>
