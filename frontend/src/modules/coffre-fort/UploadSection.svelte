<script>
  import {
    DOC_TYPES,
    METADATA_CATEGORIES,
    MAX_FILE_SIZE_MB,
    ACCEPT_TYPES
  } from './constants.js';

  /** Section upload : formulaire + zone drag & drop + métadonnées. N’appelle pas la couche données. */
  let {
    clients = [],
    invoiceOptions = [],
    uploading = false,
    uploadError = null,
    clientDisplayName = (c) => c?.raisonSociale ?? '—',
    onUpload = async () => {},
    onClearError = () => {}
  } = $props();

  let selectedClientId = $state('');
  let selectedType = $state('justificatif');
  let selectedInvoiceId = $state('');
  let selectedFile = $state(null);
  let fileInputEl = $state(null);
  let dragOver = $state(false);
  let metaDescription = $state('');
  let metaCategory = $state('');
  let metaTags = $state('');
  let fileError = $state(null);

  function formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function validateFile(file) {
    if (!file) return { ok: false, error: null };
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { ok: false, error: `Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo)` };
    }
    return { ok: true, error: null };
  }

  function setFile(file) {
    fileError = null;
    if (!file) {
      selectedFile = null;
      return null;
    }
    const { ok, error } = validateFile(file);
    if (!ok) {
      fileError = error;
      onClearError();
      selectedFile = null;
      return error;
    }
    selectedFile = file;
    onClearError();
    return null;
  }

  function onInputChange(e) {
    setFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragOver = false;
    setFile(e.dataTransfer?.files?.[0] ?? null);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dragOver = true;
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragOver = false;
  }

  async function submit() {
    if (!selectedFile || !selectedClientId) {
      onClearError();
      return;
    }
    const metadata = {};
    if (metaDescription.trim()) metadata.description = metaDescription.trim();
    if (metaCategory) metadata.category = metaCategory;
    if (metaTags.trim()) {
      metadata.tags = metaTags.split(',').map((t) => t.trim()).filter(Boolean);
    }
    await onUpload({
      clientId: selectedClientId,
      type: selectedType,
      linkedInvoiceId: selectedInvoiceId || undefined,
      file: selectedFile,
      metadata: Object.keys(metadata).length ? metadata : undefined
    });
    selectedFile = null;
    metaDescription = '';
    metaCategory = '';
    metaTags = '';
    if (fileInputEl) fileInputEl.value = '';
  }
</script>

<section class="upload-section" aria-label="Ajouter un document">
  <h3 class="upload-section-title">Ajouter un document</h3>
  <div class="upload-form">
    <div class="upload-field">
      <label for="upload-client">Client *</label>
      <select id="upload-client" bind:value={selectedClientId} disabled={uploading}>
        <option value="">— Choisir —</option>
        {#each clients as c (c.id)}
          <option value={c.id}>{clientDisplayName(c)}</option>
        {/each}
      </select>
    </div>
    <div class="upload-field">
      <label for="upload-type">Type</label>
      <select id="upload-type" bind:value={selectedType} disabled={uploading}>
        {#each DOC_TYPES as t (t.value)}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
    </div>
    <div class="upload-field">
      <label for="upload-invoice">Lier à un devis / facture</label>
      <select id="upload-invoice" bind:value={selectedInvoiceId} disabled={uploading}>
        <option value="">— Aucun —</option>
        {#each invoiceOptions as opt (opt.id)}
          <option value={opt.id}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <div class="upload-field upload-field-full">
      <label for="upload-file">Fichier * (PDF, images, max {MAX_FILE_SIZE_MB} Mo)</label>
      <div
        class="upload-dropzone"
        class:is-dragover={dragOver}
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
        role="button"
        tabindex="0"
        onclick={() => fileInputEl?.click()}
        onkeydown={(e) => e.key === 'Enter' && fileInputEl?.click()}
      >
        <input
          id="upload-file"
          bind:this={fileInputEl}
          type="file"
          accept={ACCEPT_TYPES}
          onchange={onInputChange}
          disabled={uploading}
          class="upload-input-hidden"
          aria-label="Choisir un fichier"
        />
        {#if selectedFile}
          <span class="upload-filename">{selectedFile.name} — {formatSize(selectedFile.size)}</span>
        {:else}
          <span class="upload-drop-text">Glissez un fichier ici ou cliquez pour choisir</span>
        {/if}
      </div>
      {#if fileError}
        <p class="upload-file-error" role="alert">{fileError}</p>
      {/if}
    </div>

    <div class="upload-field upload-field-full">
      <label for="upload-desc">Description (optionnel)</label>
      <input id="upload-desc" type="text" bind:value={metaDescription} disabled={uploading} placeholder="Ex. Repas client Dupont" />
    </div>
    <div class="upload-field">
      <label for="upload-category">Catégorie (optionnel)</label>
      <select id="upload-category" bind:value={metaCategory} disabled={uploading}>
        {#each METADATA_CATEGORIES as cat (cat.value)}
          <option value={cat.value}>{cat.label}</option>
        {/each}
      </select>
    </div>
    <div class="upload-field">
      <label for="upload-tags">Tags (optionnel, séparés par des virgules)</label>
      <input id="upload-tags" type="text" bind:value={metaTags} disabled={uploading} placeholder="ex. déductible, 2024" />
    </div>
    <div class="upload-field upload-field-action">
      <button
        type="button"
        class="upload-btn upload-btn-primary"
        onclick={submit}
        disabled={uploading || !selectedFile || !selectedClientId}
      >
        {uploading ? 'Chiffrement…' : 'Ajouter et chiffrer'}
      </button>
    </div>

    {#if uploadError}
      <p class="upload-error upload-field-full">{uploadError}</p>
    {/if}
  </div>
</section>

<style>
  .upload-section-title {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #475569;
  }
  .upload-form {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    align-items: start;
  }
  .upload-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .upload-field-full {
    grid-column: 1 / -1;
  }
  .upload-field-action {
    display: flex;
    align-items: flex-end;
  }
  @media (max-width: 640px) {
    .upload-form {
      grid-template-columns: 1fr;
    }
  }
  .upload-field label {
    font-size: 0.85rem;
    font-weight: 500;
    color: #475569;
  }
  .upload-field select,
  .upload-field input[type="text"],
  .upload-field input[type="number"] {
    padding: 0.4rem 0.6rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .upload-dropzone {
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
    cursor: pointer;
    background: #f8fafc;
    transition: border-color 0.2s, background 0.2s;
  }
  .upload-dropzone.is-dragover {
    border-color: #0f766e;
    background: #f0fdfa;
  }
  .upload-dropzone .upload-input-hidden {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }
  .upload-drop-text {
    color: #64748b;
    font-size: 0.9rem;
  }
  .upload-filename {
    font-size: 0.9rem;
    color: #0f766e;
    font-weight: 500;
  }
  .upload-file-error {
    margin: 0.35rem 0 0 0;
    color: #b91c1c;
    font-size: 0.9rem;
  }
  .upload-error {
    margin: 0;
    color: #b91c1c;
    font-size: 0.9rem;
    width: 100%;
  }
  .upload-btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .upload-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .upload-btn-primary {
    background: #0f766e;
    color: white;
    border-color: #0f766e;
  }
  .upload-btn-primary:hover:not(:disabled) {
    background: #0d9488;
  }
</style>
