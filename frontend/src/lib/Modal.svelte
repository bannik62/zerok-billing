<script>
  let { open = false, labelledBy = null } = $props();
</script>

{#if open}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? undefined}>
    <div class="modal">
      <slot />
    </div>
  </div>
{/if}

<style>
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
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
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

