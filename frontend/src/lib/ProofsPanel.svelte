<script>
  /**
   * Encart réutilisable « Preuves (intégrité) » : liste d’items avec label, hash et statut
   * (conforme / différent / en attente). Utilisé par ListeDocuments (devis/factures) et
   * CoffreFort (documents). Les données et labels sont préparés par le parent.
   */
  let {
    title = 'Preuves (intégrité)',
    hint = 'Hash enregistrés côté serveur. Comparaison avec le hash local (IndexedDB).',
    error = '',
    items = [],
    verifiedMap = {},
    verifiedLoading = false,
    ariaLabel = 'Preuves — comparaison hash local / backend',
    onDeleteFromServer = null,
    deletingProofId = null
  } = $props();

  const HASH_DISPLAY_LEN = 12;
</script>

<aside class="proofs-panel" aria-label={ariaLabel}>
  <h3 class="proofs-title">{title}</h3>
  <p class="proofs-hint">{hint}</p>
  {#if error}
    <p class="proofs-error">{error}</p>
  {:else if items.length === 0}
    <p class="proofs-empty">Aucune preuve enregistrée.</p>
  {:else}
    <ul class="proofs-list">
      {#each items as item (item.id)}
        <li class="proof-item">
          <span class="proof-label" title={item.id}>{item.label}</span>
          <code class="proof-hash" title={item.hash}>{item.hash ? item.hash.slice(0, HASH_DISPLAY_LEN) + '…' : '—'}</code>
          {#if verifiedLoading && verifiedMap[item.id] === undefined}
            <span class="proof-status proof-pending" title="Vérification…">—</span>
          {:else if verifiedMap[item.id] === true}
            <span class="proof-status proof-ok" title="Hash local = hash backend">✓ conforme</span>
          {:else}
            <span class="proof-status proof-diff" title="Hash local ≠ hash backend">✗ différent</span>
          {/if}
          {#if item.isOrphan && onDeleteFromServer}
            <button
              type="button"
              class="proof-delete-btn"
              title="Document supprimé en local — supprimer la preuve sur le serveur"
              disabled={deletingProofId === item.id}
              onclick={() => onDeleteFromServer(item.id)}
            >
              {deletingProofId === item.id ? '…' : 'Supprimer du serveur'}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .proofs-panel {
    flex: 0 0 280px;
    min-width: 240px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    background: #f8fafc;
  }
  .proofs-title {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #0f766e;
  }
  .proofs-hint {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0 0 0.75rem 0;
  }
  .proofs-error {
    color: #b91c1c;
    font-size: 0.85rem;
    margin: 0;
  }
  .proofs-empty {
    color: #64748b;
    font-size: 0.9rem;
    margin: 0;
  }
  .proofs-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .proof-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.8rem;
  }
  .proof-item:last-child {
    border-bottom: none;
  }
  .proof-label {
    flex: 0 0 100%;
    font-weight: 500;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .proof-hash {
    font-size: 0.75rem;
    background: #e2e8f0;
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    color: #475569;
  }
  .proof-status {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .proof-ok {
    color: #15803d;
  }
  .proof-diff {
    color: #b91c1c;
  }
  .proof-pending {
    color: #94a3b8;
  }
  .proof-delete-btn {
    flex: 0 0 100%;
    margin-top: 0.25rem;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    color: #b91c1c;
    background: transparent;
    border: 1px solid #fecaca;
    border-radius: 4px;
    cursor: pointer;
  }
  .proof-delete-btn:hover:not(:disabled) {
    background: #fef2f2;
  }
  .proof-delete-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
