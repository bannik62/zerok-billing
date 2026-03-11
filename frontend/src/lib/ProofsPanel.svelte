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
  const DEFAULT_DELETE_TITLE = 'Document supprimé en local — supprimer la preuve sur le serveur';
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
    {@const documentItems = items.filter((i) => i.documentType === 'document')}
    {@const otherItems = items.filter(
      (i) =>
        i.documentType !== 'devis' &&
        i.documentType !== 'facture' &&
        i.documentType !== 'achat' &&
        i.documentType !== 'document'
    )}
    {@const sections = [
      { key: 'devis', label: 'Devis', aria: 'Preuves devis', items: devisItems, deleteTitle: DEFAULT_DELETE_TITLE },
      { key: 'factures', label: 'Factures', aria: 'Preuves factures', items: factureItems, deleteTitle: DEFAULT_DELETE_TITLE },
      { key: 'achats', label: 'Achats', aria: 'Preuves achats', items: achatItems, deleteTitle: DEFAULT_DELETE_TITLE },
      {
        key: 'documents',
        label: 'Documents',
        aria: 'Preuves documents coffre-fort',
        items: documentItems,
        deleteTitle: 'Preuve orpheline — supprimer la preuve sur le serveur'
      },
      { key: 'autres', label: 'Autres', aria: 'Preuves orphelines', items: otherItems, deleteTitle: DEFAULT_DELETE_TITLE }
    ]}
    <div class="proofs-sections">
      {#each sections as section (section.key)}
        {#if section.items.length > 0}
          <section class="proofs-section" aria-label={section.aria}>
            <h4 class="proofs-section-title">{section.label}</h4>
            <ul class="proofs-list">
              {#each section.items as item (item.id)}
                <li class="proof-item">
                  <span class="proof-label" title={item.id}>{item.label}</span>
                  <code class="proof-hash" title={item.hash}>
                    {item.hash ? item.hash.slice(0, HASH_DISPLAY_LEN) + '…' : '—'}
                  </code>
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
                      title={section.deleteTitle}
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
      {/each}
    </div>
  {/if}
</aside>

<style>
  .proofs-panel {
    flex: 0 0 320px;
    min-width: 260px;
    border: 2px solid var(--color-frame-proof);
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
    max-height: 70vh;
    overflow-y: auto;
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

  @media (max-width: 1100px) {
    .proofs-panel {
      flex: 1 1 100%;
      min-width: 0;
      width: 100%;
      max-width: 720px;
      margin-left: auto;
      margin-right: auto;
      box-sizing: border-box;
    }
    .proof-label {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }
</style>
