<script>
  /**
   * Modal pour enregistrer la mise en page actuelle comme profil (template).
   * Rôle : présentation uniquement ; le parent gère la persistance.
   * Champ nom encapsulé (FormField) pour trim + maxLength.
   */
  import { createTextField } from '$lib/formField.js';

  let {
    open = false,
    name = $bindable(''),
    onSave = () => {},
    onCancel = () => {}
  } = $props();

  const nameField = createTextField({ maxLength: 100 });
  const nameStore = nameField.store;

  $effect(() => {
    if (open) nameField.value = name ?? '';
  });

  function handleSubmit(e) {
    e.preventDefault();
    const v = nameField.value;
    if (v) {
      name = v;
      onSave();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="save-profile-title"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && onCancel()}
    onkeydown={(e) => e.key === 'Escape' && onCancel()}
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && onCancel()}>
      <h3 id="save-profile-title" class="modal-title">Enregistrer comme profil</h3>
      <p class="modal-desc">La disposition et les styles des blocs seront enregistrés pour les réutiliser sur d'autres devis.</p>
      <form class="modal-form" onsubmit={handleSubmit}>
        <label for="profile-name">Nom du profil</label>
        <input
          id="profile-name"
          type="text"
          placeholder="Ex. Devis standard"
          value={$nameStore}
          oninput={(e) => nameField.value = e.target.value}
        />
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={onCancel}>Annuler</button>
          <button type="submit" class="btn-submit" disabled={!nameField.value}>Enregistrer</button>
        </div>
      </form>
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
    z-index: var(--z-modal);
  }
  .modal {
    background: var(--color-bg-elevated);
    border-radius: 8px;
    padding: 1.25rem;
    min-width: 280px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .modal-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text);
  }
  .modal-desc {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .modal-form label {
    display: block;
    font-size: 0.85rem;
    color: var(--color-text-soft);
    margin-bottom: 0.35rem;
  }
  .modal-form input {
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 0.9rem;
    box-sizing: border-box;
    margin-bottom: 1rem;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .btn-cancel {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text-soft);
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-cancel:hover {
    background: var(--color-bg-muted);
  }
  .btn-submit {
    padding: 0.4rem 0.75rem;
    border: none;
    background: var(--color-primary);
    color: white;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-submit:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }
  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
