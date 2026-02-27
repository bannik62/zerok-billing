<script>
  /**
   * Témoin CSRF : charge le token au montage et affiche un indicateur "CSRF chargé" dans l'interface.
   */
  import { onMount } from 'svelte';
  import { csrfStore, fetchCsrfToken } from '$lib/csrf.js';

  onMount(() => {
    fetchCsrfToken().catch(() => {});
  });
</script>

<div class="csrf-temoin" aria-live="polite" aria-label="État du token CSRF">
  {#if !$csrfStore.loaded}
    <span class="csrf-temoin-label">CSRF…</span>
  {:else if $csrfStore.token}
    <span class="csrf-temoin-label csrf-temoin-ok">CSRF chargé</span>
  {:else}
    <span class="csrf-temoin-label csrf-temoin-err">CSRF indisponible</span>
  {/if}
</div>

<style>
  .csrf-temoin {
    width: 100%;
    min-height: 2.5rem;
    padding: 0.5rem 0.6rem;
    border-radius: 8px;
    font-size: clamp(0.78rem, 2vw, 0.9rem);
    font-family: system-ui, sans-serif;
    background: var(--color-bg-elevated);
    color: var(--color-text-soft);
    border: 1px solid var(--color-border);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  @media (max-width: 380px) {
    .csrf-temoin { min-height: 2.25rem; font-size: 0.75rem; padding: 0.45rem 0.5rem; }
  }
  .csrf-temoin-label { font-weight: 500; }
  .csrf-temoin-ok { color: var(--color-primary); }
  .csrf-temoin-err { color: var(--color-error); }
</style>
