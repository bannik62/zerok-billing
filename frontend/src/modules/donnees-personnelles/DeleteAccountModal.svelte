<script>
  import Modal from '$lib/Modal.svelte';

  let {
    open = false,
    confirmText = '',
    loading = false,
    onConfirm = null,
    onClose = null,
    onInputConfirm = null
  } = $props();
</script>

<Modal {open} labelledBy="modal-delete-account-title">
  <h3 id="modal-delete-account-title" class="modal-title">Supprimer mon compte du serveur</h3>
  <p class="danger-text">
    Cette action est <strong>définitive</strong>. Elle supprimera votre compte et vos données côté serveur.
    Vos données locales sur cet appareil resteront présentes.
  </p>
  <p class="danger-text">
    Pour confirmer, tapez <strong>SUPPRIMER</strong> dans le champ ci-dessous, puis validez.
  </p>
  <form onsubmit={onConfirm} class="societe-form">
    <div class="form-row">
      <label for="delete-account-confirm">Confirmer</label>
      <input
        id="delete-account-confirm"
        type="text"
        value={confirmText}
        oninput={(e) => onInputConfirm?.(e.currentTarget.value)}
        placeholder="SUPPRIMER"
      />
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-cancel" onclick={onClose} disabled={loading}>
        Annuler
      </button>
      <button type="submit" class="btn-submit btn-submit-danger" disabled={loading}>
        {loading ? 'Suppression…' : 'Supprimer définitivement'}
      </button>
    </div>
  </form>
</Modal>

