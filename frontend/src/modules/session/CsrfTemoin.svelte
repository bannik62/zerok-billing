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
    position: fixed;
    bottom: 0.75rem;
    right: 0.75rem;
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-family: system-ui, sans-serif;
    background: var(--color-bg-muted);
    color: var(--color-text-soft);
    border: 1px solid var(--color-border);
    z-index: 9999;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  .csrf-temoin-label { font-weight: 500; }
  .csrf-temoin-ok { color: var(--color-primary); }
  .csrf-temoin-err { color: var(--color-error); }
</style>
