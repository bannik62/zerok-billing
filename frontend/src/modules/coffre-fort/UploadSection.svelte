<script>
  import { writable, get } from 'svelte/store';
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

  const FIELD_ID_MAX_LENGTH = 100;
  const FIELD_VALUE_MAX_LENGTH = 30;
  const DESCRIPTION_MAX_LENGTH = 500;
  const TAGS_MAX_LENGTH = 300;
  const DEFAULT_DOC_TYPE = DOC_TYPES.find((t) => t.value === 'justificatif')?.value ?? DOC_TYPES[0]?.value ?? '';
  const allowedDocTypes = new Set(DOC_TYPES.map((t) => t.value));
  const allowedCategories = new Set(METADATA_CATEGORIES.map((c) => c.value));
  const acceptedExtensions = ACCEPT_TYPES
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.startsWith('.'));

  class CoffreFortUploadFields {
    constructor() {
      this.selectedClientIdStore = writable('');
      this.selectedTypeStore = writable(DEFAULT_DOC_TYPE);
      this.selectedInvoiceIdStore = writable('');
      this.selectedFileStore = writable(null);
      this.metaDescriptionStore = writable('');
      this.metaCategoryStore = writable('');
      this.metaTagsStore = writable('');
    }

    sanitizeText(value, maxLength) {
      let next = typeof value === 'string' ? value : '';
      next = next.replace(/[\u0000-\u001f\u007f]/g, '');
      if (next.length > maxLength) next = next.slice(0, maxLength);
      return next;
    }

    normalizeId(value) {
      return this.sanitizeText(value, FIELD_ID_MAX_LENGTH).trim();
    }

    normalizeType(value) {
      const next = this.sanitizeText(value, FIELD_VALUE_MAX_LENGTH).trim();
      return allowedDocTypes.has(next) ? next : DEFAULT_DOC_TYPE;
    }

    normalizeCategory(value) {
      const next = this.sanitizeText(value, FIELD_VALUE_MAX_LENGTH).trim();
      return allowedCategories.has(next) ? next : '';
    }

    isAcceptedFile(file) {
      if (!file || typeof file.name !== 'string') return false;
      const filename = file.name.trim().toLowerCase();
      if (!filename) return false;
      return acceptedExtensions.some((ext) => filename.endsWith(ext));
    }

    get selectedClientId() {
      return get(this.selectedClientIdStore);
    }

    set selectedClientId(value) {
      this.selectedClientIdStore.set(this.normalizeId(value));
    }

    get selectedType() {
      return get(this.selectedTypeStore);
    }

    set selectedType(value) {
      this.selectedTypeStore.set(this.normalizeType(value));
    }

    get selectedInvoiceId() {
      return get(this.selectedInvoiceIdStore);
    }

    set selectedInvoiceId(value) {
      this.selectedInvoiceIdStore.set(this.normalizeId(value));
    }

    get selectedFile() {
      return get(this.selectedFileStore);
    }

    set selectedFile(file) {
      if (!file || typeof file !== 'object') {
        this.selectedFileStore.set(null);
        return;
      }
      const isFileLike = typeof File === 'undefined' || file instanceof File;
      if (isFileLike && this.isAcceptedFile(file)) {
        this.selectedFileStore.set(file);
        return;
      }
      this.selectedFileStore.set(null);
    }

    get metaDescription() {
      return get(this.metaDescriptionStore);
    }

    set metaDescription(value) {
      this.metaDescriptionStore.set(this.sanitizeText(value, DESCRIPTION_MAX_LENGTH));
    }

    get metaCategory() {
      return get(this.metaCategoryStore);
    }

    set metaCategory(value) {
      this.metaCategoryStore.set(this.normalizeCategory(value));
    }

    get metaTags() {
      return get(this.metaTagsStore);
    }

    set metaTags(value) {
      this.metaTagsStore.set(this.sanitizeText(value, TAGS_MAX_LENGTH));
    }

    clearAfterUpload(fileInputEl) {
      this.selectedFile = null;
      this.metaDescription = '';
      this.metaCategory = '';
      this.metaTags = '';
      if (fileInputEl) fileInputEl.value = '';
    }
  }

  const uploadFields = new CoffreFortUploadFields();
  const selectedClientIdStore = uploadFields.selectedClientIdStore;
  const selectedTypeStore = uploadFields.selectedTypeStore;
  const selectedInvoiceIdStore = uploadFields.selectedInvoiceIdStore;
  const selectedFileStore = uploadFields.selectedFileStore;
  const metaDescriptionStore = uploadFields.metaDescriptionStore;
  const metaCategoryStore = uploadFields.metaCategoryStore;
  const metaTagsStore = uploadFields.metaTagsStore;

  let fileInputEl = $state(null);
  let dragOver = $state(false);
  let fileError = $state(null);

  function formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function validateFile(file) {
    if (!file) return { ok: false, error: null };
    if (!uploadFields.isAcceptedFile(file)) {
      return { ok: false, error: `Format non supporté (extensions autorisées: ${ACCEPT_TYPES})` };
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return { ok: false, error: `Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo)` };
    }
    return { ok: true, error: null };
  }

  function setFile(file) {
    fileError = null;
    if (!file) {
      uploadFields.selectedFile = null;
      return null;
    }
    const { ok, error } = validateFile(file);
    if (!ok) {
      fileError = error;
      onClearError();
      uploadFields.selectedFile = null;
      return error;
    }
    uploadFields.selectedFile = file;
    onClearError();
    return null;
  }

  function onInputChange(e) {
    setFile(e.currentTarget.files?.[0] ?? null);
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
    const selectedFile = uploadFields.selectedFile;
    const selectedClientId = uploadFields.selectedClientId;
    if (!selectedFile || !selectedClientId) {
      onClearError();
      return;
    }
    const metadata = {};
    const description = uploadFields.metaDescription.trim();
    const category = uploadFields.metaCategory;
    const tagsValue = uploadFields.metaTags.trim();
    if (description) metadata.description = description;
    if (category) metadata.category = category;
    if (tagsValue) {
      metadata.tags = tagsValue.split(',').map((t) => t.trim()).filter(Boolean);
    }
    await onUpload({
      clientId: selectedClientId,
      type: uploadFields.selectedType,
      linkedInvoiceId: uploadFields.selectedInvoiceId || undefined,
      file: selectedFile,
      metadata: Object.keys(metadata).length ? metadata : undefined
    });
    uploadFields.clearAfterUpload(fileInputEl);
  }
</script>

<section class="upload-section" aria-label="Ajouter un document">
  <h3 class="upload-section-title">Ajouter un document</h3>
  <div class="upload-form">
    <div class="upload-field">
      <label for="upload-client">Client *</label>
      <select
        id="upload-client"
        value={$selectedClientIdStore}
        onchange={(e) => (uploadFields.selectedClientId = e.currentTarget.value)}
        disabled={uploading}
      >
        <option value="">— Choisir —</option>
        {#each clients as c (c.id)}
          <option value={c.id}>{clientDisplayName(c)}</option>
        {/each}
      </select>
    </div>
    <div class="upload-field">
      <label for="upload-type">Type</label>
      <select
        id="upload-type"
        value={$selectedTypeStore}
        onchange={(e) => (uploadFields.selectedType = e.currentTarget.value)}
        disabled={uploading}
      >
        {#each DOC_TYPES as t (t.value)}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
    </div>
    <div class="upload-field">
      <label for="upload-invoice">Lier à un devis / facture</label>
      <select
        id="upload-invoice"
        value={$selectedInvoiceIdStore}
        onchange={(e) => (uploadFields.selectedInvoiceId = e.currentTarget.value)}
        disabled={uploading}
      >
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
        {#if $selectedFileStore}
          <span class="upload-filename">{$selectedFileStore.name} — {formatSize($selectedFileStore.size)}</span>
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
      <input
        id="upload-desc"
        type="text"
        value={$metaDescriptionStore}
        oninput={(e) => (uploadFields.metaDescription = e.currentTarget.value)}
        disabled={uploading}
        placeholder="Ex. Repas client Dupont"
      />
    </div>
    <div class="upload-field">
      <label for="upload-category">Catégorie (optionnel)</label>
      <select
        id="upload-category"
        value={$metaCategoryStore}
        onchange={(e) => (uploadFields.metaCategory = e.currentTarget.value)}
        disabled={uploading}
      >
        {#each METADATA_CATEGORIES as cat (cat.value)}
          <option value={cat.value}>{cat.label}</option>
        {/each}
      </select>
    </div>
    <div class="upload-field">
      <label for="upload-tags">Tags (optionnel, séparés par des virgules)</label>
      <input
        id="upload-tags"
        type="text"
        value={$metaTagsStore}
        oninput={(e) => (uploadFields.metaTags = e.currentTarget.value)}
        disabled={uploading}
        placeholder="ex. déductible, 2024"
      />
    </div>
    <div class="upload-field upload-field-action">
      <button
        type="button"
        class="upload-btn upload-btn-primary"
        onclick={submit}
        disabled={uploading || !$selectedFileStore || !$selectedClientIdStore}
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
