<script>
  /**
   * Témoin base de données : bouton qui appelle GET /api/health et affiche "Database ok" (ou autre statut).
   */
  import { apiClient } from '$lib/apiClient.js';

  let status = $state('idle'); // 'idle' | 'loading' | 'ok' | 'none' | 'unavailable' | 'error'
  let label = $derived(
    status === 'idle' ? 'Database' :
    status === 'loading' ? 'Database…' :
    status === 'ok' ? 'Database ok' :
    status === 'none' ? 'Database (aucune)' :
    status === 'unavailable' ? 'Database indisponible' :
    'Database erreur'
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
</script>

<div class="db-temoin" aria-live="polite" aria-label="État de la base de données">
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
    position: fixed;
    bottom: 4.75rem;
    right: 0.75rem;
    z-index: 9999;
  }
  .db-temoin-btn {
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    font-family: system-ui, sans-serif;
    background: var(--color-bg-muted);
    color: var(--color-text-soft);
    border: 1px solid var(--color-border);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    cursor: pointer;
  }
  .db-temoin-btn:hover:not(:disabled) {
    background: var(--color-border);
  }
  .db-temoin-btn:disabled {
    cursor: wait;
    opacity: 0.8;
  }
  .db-temoin-btn.db-ok { color: var(--color-primary); }
  .db-temoin-btn.db-err { color: var(--color-error); }
</style>
