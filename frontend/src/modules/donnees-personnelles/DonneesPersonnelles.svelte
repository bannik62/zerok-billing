<script>
import { getSociete, saveSociete } from '$lib/db.js';
import { apiClient } from '$lib/apiClient.js';
  import {
    createTextField,
    createUrlField,
    createSiretField,
    createTvaIntraField,
    createCapitalField
  } from '$lib/formField.js';
  import { scheduleBackupUpload } from '$lib/backupSync.js';

  /**
   * Module Données personnelles – affichage + modification (IndexedDB).
   * Champs encapsulés (FormField) pour trim + maxLength.
   */
  let { user = null } = $props();
  const uid = $derived(user?.id ?? null);

  let societe = $state({
    logo: '',
    nom: '',
    formeJuridique: '',
    siret: '',
    rcs: '',
    capital: '',
    siegeSocial: '',
    tvaIntra: ''
  });
  let editing = $state(false);
  let saving = $state(false);
  let message = $state({ type: '', text: '' });
  let deleteAccountModalOpen = $state(false);
  let deleteAccountConfirmText = $state('');
  let deleteAccountLoading = $state(false);

  const logoField = createUrlField();
  const nomField = createTextField({ maxLength: 255 });
  const formeJuridiqueField = createTextField({ maxLength: 100 });
  const siretField = createSiretField({ maxLength: 20 });
  const rcsField = createTextField({ maxLength: 100 });
  const capitalField = createCapitalField({ maxLength: 100 });
  const siegeSocialField = createTextField({ maxLength: 255 });
  const tvaIntraField = createTvaIntraField({ maxLength: 30 });

  const logoStore = logoField.store;
  const nomStore = nomField.store;
  const formeJuridiqueStore = formeJuridiqueField.store;
  const siretStore = siretField.store;
  const rcsStore = rcsField.store;
  const capitalStore = capitalField.store;
  const siegeSocialStore = siegeSocialField.store;
  const tvaIntraStore = tvaIntraField.store;

  async function load() {
    try {
      societe = await getSociete(uid);
    } catch (e) {
      console.error(e);
      message = { type: 'error', text: 'Impossible de charger les données.' };
    }
  }
  load();

  function openEdit() {
    logoField.value = societe.logo ?? '';
    nomField.value = societe.nom ?? '';
    formeJuridiqueField.value = societe.formeJuridique ?? '';
    siretField.value = societe.siret ?? '';
    rcsField.value = societe.rcs ?? '';
    capitalField.value = societe.capital ?? '';
    siegeSocialField.value = societe.siegeSocial ?? '';
    tvaIntraField.value = societe.tvaIntra ?? '';
    editing = true;
    message = { type: '', text: '' };
  }

  function cancelEdit() {
    editing = false;
  }

  function openDeleteAccountModal() {
    deleteAccountConfirmText = '';
    deleteAccountModalOpen = true;
    message = { type: '', text: '' };
  }

  function closeDeleteAccountModal() {
    if (deleteAccountLoading) return;
    deleteAccountModalOpen = false;
  }

  async function confirmDeleteAccount(e) {
    e?.preventDefault?.();
    if (deleteAccountLoading) return;
    const txt = (deleteAccountConfirmText || '').trim().toUpperCase();
    if (txt !== 'SUPPRIMER') {
      message = { type: 'error', text: 'Pour confirmer, tapez exactement SUPPRIMER.' };
      return;
    }
    deleteAccountLoading = true;
    try {
      console.log('[donnees-personnelles] DELETE /auth/account — start');
      const res = await apiClient.delete('/auth/account');
      console.log('[donnees-personnelles] DELETE /auth/account — response', res?.status, res?.data);
      if (res?.data?.ok) {
        message = {
          type: 'success',
          text: 'Compte supprimé côté serveur. Vos données locales restent présentes sur cet appareil.'
        };
        deleteAccountModalOpen = false;
        // Redirection vers la page de connexion après un court délai.
        setTimeout(() => {
          console.log('[donnees-personnelles] redirect after account delete → /login');
          window.location.href = '/login';
        }, 800);
      } else {
        message = {
          type: 'error',
          text: 'La suppression du compte a échoué côté serveur.'
        };
      }
    } catch (err) {
      console.error('[donnees-personnelles] DELETE /auth/account — error', err);
      const apiError = err?.response?.data?.error || err?.message || 'Erreur lors de la suppression du compte.';
      message = { type: 'error', text: apiError };
    } finally {
      deleteAccountLoading = false;
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    const errors = [
      logoField.getError(),
      nomField.getError(),
      formeJuridiqueField.getError(),
      siretField.getError(),
      rcsField.getError(),
      capitalField.getError(),
      siegeSocialField.getError(),
      tvaIntraField.getError()
    ].filter(Boolean);
    if (errors.length > 0) {
      message = { type: 'error', text: errors[0] };
      return;
    }
    saving = true;
    try {
      await saveSociete(
        {
          logo: logoField.value,
          nom: nomField.value,
          formeJuridique: formeJuridiqueField.value,
          siret: siretField.value,
          rcs: rcsField.value,
          capital: capitalField.value,
          siegeSocial: siegeSocialField.value,
          tvaIntra: tvaIntraField.value
        },
        uid
      );
      societe = await getSociete(uid);
      editing = false;
      scheduleBackupUpload(uid);
      message = { type: 'success', text: 'Données enregistrées.' };
    } catch (err) {
      message = { type: 'error', text: err?.message || 'Erreur lors de l’enregistrement.' };
    } finally {
      saving = false;
    }
  }
</script>

<div class="donnees-module">
  <div class="donnees-header">
    <h2 class="donnees-title">Données personnelles</h2>
    <button type="button" class="btn-modifier" onclick={openEdit}>Modifier</button>
  </div>
  {#if message.text}
    <p class="form-message" class:success={message.type === 'success'} class:error={message.type === 'error'}>{message.text}</p>
  {/if}

  <section class="donnees-section donnees-section-account">
    <h3 class="section-label">Compte</h3>
    <p class="section-value">Adresse e-mail : {user?.email || '—'}</p>
  </section>

  <section class="donnees-section donnees-section-logo">
    <h3 class="section-label">Logo</h3>
    {#if societe.logo}
      <img src={societe.logo} alt="Logo de la société" class="logo-img" />
    {:else}
      <div class="logo-placeholder">Aucun logo</div>
    {/if}
  </section>

  <section class="donnees-section">
    <h3 class="section-label">Nom de société</h3>
    <p class="section-value">{societe.nom || '—'}</p>
  </section>

  <section class="donnees-section section-mentions">
    <h3 class="section-label">Mentions légales</h3>
    <dl class="mentions-list">
      <dt>Forme juridique</dt>
      <dd>{societe.formeJuridique || '—'}</dd>

      <dt>SIRET</dt>
      <dd>{societe.siret || '—'}</dd>

      <dt>RCS</dt>
      <dd>{societe.rcs || '—'}</dd>

      <dt>Capital social</dt>
      <dd>{societe.capital || '—'}</dd>

      <dt>Siège social</dt>
      <dd>{societe.siegeSocial || '—'}</dd>

      <dt>N° TVA intracommunautaire</dt>
      <dd>{societe.tvaIntra || '—'}</dd>
    </dl>
  </section>
</div>

<section class="donnees-danger">
  <h3 class="danger-title">Zone sensible</h3>
  <p class="danger-text">
    Supprimer votre compte sur le serveur effacera vos sauvegardes distantes, preuves et données associées côté backend.
    Vos données locales (IndexedDB, coffre-fort, fichiers exportés) ne seront pas supprimées.
  </p>
  <button type="button" class="btn-delete-account" onclick={openDeleteAccountModal}>
    Supprimer mon compte du serveur
  </button>
</section>

{#if editing}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-societe-title">
    <div class="modal">
      <h3 id="modal-societe-title" class="modal-title">Modifier les données personnelles</h3>
      <form class="societe-form" onsubmit={saveEdit}>
        <div class="form-row">
          <label for="edit-logo">URL du logo</label>
          <input id="edit-logo" type="url" value={$logoStore} oninput={(e) => logoField.value = e.target.value} placeholder="https://…" />
        </div>
        <div class="form-row">
          <label for="edit-nom">Nom de société</label>
          <input id="edit-nom" type="text" value={$nomStore} oninput={(e) => nomField.value = e.target.value} />
        </div>
        <div class="form-row">
          <label for="edit-forme">Forme juridique</label>
          <input id="edit-forme" type="text" value={$formeJuridiqueStore} oninput={(e) => formeJuridiqueField.value = e.target.value} placeholder="SARL, SAS, auto-entrepreneur…" />
        </div>
        <div class="form-row">
          <label for="edit-siret">SIRET</label>
          <input id="edit-siret" type="text" inputmode="numeric" value={$siretStore} oninput={(e) => siretField.value = e.target.value} placeholder="14 chiffres" />
        </div>
        <div class="form-row">
          <label for="edit-rcs">RCS</label>
          <input id="edit-rcs" type="text" value={$rcsStore} oninput={(e) => rcsField.value = e.target.value} placeholder="Ville + n°" />
        </div>
        <div class="form-row">
          <label for="edit-capital">Capital social</label>
          <input id="edit-capital" type="text" inputmode="decimal" value={$capitalStore} oninput={(e) => capitalField.value = e.target.value} placeholder="ex. 1 000 €" />
        </div>
        <div class="form-row">
          <label for="edit-siege">Siège social</label>
          <input id="edit-siege" type="text" value={$siegeSocialStore} oninput={(e) => siegeSocialField.value = e.target.value} placeholder="Adresse complète" />
        </div>
        <div class="form-row">
          <label for="edit-tva">N° TVA intracommunautaire</label>
          <input id="edit-tva" type="text" inputmode="numeric" value={$tvaIntraStore} oninput={(e) => tvaIntraField.value = e.target.value} placeholder="FR12345678901" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={cancelEdit}>Annuler</button>
          <button type="submit" class="btn-submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if deleteAccountModalOpen}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-delete-account-title">
    <div class="modal">
      <h3 id="modal-delete-account-title" class="modal-title">Supprimer mon compte du serveur</h3>
      <p class="danger-text">
        Cette action est <strong>définitive</strong>. Elle supprimera votre compte et vos données côté serveur.
        Vos données locales sur cet appareil resteront présentes.
      </p>
      <p class="danger-text">
        Pour confirmer, tapez <strong>SUPPRIMER</strong> dans le champ ci-dessous, puis validez.
      </p>
      <form onsubmit={confirmDeleteAccount} class="societe-form">
        <div class="form-row">
          <label for="delete-account-confirm">Confirmer</label>
          <input
            id="delete-account-confirm"
            type="text"
            value={deleteAccountConfirmText}
            oninput={(e) => (deleteAccountConfirmText = e.currentTarget.value)}
            placeholder="SUPPRIMER"
          />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={closeDeleteAccountModal} disabled={deleteAccountLoading}>
            Annuler
          </button>
          <button type="submit" class="btn-submit btn-submit-danger" disabled={deleteAccountLoading}>
            {deleteAccountLoading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .donnees-module {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 0;
    border: 2px solid var(--color-frame-form);
    border-radius: 8px;
    padding: 1rem;
  }
  .donnees-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .donnees-title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-primary);
    font-weight: 700;
  }
  .btn-modifier {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-primary);
    background: var(--color-bg-elevated);
    color: var(--color-primary);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-modifier:hover {
    background: var(--color-bg-muted);
  }
  .form-message {
    margin: 0;
    font-size: 0.9rem;
  }
  .form-message.success { color: var(--color-primary); }
  .form-message.error { color: var(--color-error); }
  .donnees-section {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-border);
  }
  .donnees-section:last-child {
    border-bottom: none;
  }
  .section-label {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-soft);
  }
  .section-value {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text);
  }
  .mentions-list {
    margin: 0;
    display: grid;
    gap: 0.35rem 1.5rem;
    grid-template-columns: auto 1fr;
    font-size: 0.9rem;
  }
  .mentions-list dt {
    margin: 0;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .mentions-list dd {
    margin: 0;
    color: var(--color-text);
  }
  .logo-img {
    max-width: 180px;
    max-height: 80px;
    object-fit: contain;
    display: block;
  }
  .logo-placeholder {
    width: 180px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-muted);
    border: 1px dashed var(--color-border-strong);
    border-radius: 8px;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .donnees-danger {
    margin-top: 1.25rem;
    border: 2px solid var(--color-error);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    background: var(--color-error-bg);
  }
  .danger-title {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-error);
  }
  .danger-text {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: var(--color-text);
  }
  .btn-delete-account {
    padding: 0.45rem 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--color-error);
    background: #ffffff;
    color: var(--color-error);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-delete-account:hover {
    background: #ffecec;
  }

  @media (max-width: 520px) {
    .donnees-module {
      padding: 0.75rem;
    }
    .mentions-list {
      grid-template-columns: 1fr;
      gap: 0.15rem 0;
    }
    .mentions-list dt {
      font-weight: 600;
    }
    .mentions-list dd {
      margin-bottom: 0.4rem;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .logo-img,
    .logo-placeholder {
      max-width: 100%;
      width: 100%;
    }
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    padding: 1rem;
  }
  .modal {
    background: var(--color-bg-elevated);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    max-width: 28rem;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    padding: 1.25rem;
  }
  .modal-title {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--color-text);
  }
  .societe-form .form-row {
    margin-bottom: 0.75rem;
  }
  .societe-form label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-soft);
    margin-bottom: 0.25rem;
  }
  .societe-form input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 0.95rem;
    box-sizing: border-box;
    background: var(--color-bg-elevated);
    color: var(--color-text);
  }
  .societe-form input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
  }
  .modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-cancel:hover {
    background: var(--color-bg-muted);
  }
  .btn-submit {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    background: var(--color-primary);
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-submit:hover {
    background: var(--color-primary-hover);
  }
  .btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-submit-danger {
    background: var(--color-error);
  }
  .btn-submit-danger:hover:not(:disabled) {
    background: #b91c1c;
  }
</style>
