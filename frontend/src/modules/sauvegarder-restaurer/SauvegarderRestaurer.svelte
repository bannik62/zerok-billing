<script>
  import { createPasswordField } from '$lib/formField.js';
  import { getAllClients, getSociete } from '$lib/db.js';
  import { getAllDevis, getAllFactures, hasEncryptionKey } from '$lib/dbEncrypted.js';
  import { createArchive, openArchive } from '$lib/archive.js';
  import { applyRestore } from '$lib/restore.js';
  import { uploadBackupNow, scheduleBackupUpload } from '$lib/backupSync.js';
  import { buildPdfDocumentHtml } from '$lib/pdfDocumentHtml.js';
  import html2pdf from 'html2pdf.js';
  import JSZip from 'jszip';
  import { downloadBlob } from '$lib/coffreFortExport.js';

  let { user = null } = $props();
  const uid = $derived(user?.id ?? null);

  /**
   * Encapsule les champs du module sauvegarde/restauration (mots de passe + fichier d'import).
   */
  class ArchiveRestoreFields {
    constructor() {
      this.exportPassword = createPasswordField('', { autocomplete: 'new-password' });
      this.exportPasswordConfirm = createPasswordField('', { autocomplete: 'new-password' });
      this.importPassword = createPasswordField('', { autocomplete: 'current-password' });
      this._importFile = null;
    }

    isAcceptedArchiveFile(file) {
      if (!file || typeof file !== 'object') return false;
      const rawName = typeof file.name === 'string' ? file.name : '';
      const name = rawName.trim().toLowerCase();
      const mimeType = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
      if (name.endsWith('.zerok-archive') || name.endsWith('.json')) return true;
      return mimeType === 'application/json';
    }

    get importFile() {
      return this._importFile;
    }

    set importFile(file) {
      if (!file || typeof file !== 'object') {
        this._importFile = null;
        return;
      }
      if (typeof File === 'undefined') {
        this._importFile = null;
        return;
      }
      if (file instanceof File && this.isAcceptedArchiveFile(file)) {
        this._importFile = file;
        return;
      }
      this._importFile = null;
    }

    syncImportFileFromInput(inputEl) {
      this.importFile = inputEl?.files?.[0] ?? null;
      return this._importFile;
    }

    clearImportFile(inputEl) {
      this.importFile = null;
      if (inputEl) inputEl.value = '';
    }
  }

  const archiveRestoreFields = new ArchiveRestoreFields();
  const exportPwd = archiveRestoreFields.exportPassword;
  const exportPwdConfirm = archiveRestoreFields.exportPasswordConfirm;
  const importPwd = archiveRestoreFields.importPassword;
  const exportPwdStore = exportPwd.store;
  const exportPwdConfirmStore = exportPwdConfirm.store;
  const importPwdStore = importPwd.store;

  let exportError = $state('');
  let importError = $state('');
  let exportSuccess = $state('');
  let importSuccess = $state('');
  let exportLoading = $state(false);
  let importLoading = $state(false);
  let keyLoaded = $state(false);

  /** Inclure coffre fort (clients, société, profils) dans l'export */
  let exportCoffre = $state(true);
  /** Inclure documents (devis, factures) dans l'export */
  let exportDocuments = $state(true);

  /** Modale au clic sur Restaurer : choix entre régénérer la BDD (destructif) ou télécharger d'abord une sauvegarde */
  let restoreModalOpen = $state(false);
  let backupError = $state('');
  let backupSuccess = $state('');
  let backupLoading = $state(false);

  /** Sauvegarde serveur (bouton « Sauvegarder maintenant ») */
  let backupServerLoading = $state(false);
  let backupServerError = $state('');
  let backupServerSuccess = $state('');

  $effect(() => {
    keyLoaded = hasEncryptionKey();
  });

  function openRestoreModal() {
    backupError = '';
    backupSuccess = '';
    restoreModalOpen = true;
  }

  function closeRestoreModal() {
    restoreModalOpen = false;
  }

  /** Génère un nom de fichier sûr pour le PDF (sans caractères interdits). */
  function safePdfFilename(prefix, numero, id) {
    const base = numero && String(numero).trim() ? String(numero).replace(/[/\\?*:|"]/g, '-') : (id || '');
    return (prefix + (base ? `-${base}` : '') + '.pdf').trim() || prefix + '.pdf';
  }

  /** Télécharge les documents actuels (devis + factures) en PDF dans un ZIP. */
  async function doPreRestoreBackup() {
    backupError = '';
    backupSuccess = '';
    if (!keyLoaded) {
      backupError = 'Clé non chargée.';
      return;
    }
    backupLoading = true;
    try {
      const [devis, factures, clients, societe] = await Promise.all([
        getAllDevis(uid),
        getAllFactures(uid),
        getAllClients(uid),
        getSociete(uid)
      ]);
      const clientsMap = {};
      for (const c of clients) {
        if (c && c.id != null) clientsMap[c.id] = c;
      }
      const zip = new JSZip();
      const usedNames = new Set();

      const addPdfToZip = async (document, docType) => {
        const clientId = document?.entete?.clientId ?? document?.clientId;
        const client = clientId ? clientsMap[clientId] : null;
        const numero = document?.entete?.numero ?? '';
        const prefix = docType === 'devis' ? 'Devis' : 'Facture';
        let filename = safePdfFilename(prefix, numero, document?.id);
        if (usedNames.has(filename)) {
          let n = 1;
          while (usedNames.has(prefix + '-' + n + '.pdf')) n++;
          filename = prefix + '-' + n + '.pdf';
        }
        usedNames.add(filename);
        const htmlString = buildPdfDocumentHtml(document, client, societe, docType);
        const blob = await html2pdf()
          .set({
            margin: 4,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          })
          .from(htmlString)
          .outputPdf('blob');
        zip.file(filename, blob);
      };

      for (const doc of devis) {
        if (doc) await addPdfToZip(doc, 'devis');
      }
      for (const doc of factures) {
        if (doc) await addPdfToZip(doc, 'facture');
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `zerok-documents-avant-restore-${new Date().toISOString().slice(0, 10)}.zip`;
      downloadBlob(zipBlob, zipFilename);
      const count = devis.length + factures.length;
      backupSuccess = count > 0
        ? `${count} document(s) PDF téléchargé(s) dans le ZIP. Enregistrez le fichier où vous voulez, puis cliquez sur « Régénérer la BDD » pour lancer la restauration.`
        : 'Aucun devis ni facture. ZIP vide téléchargé. Vous pouvez quand même lancer la restauration.';
    } catch (e) {
      backupError = e?.message || 'Erreur lors de la génération des PDF.';
    } finally {
      backupLoading = false;
    }
  }

  function tryRestore() {
    importError = '';
    const file = archiveRestoreFields.syncImportFileFromInput(fileInputEl);
    if (!file) {
      importError = fileInputEl?.files?.[0] ? 'Format invalide.' : 'Choisissez un fichier d\'archive.';
      return;
    }
    if (importPwd.getError()) {
      importError = 'Mot de passe de l\'archive invalide.';
      return;
    }
    if (!keyLoaded) {
      importError = 'Déverrouillez d\'abord avec votre mot de passe.';
      return;
    }
    openRestoreModal();
  }

  function confirmRestore() {
    closeRestoreModal();
    doImport();
  }

  async function doSaveToServer() {
    backupServerError = '';
    backupServerSuccess = '';
    if (!uid) {
      backupServerError = 'Non connecté.';
      return;
    }
    if (!keyLoaded) {
      backupServerError = 'Déverrouillez d\'abord avec votre mot de passe.';
      return;
    }
    backupServerLoading = true;
    try {
      await uploadBackupNow(uid);
      backupServerSuccess = 'Sauvegarde serveur enregistrée.';
    } catch (e) {
      backupServerError = e?.message || 'Erreur lors de la sauvegarde serveur.';
    } finally {
      backupServerLoading = false;
    }
  }

  async function doExport() {
    exportError = '';
    exportSuccess = '';
    if (!exportCoffre && !exportDocuments) {
      exportError = 'Cochez au moins une option : Coffre fort ou Documents.';
      return;
    }
    const err = exportPwd.getError();
    if (err) {
      exportError = err;
      return;
    }
    if (exportPwd.value !== exportPwdConfirm.value) {
      exportError = 'Les deux mots de passe ne correspondent pas.';
      return;
    }
    if (!keyLoaded) {
      exportError = 'Déverrouillez d\'abord avec votre mot de passe (clé chargée).';
      return;
    }
    exportLoading = true;
    try {
      const bundle = {};
      if (exportCoffre) {
        const [clients, societe] = await Promise.all([
          getAllClients(uid),
          getSociete(uid)
        ]);
        bundle.clients = clients;
        bundle.societe = { id: 'societe', ...societe };
      }
      if (exportDocuments) {
        const [devis, factures] = await Promise.all([
          getAllDevis(uid),
          getAllFactures(uid)
        ]);
        bundle.devis = devis;
        bundle.factures = factures;
      }
      const archive = await createArchive(bundle, exportPwd.value);
      const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `zerok-archive-${new Date().toISOString().slice(0, 10)}.zerok-archive`;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      const parts = [];
      if (exportCoffre) parts.push('coffre fort');
      if (exportDocuments) parts.push('documents');
      exportSuccess = `Archive téléchargée (${parts.join(', ')}). Pour l'ouvrir ailleurs, utilisez « Restaurer » et le même mot de passe.`;
    } catch (e) {
      exportError = e?.message || 'Erreur lors de la création de l\'archive.';
    } finally {
      exportLoading = false;
    }
  }

  let fileInputEl = $state(null);
  let selectedFileName = $state('');

  async function doImport() {
    importError = '';
    importSuccess = '';
    const err = importPwd.getError();
    if (err) {
      importError = err;
      return;
    }
    const file = archiveRestoreFields.syncImportFileFromInput(fileInputEl);
    if (!file) {
      if (fileInputEl?.files?.[0]) {
        importError = 'Format invalide. Utilisez un fichier .zerok-archive ou .json.';
        return;
      }
      importError = 'Choisissez un fichier d\'archive.';
      return;
    }
    if (!keyLoaded) {
      importError = 'Déverrouillez d\'abord avec votre mot de passe pour restaurer les devis/factures.';
      return;
    }
    importLoading = true;
    try {
      const content = await file.text();
      const bundle = await openArchive(content, importPwd.value);
      await applyRestore(uid, bundle);
      scheduleBackupUpload(uid);
      archiveRestoreFields.clearImportFile(fileInputEl);
      selectedFileName = '';
      const restored = [];
      if (bundle.clients?.length > 0 || bundle.societe != null) restored.push('coffre fort');
      if (bundle.devis?.length > 0 || bundle.factures?.length > 0) restored.push('documents');
      importSuccess = `Restauration terminée (${restored.join(', ')}). Données réimportées et chiffrées avec la clé actuelle.`;
    } catch (e) {
      importError = e?.message || 'Erreur : archive invalide ou mot de passe incorrect.';
    } finally {
      importLoading = false;
    }
  }
</script>

<div class="sauvegarder-restaurer page">
  <h2>Sauvegarder / Restaurer</h2>
  <p class="hint">
    Créez une archive chiffrée : choisissez d'inclure le coffre fort (clients, société, profils), les documents (devis et factures), ou les deux.
    L'extraction nécessite le mot de passe choisi à l'export.
  </p>

  {#if !keyLoaded}
    <p class="warning">Déverrouillez d'abord avec votre mot de passe (écran « Déverrouiller » après connexion) pour exporter ou restaurer les devis et factures.</p>
  {/if}

  <div class="blocks-row">
  <section class="block export-block">
    <h3>Créer une archive et l'exporter</h3>
    <form onsubmit={(e) => { e.preventDefault(); doExport(); }} class="form">
      <p class="label-like">Inclure dans l'archive</p>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={exportCoffre} disabled={exportLoading} />
          Coffre fort (clients, société, profils)
        </label>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={exportDocuments} disabled={exportLoading} />
          Documents (devis et factures)
        </label>
      </div>
      <label for="export-pwd">Mot de passe pour protéger l'archive</label>
      <input
        id="export-pwd"
        type="password"
        placeholder="Mot de passe"
        minlength={exportPwd.minLength}
        maxlength={exportPwd.maxLength}
        value={$exportPwdStore}
        oninput={(e) => (exportPwd.value = e.currentTarget.value)}
        disabled={exportLoading}
      />
      <label for="export-pwd-confirm">Confirmer le mot de passe</label>
      <input
        id="export-pwd-confirm"
        type="password"
        placeholder="Confirmer"
        minlength={exportPwdConfirm.minLength}
        maxlength={exportPwdConfirm.maxLength}
        value={$exportPwdConfirmStore}
        oninput={(e) => (exportPwdConfirm.value = e.currentTarget.value)}
        disabled={exportLoading}
      />
      {#if exportError}<p class="error">{exportError}</p>{/if}
      {#if exportSuccess}<p class="success">{exportSuccess}</p>{/if}
      <button type="submit" disabled={exportLoading || !keyLoaded}>
        {exportLoading ? 'Création…' : 'Créer et télécharger l\'archive'}
      </button>
    </form>
  </section>

  <section class="block import-block">
    <h3>Restaurer depuis une archive</h3>
    <p class="hint-small">Remplace les données concernées (coffre fort et/ou documents) par le contenu de l'archive. Mot de passe = celui utilisé à l'export.</p>
    <form onsubmit={(e) => { e.preventDefault(); tryRestore(); }} class="form">
      <label for="import-file">Fichier d'archive (.zerok-archive)</label>
      <div class="file-input-wrap">
        <input
          id="import-file"
          type="file"
          accept=".zerok-archive,application/json"
          bind:this={fileInputEl}
          disabled={importLoading}
          class="file-input-hidden"
          onchange={() => (selectedFileName = fileInputEl?.files?.[0]?.name ?? '')}
        />
        <button type="button" class="form-button file-trigger" disabled={importLoading} onclick={() => fileInputEl?.click()}>
          Choisir un fichier
        </button>
        {#if selectedFileName}
          <span class="file-name">{selectedFileName}</span>
        {/if}
      </div>
      <label for="import-pwd">Mot de passe de l'archive</label>
      <input
        id="import-pwd"
        type="password"
        placeholder="Mot de passe"
        minlength={importPwd.minLength}
        maxlength={importPwd.maxLength}
        value={$importPwdStore}
        oninput={(e) => (importPwd.value = e.currentTarget.value)}
        disabled={importLoading}
      />
      {#if importError}<p class="error">{importError}</p>{/if}
      {#if importSuccess}<p class="success">{importSuccess}</p>{/if}
      <button type="submit" disabled={importLoading || !keyLoaded}>
        {importLoading ? 'Restauration…' : 'Restaurer'}
      </button>
    </form>
  </section>
  </div>

  <section class="block server-backup-block" style="margin-top: 1.5rem;">
    <h3>Sauvegarde sur le serveur</h3>
    <p class="hint-small">Une copie chiffrée de vos données est envoyée après chaque modification. Vous pouvez forcer une sauvegarde maintenant.</p>
    {#if backupServerError}<p class="error">{backupServerError}</p>{/if}
    {#if backupServerSuccess}<p class="success">{backupServerSuccess}</p>{/if}
    <button type="button" class="form-button" disabled={backupServerLoading || !keyLoaded || !uid} onclick={doSaveToServer}>
      {backupServerLoading ? 'Envoi…' : 'Sauvegarder maintenant'}
    </button>
  </section>

  {#if restoreModalOpen}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="restore-modal-title">
      <div class="modal-card restore-modal">
        <h3 id="restore-modal-title">Restauration</h3>
        <p class="modal-text">La restauration va régénérer la base avec le contenu de l'archive. Cette opération est <strong>destructive</strong> : les données concernées seront remplacées.</p>
        <p class="modal-text">Que voulez-vous faire ?</p>
        {#if backupError}<p class="error">{backupError}</p>{/if}
        {#if backupSuccess}<p class="success">{backupSuccess}</p>{/if}
        <div class="modal-actions">
          <button type="button" class="btn-primary" onclick={confirmRestore}>
            Régénérer la BDD avec l'archive
          </button>
          <button type="button" class="btn-secondary" disabled={backupLoading} onclick={doPreRestoreBackup}>
            {backupLoading ? 'Téléchargement…' : 'Sauvegarder l\'état actuel sur le disque'}
          </button>
          <button type="button" class="btn-ghost" onclick={closeRestoreModal}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .sauvegarder-restaurer { max-width: 100%; }
  .blocks-row {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 1.5rem;
  }
  .blocks-row .block {
    flex: 1;
    min-width: 0;
  }
  @media (max-width: 520px) {
    .blocks-row {
      flex-direction: column;
    }
  }
  .hint { color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 1rem; }
  .hint-small { color: var(--color-text-muted); font-size: 0.85rem; margin: 0 0 0.75rem 0; }
  .warning { background: var(--color-error-bg); color: var(--color-error); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
  .block { margin-bottom: 0; }
  .block h3 { margin: 0 0 0.75rem 0; font-size: 1.1rem; color: var(--color-primary); }
  .label-like { margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; font-weight: 500; }
  .checkbox-group { margin-bottom: 0.75rem; }
  .checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin: 0.35rem 0; font-size: 0.9rem; cursor: pointer; }
  .checkbox-label input[type="checkbox"] { flex-shrink: 0; }
  .form label { display: block; margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; }
  .form input[type="password"] { display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid var(--color-border-strong); border-radius: 6px; box-sizing: border-box; }
  .file-input-wrap { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .file-input-hidden { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
  .form-button.file-trigger { margin-top: 0; }
  .file-name { font-size: 0.9rem; color: var(--color-text-soft); }
  .form button,
  .form .form-button { margin-top: 0.75rem; padding: 0.6rem 1rem; background: var(--color-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: inherit; }
  .form button:disabled,
  .form .form-button:disabled { opacity: 0.7; cursor: not-allowed; }
  .error { color: var(--color-error); font-size: 0.9rem; margin: 0.5rem 0 0 0; }
  .success { color: var(--color-primary); font-size: 0.9rem; margin: 0.5rem 0 0 0; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); padding: 1rem; box-sizing: border-box; }
  .modal-card.restore-modal { background: var(--color-bg-elevated); border-radius: 12px; padding: 1.25rem; max-width: 420px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
  .restore-modal h3 { margin: 0 0 0.75rem 0; font-size: 1.15rem; color: var(--color-primary); }
  .restore-modal .modal-text { margin: 0 0 1rem 0; font-size: 0.95rem; color: var(--color-text); }
  .restore-modal .modal-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
  .restore-modal .btn-primary { background: var(--color-primary); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
  .restore-modal .btn-secondary { background: var(--color-bg-muted); color: var(--color-text); border: 1px solid var(--color-border); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
  .restore-modal .btn-ghost { background: transparent; color: var(--color-text-muted); border: none; padding: 0.5rem 1rem; cursor: pointer; }
  .restore-modal input[type="password"] { margin-bottom: 0.5rem; }
</style>
