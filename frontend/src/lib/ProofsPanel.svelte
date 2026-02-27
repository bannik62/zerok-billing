<script>
  /**
   * Encart réutilisable « Preuves (intégrité) » : liste d’items avec label, hash et statut
   * (conforme / différent / en attente). Utilisé par ListeDocuments (devis/factures), Achats et
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
    {@const devisItems = items.filter((i) => i.documentType === 'devis')}
    {@const factureItems = items.filter((i) => i.documentType === 'facture')}
    {@const achatItems = items.filter((i) => i.documentType === 'achat')}
    {@const otherItems = items.filter((i) => i.documentType !== 'devis' && i.documentType !== 'facture' && i.documentType !== 'achat')}
    <div class="proofs-sections">
      {#if devisItems.length > 0}
        <section class="proofs-section" aria-label="Preuves devis">
          <h4 class="proofs-section-title">Devis</h4>
          <ul class="proofs-list">
            {#each devisItems as item (item.id)}
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
        </section>
      {/if}
      {#if factureItems.length > 0}
        <section class="proofs-section" aria-label="Preuves factures">
          <h4 class="proofs-section-title">Factures</h4>
          <ul class="proofs-list">
            {#each factureItems as item (item.id)}
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
        </section>
      {/if}
      {#if achatItems.length > 0}
        <section class="proofs-section" aria-label="Preuves achats">
          <h4 class="proofs-section-title">Achats</h4>
          <ul class="proofs-list">
            {#each achatItems as item (item.id)}
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
        </section>
      {/if}
      {#if otherItems.length > 0}
        <section class="proofs-section" aria-label="Preuves orphelines">
          <h4 class="proofs-section-title">Autres</h4>
          <ul class="proofs-list">
            {#each otherItems as item (item.id)}
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
        </section>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .proofs-panel {
    flex: 0 0 280px;
    min-width: 240px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    background: var(--color-bg-muted);
  }
  .proofs-title {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: var(--color-primary);
  }
  .proofs-hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0 0 0.75rem 0;
  }
  .proofs-error {
    color: var(--color-error);
    font-size: 0.85rem;
    margin: 0;
  }
  .proofs-empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: 0;
  }
  .proofs-sections {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .proofs-section {
    margin: 0;
  }
  .proofs-section-title {
    margin: 0 0 0.35rem 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
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
    border-bottom: 1px solid var(--color-border);
    font-size: 0.8rem;
  }
  .proof-item:last-child {
    border-bottom: none;
  }
  .proof-label {
    flex: 0 0 100%;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .proof-hash {
    font-size: 0.75rem;
    background: var(--color-border);
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    color: var(--color-text-soft);
  }
  .proof-status {
    font-size: 0.75rem;
    font-weight: 500;
  }
  .proof-ok {
    color: var(--color-primary);
  }
  .proof-diff {
    color: var(--color-error);
  }
  .proof-pending {
    color: var(--color-text-muted);
  }
  .proof-delete-btn {
    flex: 0 0 100%;
    margin-top: 0.25rem;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    color: var(--color-error);
    background: transparent;
    border: 1px solid var(--color-error-bg);
    border-radius: 4px;
    cursor: pointer;
  }
  .proof-delete-btn:hover:not(:disabled) {
    background: var(--color-error-bg);
  }
  .proof-delete-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
