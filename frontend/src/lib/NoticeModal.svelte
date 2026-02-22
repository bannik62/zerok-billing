<script>
  /**
   * Modal informatif réutilisable : titre + message + un bouton OK.
   * Pas d’annuler — le parent exécute l’action (ex. enregistrer + rediriger) dans onOk.
   */
  let {
    open = false,
    title = 'Information',
    message = '',
    okLabel = 'OK',
    onOk = () => {}
  } = $props();

  function handleOk() {
    onOk();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus a11y_no_noninteractive_element_interactions -->
  <div
    class="notice-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="notice-modal-title"
    aria-describedby="notice-modal-desc"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && handleOk()}
    onkeydown={(e) => e.key === 'Escape' && handleOk()}
  >
    <div class="notice-modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && handleOk()}>
      <h3 id="notice-modal-title" class="notice-modal-title">{title}</h3>
      <p id="notice-modal-desc" class="notice-modal-message">{message}</p>
      <div class="notice-modal-actions">
        <button type="button" class="notice-modal-ok" onclick={handleOk}>{okLabel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .notice-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .notice-modal {
    background: #fff;
    border-radius: 8px;
    padding: 1.25rem;
    min-width: 280px;
    max-width: 420px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .notice-modal-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #0f172a;
  }
  .notice-modal-message {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: #64748b;
    line-height: 1.4;
  }
  .notice-modal-actions {
    display: flex;
    justify-content: flex-end;
  }
  .notice-modal-ok {
    padding: 0.4rem 0.75rem;
    border: none;
    background: #0f766e;
    color: white;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .notice-modal-ok:hover {
    background: #0d9488;
  }
</style>
