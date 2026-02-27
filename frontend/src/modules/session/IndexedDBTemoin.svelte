<script>
  /**
   * Témoin IndexedDB : vérifie que le stockage local (navigateur) est disponible et affiche le statut.
   */
  import { onMount } from 'svelte';

  const HEALTH_DB = '_zerok_idb_health_';

  let status = $state('idle'); // 'idle' | 'loading' | 'ok' | 'error'
  let label = $derived(
    status === 'idle' ? 'IndexedDB' :
    status === 'loading' ? 'IndexedDB…' :
    status === 'ok' ? 'IndexedDB ok' :
    'IndexedDB indisponible'
  );

  function checkIndexedDB() {
    if (typeof indexedDB === 'undefined') {
      status = 'error';
      return;
    }
    status = 'loading';
    const req = indexedDB.open(HEALTH_DB, 1);
    req.onsuccess = () => {
      req.result.close();
      try {
        indexedDB.deleteDatabase(HEALTH_DB);
      } catch (_) {}
      status = 'ok';
    };
    req.onerror = () => { status = 'error'; };
    req.onblocked = () => { status = 'error'; };
  }

  onMount(() => {
    checkIndexedDB();
  });
</script>

<div class="idb-temoin" aria-live="polite" aria-label="État d'IndexedDB">
  <button
    type="button"
    class="idb-temoin-btn"
    class:idb-ok={status === 'ok'}
    class:idb-err={status === 'error'}
    onclick={checkIndexedDB}
    disabled={status === 'loading'}
  >
    {label}
  </button>
</div>

<style>
  .idb-temoin {
    width: 100%;
    min-height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: stretch;
  }
  .idb-temoin-btn {
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
  .idb-temoin-btn:disabled {
    cursor: wait;
    opacity: 0.8;
  }
  .idb-temoin-btn.idb-ok { color: var(--color-primary); }
  .idb-temoin-btn.idb-err { color: var(--color-error); }
  @media (max-width: 380px) {
    .idb-temoin, .idb-temoin-btn { min-height: 2.25rem; font-size: 0.75rem; padding: 0.45rem 0.5rem; }
  }
</style>
