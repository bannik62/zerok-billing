<script>
  import Login from './modules/auth/Login.svelte';
  import Register from './modules/auth/Register.svelte';
  import ForgotPassword from './modules/auth/ForgotPassword.svelte';
  import Unlock from './modules/auth/Unlock.svelte';
  import SessionTemoin from './modules/session/SessionTemoin.svelte';
  import CsrfTemoin from './modules/session/CsrfTemoin.svelte';
  import CleTemoin from './modules/session/CleTemoin.svelte';
  import DatabaseTemoin from './modules/session/DatabaseTemoin.svelte';
  import Menu from './modules/menu/Menu.svelte';
  import { apiClient } from '$lib/apiClient.js';
  import { fetchCsrfToken } from '$lib/csrf.js';
  import { clearEncryptionKey, encryptionKeyLoadedStore } from '$lib/dbEncrypted.js';
  import { themeStore, toggleTheme } from '$lib/theme.js';

  let user = $state(null);
  let loading = $state(true);
  let page = $state('auth');
  let view = $state('login');

  async function fetchUser() {
    await fetchCsrfToken().catch(() => null);
    try {
      const res = await apiClient.get('/api/auth/me');
      const data = res.data;
      if (data?.valid === true) {
        await fetchCsrfToken().catch(() => null);
        user = data.user;
        page = 'menu';
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

  async function onLoginSuccess(data) {
    await fetchCsrfToken().catch(() => null);
    user = data;
    page = 'menu';
  }

  async function onRegisterSuccess(data) {
    await fetchCsrfToken().catch(() => null);
    user = data;
    page = 'menu';
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
<DatabaseTemoin />
<main class:fullscreen={page === 'menu'}>
  {#if loading}
    <p class="loading">Chargement…</p>
  {:else if page === 'menu'}
    {#if $encryptionKeyLoadedStore}
      <SessionTemoin content={Menu} {logout} onUnauthorized={() => { user = null; page = 'auth'; view = 'login'; }} />
    {:else}
      <Unlock user={user} onLogout={logout} />
    {/if}
  {:else}
    <div class="auth-header">
      <h1>Zero-Knowledge Facturation</h1>
      <button type="button" class="btn-theme" onclick={toggleTheme} aria-label={$themeStore === 'dark' ? 'Passer en mode jour' : 'Passer en mode nuit'}>
        {$themeStore === 'dark' ? '☀ Jour' : '☽ Nuit'}
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
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }
  main.fullscreen {
    max-width: none;
    width: 100%;
    margin: 0;
    min-height: 100vh;
    box-sizing: border-box;
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
</style>
