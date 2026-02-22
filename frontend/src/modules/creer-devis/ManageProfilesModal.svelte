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
    background: var(--color-bg-elevated);
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
    color: var(--color-text);
  }
  .modal-empty {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
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
    border-bottom: 1px solid var(--color-border);
  }
  .profile-row:last-child {
    border-bottom: none;
  }
  .profile-name {
    flex: 1;
    font-size: 0.95rem;
    color: var(--color-text);
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
    border: 1px solid var(--color-border);
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
    background: var(--color-bg-muted);
    color: var(--color-text-soft);
    border-color: var(--color-border);
  }
  .btn-rename:hover {
    background: var(--color-border);
  }
  .btn-delete {
    background: var(--color-error-bg);
    color: var(--color-error);
    border-color: var(--color-error-bg);
  }
  .btn-delete:hover {
    background: var(--color-error-bg);
  }
  .btn-save {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  .btn-save:hover {
    background: var(--color-primary-hover);
  }
  .btn-cancel {
    background: var(--color-bg-elevated);
    color: var(--color-text-muted);
    border-color: var(--color-border);
  }
  .btn-cancel:hover {
    background: var(--color-bg-muted);
  }
  .modal-footer {
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }
  .btn-close {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text-soft);
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-close:hover {
    background: var(--color-bg-muted);
  }
</style>
