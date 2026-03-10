<script>
  import Login from './modules/auth/Login.svelte';
  import Register from './modules/auth/Register.svelte';
  import ForgotPassword from './modules/auth/ForgotPassword.svelte';
  import VerifyEmail from './modules/auth/VerifyEmail.svelte';
  import SetupRecoveryPhrase from './modules/auth/SetupRecoveryPhrase.svelte';
  import Unlock from './modules/auth/Unlock.svelte';
  import SignConfirm from './modules/auth/SignConfirm.svelte';
  import SessionTemoin from './modules/session/SessionTemoin.svelte';
  import CsrfTemoin from './modules/session/CsrfTemoin.svelte';
  import CleTemoin from './modules/session/CleTemoin.svelte';
  import DatabaseTemoin from './modules/session/DatabaseTemoin.svelte';
  import IndexedDBTemoin from './modules/session/IndexedDBTemoin.svelte';
  import Menu from './modules/menu/Menu.svelte';
  import { apiClient } from '$lib/apiClient.js';
  import { fetchCsrfToken } from '$lib/csrf.js';
  import { clearEncryptionKey, encryptionKeyLoadedStore } from '$lib/dbEncrypted.js';
  import { clearBackupPassword, syncResultStore, syncReadyStore } from '$lib/backupSync.js';
  import { serverUpdateAvailableStore, startBackupVersionPolling, stopBackupVersionPolling } from '$lib/backupVersion.js';
  import { startEventsStream, stopEventsStream } from '$lib/eventsClient.js';

  function dismissSyncBanners() {
    syncResultStore.set(null);
  }
  import { themeStore, toggleTheme } from '$lib/theme.js';

  let user = $state(null);
  let loading = $state(true);
  let page = $state('auth');
  let view = $state('login');
  let tokenFromUrl = $state('');

  function init() {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      if (path === '/sign/confirm' && t) {
        tokenFromUrl = t;
        page = 'signConfirm';
        loading = false;
        return;
      }
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    fetchUser();
  }

  async function fetchUser() {
    await fetchCsrfToken().catch(() => null);
    try {
      const res = await apiClient.get('/api/auth/me');
      const data = res.data;
      if (data?.valid === true) {
        await fetchCsrfToken().catch(() => null);
        user = data.user;
        page = 'menu';
        startBackupVersionPolling();
        startEventsStream();
      } else {
        user = null;
        page = 'auth';
        view = 'login';
        clearEncryptionKey();
        clearBackupPassword();
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        user = null;
        page = 'auth';
        view = 'login';
        clearEncryptionKey();
        clearBackupPassword();
      }
      user = null;
    } finally {
      loading = false;
    }
  }

  async function ensureSessionStillValid() {
    if (page !== 'menu') return;
    try {
      const res = await apiClient.get('/api/auth/me');
      if (!res?.data?.valid) {
        logout();
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
      }
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      ensureSessionStillValid();
    }
  }

  init();

  async function onLoginSuccess(data) {
    await fetchCsrfToken().catch(() => null);
    user = data;
    // Si l'utilisateur n'a pas encore de phrase de récupération, on s'assure qu'elle soit configurée.
    if (user?.hasRecoveryData === false) {
      page = 'auth';
      view = 'setupPhrase';
    } else {
      page = 'menu';
      startBackupVersionPolling();
      startEventsStream();
    }
  }

  async function onRegisterSuccess(data) {
    await fetchCsrfToken().catch(() => null);
    user = data;
    if (data?.emailVerified === false) {
      page = 'auth';
      view = 'verifyEmail';
    } else {
      page = 'menu';
      startBackupVersionPolling();
      startEventsStream();
    }
  }

  async function onEmailVerified() {
    await fetchUser();
    if (user?.emailVerified !== false) {
      if (user?.hasRecoveryData === false) {
        view = 'setupPhrase';
      } else {
        page = 'menu';
        startBackupVersionPolling();
        startEventsStream();
      }
    }
  }

  function onSetupPhraseDone() {
    fetchUser().then(() => {
      if (user?.hasRecoveryData !== false) {
        page = 'menu';
        startBackupVersionPolling();
        startEventsStream();
      }
    });
  }

  function logout() {
    apiClient.post('/api/auth/logout').catch(() => {});
    clearEncryptionKey();
    clearBackupPassword();
    stopBackupVersionPolling();
    stopEventsStream();
    user = null;
    page = 'auth';
    view = 'login';
  }
</script>

<nav class="temoin-bar" aria-label="État de l’application">
  <CsrfTemoin />
  <CleTemoin />
  <DatabaseTemoin />
  <IndexedDBTemoin />
</nav>
<main class:fullscreen={page === 'menu'}>
  {#if loading}
    <p class="loading">Chargement…</p>
  {:else if page === 'signConfirm'}
    <SignConfirm token={tokenFromUrl} />
  {:else if page === 'menu'}
    {#if $encryptionKeyLoadedStore && !$syncReadyStore}
      <p class="loading">Synchronisation avec le serveur témoin…</p>
    {:else if $encryptionKeyLoadedStore}
      {#if $serverUpdateAvailableStore}
        <div class="sync-banner sync-banner-update" role="status">
          <span>Des données ont été mises à jour sur le serveur témoin (autre poste). Recharger pour synchroniser.</span>
          <button
            type="button"
            class="sync-banner-dismiss"
            onclick={() => { serverUpdateAvailableStore.set(false); }}
            aria-label="Ignorer pour l’instant"
          >
            Plus tard
          </button>
          <button
            type="button"
            class="sync-banner-refresh"
            onclick={() => {
              if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.setItem('zerok-skip-put-after-restore-once', '1');
              }
              window.location.reload();
            }}
          >
            Recharger maintenant
          </button>
        </div>
      {/if}
      {#if $syncResultStore === 'unchanged'}
        <div class="sync-banner sync-banner-ok" role="status">
          <span>La base locale est à jour avec le serveur témoin.</span>
          <button type="button" class="sync-banner-dismiss" onclick={dismissSyncBanners} aria-label="Fermer">Fermer</button>
        </div>
      {:else if $syncResultStore === 'restored_empty'}
        <div class="sync-banner sync-banner-restored" role="status">
          <span>La base de données a été récupérée depuis le serveur témoin.</span>
          <button type="button" class="sync-banner-dismiss" onclick={dismissSyncBanners} aria-label="Fermer">Fermer</button>
        </div>
      {:else if $syncResultStore === 'restored_overwritten'}
        <div class="sync-banner sync-banner-restored" role="status">
          <span>La base locale a été reconstituée depuis le serveur témoin (données différentes).</span>
          <button type="button" class="sync-banner-dismiss" onclick={dismissSyncBanners} aria-label="Fermer">Fermer</button>
        </div>
      {:else if $syncResultStore === 'backup_error'}
        <div class="sync-banner sync-banner-error" role="alert">
          <span>La restauration locale a réussi, mais la mise à jour du backup serveur a échoué. Vérifiez votre connexion.</span>
          <button type="button" class="sync-banner-dismiss" onclick={dismissSyncBanners} aria-label="Fermer">Fermer</button>
        </div>
      {/if}
      <SessionTemoin content={Menu} {logout} onUnauthorized={() => { user = null; page = 'auth'; view = 'login'; }} />
    {:else}
      <Unlock user={user} onLogout={logout} />
    {/if}
  {:else}
    <div class="auth-header">
      <h1>Zero-Knowledge Facturation</h1>
      <button type="button" class="btn-theme" onclick={toggleTheme} aria-label={$themeStore === 'dark' ? 'Passer en mode jour' : 'Passer en mode nuit'}>
        {$themeStore === 'dark' ? 'Jour ☀' : 'Nuit ☽'}
      </button>
    </div>
    <p class="tagline">Facturation local-first · Le serveur ne voit jamais le contenu de vos factures.</p>

    {#if view === 'login'}
      <Login
        onSuccess={onLoginSuccess}
        onSwitchToRegister={() => { view = 'register'; }}
        onSwitchToForgot={() => { view = 'forgotPassword'; }}
      />
    {:else if view === 'forgotPassword'}
      <ForgotPassword onSwitchToLogin={async () => { await fetchCsrfToken().catch(() => null); view = 'login'; }} />
    {:else if view === 'verifyEmail'}
      <VerifyEmail
        {user}
        onVerified={onEmailVerified}
        onLogout={logout}
      />
    {:else if view === 'setupPhrase'}
      <SetupRecoveryPhrase
        {user}
        onDone={onSetupPhraseDone}
        onLogout={logout}
      />
    {:else}
      <Register
        onSuccess={onRegisterSuccess}
        onSwitchToLogin={() => { view = 'login'; }}
      />
    {/if}
  {/if}
</main>

<style>
  main {
    max-width: 420px;
    margin: 2rem auto;
    padding: 0 1rem 3.5rem 1rem;
    font-family: system-ui, sans-serif;
  }
  main.fullscreen {
    max-width: none;
    width: 100%;
    margin: 0;
    min-height: 100vh;
    box-sizing: border-box;
    padding-bottom: 3.5rem; /* même réserve en bas que la barre témoins */
  }
  .loading { margin: 2rem 0; }
  .auth-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  h1 { font-size: 1.5rem; color: var(--color-primary); margin: 0; }
  .btn-theme {
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--color-border-strong);
    background: var(--color-bg-elevated);
    color: var(--color-text);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-theme:hover {
    background: var(--color-bg-muted);
  }
  .tagline { color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; }

  .temoin-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: stretch;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: var(--color-bg-muted);
    border-top: 1px solid var(--color-border);
    z-index: var(--z-critical);
    box-sizing: border-box;
  }
  .temoin-bar > :global(*) {
    flex: 1 1 0;
    min-width: 5rem;
    min-height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: stretch;
  }
  :global(.temoin-bar > * > *) {
    width: 100%;
    min-width: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  @media (max-width: 380px) {
    .temoin-bar { padding: 0.5rem 0.5rem; gap: 0.4rem; }
    .temoin-bar > :global(*) { min-width: 4rem; min-height: 2.25rem; }
  }

  .sync-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    flex-wrap: wrap;
  }
  .sync-banner-update {
    background: #e0f2fe;
    color: #0f172a;
    border-bottom: 1px solid #38bdf8;
  }
  .sync-banner-ok {
    background: var(--color-bg-muted);
    color: var(--color-text);
    border-bottom: 1px solid var(--color-border);
  }
  .sync-banner-restored {
    background: var(--color-primary);
    color: white;
  }
  .sync-banner-error {
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #b91c1c);
    border-bottom: 1px solid var(--color-error, #b91c1c);
  }
  .sync-banner-error .sync-banner-dismiss {
    background: var(--color-bg-elevated);
    color: var(--color-error);
    border: 1px solid var(--color-error);
  }
  .sync-banner-dismiss {
    flex-shrink: 0;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .sync-banner-refresh {
    flex-shrink: 0;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.85rem;
    border: 1px solid #0369a1;
    background: #0ea5e9;
    color: white;
  }
  .sync-banner-ok .sync-banner-dismiss {
    background: var(--color-bg-elevated);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  .sync-banner-restored .sync-banner-dismiss {
    background: rgba(255, 255, 255, 0.25);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.5);
  }
  .sync-banner-dismiss:hover {
    opacity: 0.9;
  }
</style>
