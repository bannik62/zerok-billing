<script>
  /**
   * Modal « Mot de passe requis » : saisie + vérification.
   * onConfirm(password) doit retourner une Promise<boolean> (true = succès, fermer ; false = afficher erreur).
   */
  let {
    open = false,
    title = 'Mot de passe requis',
    message = 'Entrez votre mot de passe pour confirmer cette action.',
    submitLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    onConfirm = async () => false,
    onCancel = () => {}
  } = $props();

  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  function handleCancel() {
    password = '';
    error = '';
    onCancel();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    const pwd = (password || '').trim();
    if (!pwd) {
      error = 'Veuillez saisir votre mot de passe.';
      return;
    }
    loading = true;
    try {
      const ok = await onConfirm(pwd);
      if (ok) {
        password = '';
        error = '';
        onCancel();
      } else {
        error = 'Mot de passe incorrect';
      }
    } catch (_) {
      error = 'Mot de passe incorrect';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!open) {
      password = '';
      error = '';
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus a11y_no_noninteractive_element_interactions -->
  <div
    class="pwd-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pwd-modal-title"
    aria-describedby="pwd-modal-desc"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && handleCancel()}
    onkeydown={(e) => e.key === 'Escape' && handleCancel()}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="pwd-modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && handleCancel()}>
      <h3 id="pwd-modal-title" class="pwd-modal-title">{title}</h3>
      <p id="pwd-modal-desc" class="pwd-modal-message">{message}</p>
      <form onsubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Mot de passe"
          autocomplete="current-password"
          minlength="1"
          maxlength="128"
          bind:value={password}
          disabled={loading}
          class="pwd-modal-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'pwd-modal-error' : undefined}
        />
        {#if error}
          <p id="pwd-modal-error" class="pwd-modal-error">{error}</p>
        {/if}
        <div class="pwd-modal-actions">
          <button type="button" class="pwd-modal-cancel" onclick={handleCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="submit" class="pwd-modal-submit" disabled={loading}>
            {loading ? 'Vérification…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .pwd-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .pwd-modal {
    background: #fff;
    border-radius: 8px;
    padding: 1.25rem;
    min-width: 280px;
    max-width: 420px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .pwd-modal-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #0f172a;
  }
  .pwd-modal-message {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: #64748b;
    line-height: 1.4;
  }
  .pwd-modal-input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 1rem;
  }
  .pwd-modal-input:focus {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
  }
  .pwd-modal-input[aria-invalid="true"] {
    border-color: #b91c1c;
  }
  .pwd-modal-error {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: #b91c1c;
  }
  .pwd-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .pwd-modal-cancel {
    padding: 0.4rem 0.75rem;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #475569;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .pwd-modal-cancel:hover:not(:disabled) {
    background: #f1f5f9;
  }
  .pwd-modal-cancel:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .pwd-modal-submit {
    padding: 0.4rem 0.75rem;
    border: none;
    background: #0f766e;
    color: white;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .pwd-modal-submit:hover:not(:disabled) {
    background: #0d9488;
  }
  .pwd-modal-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
