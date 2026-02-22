<script>
  import Login from './modules/auth/Login.svelte';
  import Register from './modules/auth/Register.svelte';
  import Unlock from './modules/auth/Unlock.svelte';
  import SessionTemoin from './modules/session/SessionTemoin.svelte';
  import CsrfTemoin from './modules/session/CsrfTemoin.svelte';
  import CleTemoin from './modules/session/CleTemoin.svelte';
  import DatabaseTemoin from './modules/session/DatabaseTemoin.svelte';
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
    <h1>Zero-Knowledge Facturation</h1>
    <p class="tagline">Facturation local-first · Le serveur ne voit jamais le contenu de vos factures.</p>

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
  h1 { font-size: 1.5rem; color: #0f766e; }
  .tagline { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
</style>
