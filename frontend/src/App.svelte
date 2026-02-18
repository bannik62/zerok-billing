<script>
  import Login from './modules/auth/Login.svelte';
  import Register from './modules/auth/Register.svelte';
  import Unlock from './modules/auth/Unlock.svelte';
  import SessionTemoin from './modules/session/SessionTemoin.svelte';
  import CsrfTemoin from './modules/session/CsrfTemoin.svelte';
  import CleTemoin from './modules/session/CleTemoin.svelte';
  import Menu from './modules/menu/Menu.svelte';
  import { apiClient } from '$lib/apiClient.js';
  import { fetchCsrfToken } from '$lib/csrf.js';
  import { clearEncryptionKey, encryptionKeyLoadedStore } from '$lib/dbEncrypted.js';

  let user = $state(null);
  let loading = $state(true);
  let page = $state('auth');
  let view = $state('login');

  async function fetchUser() {
    try {
      const res = await apiClient.get('/api/auth/me');
      const data = res.data;
      if (data?.valid === true) {
        user = data.user;
        page = 'menu';
        fetchCsrfToken().catch(() => {});
      } else {
        user = null;
      }
    } catch {
      user = null;
    } finally {
      loading = false;
    }
  }

  fetchUser();

  function onLoginSuccess(data) {
    user = data;
    page = 'menu';
    fetchCsrfToken().catch(() => {});
  }

  function onRegisterSuccess(data) {
    user = data;
    page = 'menu';
    fetchCsrfToken().catch(() => {});
  }

  function logout() {
    apiClient.post('/api/auth/logout').catch(() => {});
    clearEncryptionKey();
    user = null;
    page = 'auth';
    view = 'login';
  }
</script>

<CsrfTemoin />
<CleTemoin />
{#if loading}
  <div class="app-loading">
    <div class="loading-spinner"></div>
    <p>Chargement de l'application…</p>
  </div>
{:else if page === 'menu'}
  {#if $encryptionKeyLoadedStore}
    <SessionTemoin content={Menu} {logout} onUnauthorized={() => { user = null; page = 'auth'; view = 'login'; }} />
  {:else}
    <Unlock user={user} />
  {/if}
{:else}
  <div class="app-welcome">
    <div class="app-brand">
      <div class="brand-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M12 18v-6"/>
          <path d="M9 15l3 3 3-3"/>
        </svg>
      </div>
      <div>
        <h1 class="brand-title">Zero-Knowledge Facturation</h1>
        <p class="brand-tagline">Facturation chiffrée · Confidentialité totale · Local-first</p>
      </div>
    </div>
  </div>
  {#if view === 'login'}
    <Login
      onSuccess={onLoginSuccess}
      onSwitchToRegister={() => { view = 'register'; }}
    />
  {:else}
    <Register
      onSuccess={onRegisterSuccess}
      onSwitchToLogin={() => { view = 'login'; }}
    />
  {/if}
{/if}

<style>
  .app-loading {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    color: var(--color-neutral-600);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-neutral-200);
    border-top-color: var(--color-primary-700);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .app-welcome {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: white;
    border-bottom: 1px solid var(--color-neutral-200);
    padding: var(--space-6) var(--space-4);
    z-index: 10;
  }

  .app-brand {
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .brand-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-700);
  }

  .brand-title {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary-700);
    line-height: var(--line-height-tight);
  }

  .brand-tagline {
    margin: var(--space-1) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-neutral-600);
    line-height: var(--line-height-tight);
  }

  @media (max-width: 640px) {
    .app-welcome {
      padding: var(--space-4);
    }

    .brand-icon {
      width: 40px;
      height: 40px;
    }

    .brand-icon svg {
      width: 32px;
      height: 32px;
    }

    .brand-title {
      font-size: var(--font-size-lg);
    }

    .brand-tagline {
      font-size: var(--font-size-xs);
    }
  }
</style>
