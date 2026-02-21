<script>
  import { createPasswordField } from '$lib/formField.js';
  import { openDB } from '$lib/db.js';
  import {
    getAllClients,
    getSociete,
    getAllLayoutProfiles
  } from '$lib/db.js';
  import { getAllDevis, getAllFactures, addDevis, addFacture, hasEncryptionKey } from '$lib/dbEncrypted.js';
  import { createArchive, openArchive } from '$lib/archive.js';

  let { user = null } = $props();
  const uid = $derived(user?.id ?? null);

  /**
   * Encapsule les champs du module sauvegarde/restauration.
   * Conserve une interface getter/setter pour le fichier d'import.
   */
  class ArchiveRestoreFields {
    constructor() {
      this.exportPassword = createPasswordField('', { autocomplete: 'new-password' });
      this.exportPasswordConfirm = createPasswordField('', { autocomplete: 'new-password' });
      this.importPassword = createPasswordField('', { autocomplete: 'current-password' });
      this._importFile = null;
    }

    get importFile() {
      return this._importFile;
    }

    set importFile(file) {
      if (!file || typeof file !== 'object') {
        this._importFile = null;
        return;
      }
      if (typeof File === 'undefined' || file instanceof File) {
        this._importFile = file;
        return;
      }
      this._importFile = null;
    }

    syncImportFileFromInput(inputEl) {
      this.importFile = inputEl?.files?.[0] ?? null;
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

  $effect(() => {
    keyLoaded = hasEncryptionKey();
  });

  async function doExport() {
    exportError = '';
    exportSuccess = '';
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
      const [devis, factures, clients, societe, layoutProfiles] = await Promise.all([
        getAllDevis(uid),
        getAllFactures(uid),
        getAllClients(uid),
        getSociete(uid),
        getAllLayoutProfiles(uid)
      ]);
      const societeRecord = { id: 'societe', ...societe };
      const bundle = { devis, factures, clients, societe: societeRecord, layoutProfiles };
      const archive = await createArchive(bundle, exportPwd.value);
      const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zerok-archive-${new Date().toISOString().slice(0, 10)}.zerok-archive`;
      a.click();
      URL.revokeObjectURL(url);
      exportSuccess = 'Archive téléchargée. Pour l\'ouvrir ailleurs, utilisez « Restaurer » et le même mot de passe.';
    } catch (e) {
      exportError = e?.message || 'Erreur lors de la création de l\'archive.';
    } finally {
      exportLoading = false;
    }
  }

  let fileInputEl = $state(null);

  async function doImport() {
    importError = '';
    importSuccess = '';
    const err = importPwd.getError();
    if (err) {
      importError = err;
      return;
    }
    archiveRestoreFields.syncImportFileFromInput(fileInputEl);
    const file = archiveRestoreFields.importFile;
    if (!file) {
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
      const db = await openDB();
      await db.clients.clear();
      await db.societe.clear();
      await db.devis.clear();
      await db.factures.clear();
      await db.layoutProfiles.clear();
      for (const c of bundle.clients) {
        await db.clients.put(uid != null ? { ...c, userId: uid } : c);
      }
      if (bundle.societe && bundle.societe.id) {
        const societeId = uid != null ? `societe-${uid}` : bundle.societe.id;
        await db.societe.put({ ...bundle.societe, id: societeId, ...(uid != null && { userId: uid }) });
      }
      for (const p of bundle.layoutProfiles) {
        await db.layoutProfiles.put(uid != null ? { ...p, userId: uid } : p);
      }
      for (const d of bundle.devis) {
        await addDevis(d, uid);
      }
      for (const f of bundle.factures) {
        await addFacture(f, uid);
      }
      archiveRestoreFields.clearImportFile(fileInputEl);
      importSuccess = 'Restauration terminée. Les documents ont été réimportés (chiffrés avec la clé actuelle).';
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
    Créez une archive chiffrée contenant tous vos documents (devis, factures, clients, société, profils).
    L'extraction nécessite le mot de passe choisi à l'export.
  </p>

  {#if !keyLoaded}
    <p class="warning">Déverrouillez d'abord avec votre mot de passe (écran « Déverrouiller » après connexion) pour exporter ou restaurer les devis et factures.</p>
  {/if}

  <div class="blocks-row">
  <section class="block export-block">
    <h3>Créer une archive et l'exporter</h3>
    <form onsubmit={(e) => { e.preventDefault(); doExport(); }} class="form">
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
    <p class="hint-small">Remplace toutes les données actuelles par le contenu de l'archive. Mot de passe = celui utilisé à l'export.</p>
    <form onsubmit={(e) => { e.preventDefault(); doImport(); }} class="form">
      <label for="import-file">Fichier d'archive (.zerok-archive)</label>
      <input
        id="import-file"
        type="file"
        accept=".zerok-archive,application/json"
        bind:this={fileInputEl}
        disabled={importLoading}
        onchange={(e) => archiveRestoreFields.syncImportFileFromInput(e.currentTarget)}
      />
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
  .hint { color: #64748b; font-size: 0.9rem; margin-bottom: 1rem; }
  .hint-small { color: #64748b; font-size: 0.85rem; margin: 0 0 0.75rem 0; }
  .warning { background: #fef3c7; color: #92400e; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
  .block { margin-bottom: 0; }
  .block h3 { margin: 0 0 0.75rem 0; font-size: 1.1rem; color: #0f766e; }
  .form label { display: block; margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; }
  .form input[type="password"],
  .form input[type="file"] { display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
  .form button { margin-top: 0.75rem; padding: 0.6rem 1rem; background: #0f766e; color: white; border: none; border-radius: 6px; cursor: pointer; }
  .form button:disabled { opacity: 0.7; cursor: not-allowed; }
  .error { color: #b91c1c; font-size: 0.9rem; margin: 0.5rem 0 0 0; }
  .success { color: #15803d; font-size: 0.9rem; margin: 0.5rem 0 0 0; }
</style>
