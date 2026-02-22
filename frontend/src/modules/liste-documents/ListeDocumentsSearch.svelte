<script>
  /** Champ de recherche pour filtrer devis et factures. */
  let { controlsFields = null, maxLength = 200 } = $props();
  const searchStore = controlsFields?.searchStore ?? null;
</script>

{#if searchStore}
  <div class="liste-search-wrap">
    <label for="liste-search" class="liste-search-label">Rechercher</label>
    <input
      id="liste-search"
      type="search"
      class="liste-search-input"
      placeholder="N°, client, objet, date, montant…"
      value={$searchStore}
      oninput={(e) => (controlsFields.searchQuery = e.currentTarget.value)}
      maxlength={maxLength}
      aria-label="Filtrer devis et factures"
    />
  </div>
{/if}

<style>
  .liste-search-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .liste-search-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #475569;
  }
  .liste-search-input {
    flex: 1;
    max-width: 20rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .liste-search-input:focus {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
  }
  .liste-search-input::placeholder {
    color: #94a3b8;
  }
</style>
