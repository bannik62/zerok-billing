<script>
  /**
   * Modal pour gérer les profils (renommer, supprimer).
   * Champ nom encapsulé (FormField) pour trim + maxLength.
   */
  import { createTextField } from '$lib/formField.js';

  let {
    open = false,
    profiles = [],
    onRename = () => {},
    onDelete = () => {},
    onClose = () => {}
  } = $props();

  let editingId = $state(null);
  const editingNameField = createTextField({ maxLength: 100 });
  const editingNameStore = editingNameField.store;

  function startRename(profile) {
    editingId = profile.id;
    editingNameField.value = profile.name ?? '';
  }

  function cancelRename() {
    editingId = null;
  }

  function submitRename() {
    const name = editingNameField.value;
    if (editingId && name) {
      onRename(editingId, name);
    }
    cancelRename();
  }

  function confirmDelete(profile) {
    if (confirm(`Supprimer le profil « ${profile.name } » ?`)) {
      onDelete(profile.id);
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="manage-profiles-title"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && (cancelRename(), onClose())}
    onkeydown={(e) => e.key === 'Escape' && (cancelRename(), onClose())}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal modal-manage" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && onClose()}>
      <h3 id="manage-profiles-title" class="modal-title">Gérer les profils</h3>
      {#if profiles.length === 0}
        <p class="modal-empty">Aucun profil enregistré.</p>
      {:else}
        <ul class="profile-list">
          {#each profiles as profile (profile.id)}
            <li class="profile-row">
              {#if editingId === profile.id}
                <form class="profile-edit-form" onsubmit={(e) => { e.preventDefault(); submitRename(); }}>
                  <input
                    type="text"
                    class="profile-edit-input"
                    aria-label="Nouveau nom"
                    value={$editingNameStore}
                    oninput={(e) => editingNameField.value = e.target.value}
                  />
                  <button type="submit" class="btn-small btn-save">OK</button>
                  <button type="button" class="btn-small btn-cancel" onclick={cancelRename}>Annuler</button>
                </form>
              {:else}
                <span class="profile-name">{profile.name}</span>
                <div class="profile-actions">
                  <button type="button" class="btn-small btn-rename" onclick={() => startRename(profile)}>Renommer</button>
                  <button type="button" class="btn-small btn-delete" onclick={() => confirmDelete(profile)}>Supprimer</button>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
      <div class="modal-footer">
        <button type="button" class="btn-close" onclick={onClose}>Fermer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal.modal-manage {
    background: #fff;
    border-radius: 8px;
    padding: 1.25rem;
    min-width: 320px;
    max-width: 420px;
    max-height: 80vh;
    overflow: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .modal-title {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #0f172a;
  }
  .modal-empty {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: #64748b;
  }
  .profile-list {
    list-style: none;
    margin: 0 0 1rem 0;
    padding: 0;
  }
  .profile-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .profile-row:last-child {
    border-bottom: none;
  }
  .profile-name {
    flex: 1;
    font-size: 0.95rem;
    color: #0f172a;
    min-width: 0;
  }
  .profile-actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .profile-edit-form {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 1;
    min-width: 0;
  }
  .profile-edit-input {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
    min-width: 0;
  }
  .btn-small {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .btn-rename {
    background: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
  }
  .btn-rename:hover {
    background: #e2e8f0;
  }
  .btn-delete {
    background: #fef2f2;
    color: #b91c1c;
    border-color: #fecaca;
  }
  .btn-delete:hover {
    background: #fee2e2;
  }
  .btn-save {
    background: #0f766e;
    color: white;
    border-color: #0f766e;
  }
  .btn-save:hover {
    background: #0d9488;
  }
  .btn-cancel {
    background: #fff;
    color: #64748b;
    border-color: #e2e8f0;
  }
  .btn-cancel:hover {
    background: #f8fafc;
  }
  .modal-footer {
    padding-top: 0.75rem;
    border-top: 1px solid #e2e8f0;
  }
  .btn-close {
    padding: 0.4rem 0.75rem;
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #475569;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-close:hover {
    background: #f8fafc;
  }
</style>
