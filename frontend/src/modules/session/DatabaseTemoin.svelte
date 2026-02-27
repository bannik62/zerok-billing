<script>
  /**
   * Témoin serveur : bouton qui appelle GET /api/health (vérifie que le backend et sa DB répondent) et affiche le statut.
   */
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/apiClient.js';

  let status = $state('idle'); // 'idle' | 'loading' | 'ok' | 'none' | 'unavailable' | 'error'
  let label = $derived(
    status === 'idle' ? 'Serveur' :
    status === 'loading' ? 'Serveur…' :
    status === 'ok' ? 'Serveur ok' :
    status === 'none' ? 'Serveur (aucune)' :
    status === 'unavailable' ? 'Serveur indisponible' :
    'Serveur erreur'
  );

  async function checkHealth() {
    status = 'loading';
    try {
      const res = await apiClient.get('/api/health');
      const db = res.data?.db;
      if (db === 'ok') status = 'ok';
      else if (db === 'none') status = 'none';
      else if (db === 'unavailable') status = 'unavailable';
      else status = 'ok'; // ancien backend sans champ db
    } catch {
      status = 'error';
    }
  }

  onMount(() => {
    checkHealth();
  });
</script>

<div class="db-temoin" aria-live="polite" aria-label="État du serveur">
  <button
    type="button"
    class="db-temoin-btn"
    class:db-ok={status === 'ok'}
    class:db-err={status === 'unavailable' || status === 'error'}
    onclick={checkHealth}
    disabled={status === 'loading'}
  >
    {label}
  </button>
</div>

<style>
  .db-temoin {
    width: 100%;
    min-height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: stretch;
  }
  .db-temoin-btn {
    width: 100%;
    min-height: 2.5rem;
    padding: 0.5rem 0.6rem;
    border-radius: 8px;
    font-size: clamp(0.78rem, 2vw, 0.9rem);
    font-weight: 500;
    font-family: system-ui, sans-serif;
    box-sizing: border-box;
    background: var(--color-bg-elevated);
    color: var(--color-text-soft);
    border: 1px solid var(--color-border);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .db-temoin-btn:disabled {
    cursor: wait;
    opacity: 0.8;
  }
  .db-temoin-btn.db-ok { color: var(--color-primary); }
  .db-temoin-btn.db-err { color: var(--color-error); }
  @media (max-width: 380px) {
    .db-temoin, .db-temoin-btn { min-height: 2rem; font-size: 0.7rem; padding: 0.35rem 0.4rem; }
  }
</style>
