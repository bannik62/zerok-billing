<script>
  import { apiClient } from '$lib/apiClient.js';
  import { createEmailField, createPasswordField } from '$lib/formField.js';
  import { initEncryption } from '$lib/dbEncrypted.js';
  import { syncAfterUnlock } from '$lib/backupSync.js';

  let { onSuccess, onError, onSwitchToRegister, onSwitchToForgot } = $props();

  const emailField = createEmailField();
  const passwordField = createPasswordField('', { autocomplete: 'current-password' });
  const emailStore = emailField.store;
  const passwordStore = passwordField.store;

  let error = $state('');
  let loading = $state(false);
  let showPassword = $state(false);

  async function submit(e) {
    e.preventDefault();
    error = '';
    const emailErr = emailField.getError();
    const pwdErr = passwordField.getError();
    if (emailErr || pwdErr) {
      error = emailErr || pwdErr;
      return;
    }
    loading = true;
    try {
      const password = passwordField.value;
      const res = await apiClient.post('/api/auth/login', {
        email: (emailField.value || '').trim(),
        password
      });
      const userId = (res.data?.user ?? res.data)?.id ?? null;
      await initEncryption(password, userId);
      if (userId) {
        await syncAfterUnlock(userId, password).catch(() => {});
      }
      onSuccess?.(res.data);
    } catch (e) {
      error = e.response?.data?.error || e?.message || 'Erreur réseau';
      onError?.(error);
    } finally {
      loading = false;
    }
  }

  function switchView() {
    error = '';
    onSwitchToRegister?.();
  }
</script>

<div class="login-module card">
  <h2>Connexion</h2>
  <form onsubmit={submit}>
    <input
      type="email"
      placeholder="Email"
      required
      disabled={loading}
      maxlength={emailField.maxLength}
      autocomplete={emailField.autocomplete ?? undefined}
      value={$emailStore}
      oninput={(e) => (emailField.value = e.currentTarget.value)}
    />
    <div class="password-wrap">
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder="Mot de passe"
        required
        disabled={loading}
        minlength={passwordField.minLength}
        maxlength={passwordField.maxLength}
        autocomplete={passwordField.autocomplete ?? undefined}
        value={$passwordStore}
        oninput={(e) => (passwordField.value = e.currentTarget.value)}
      />
      <button
        type="button"
        class="toggle-pwd"
        onclick={() => (showPassword = !showPassword)}
        disabled={loading}
        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {#if showPassword}
          <svg class="icon-eye" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        {:else}
          <svg class="icon-eye" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        {/if}
      </button>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <button type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Connexion'}</button>
  </form>
  <button type="button" class="link" onclick={switchView}>Créer un compte</button>
  {#if onSwitchToForgot}
    <button type="button" class="link forgot-link" onclick={onSwitchToForgot}>Mot de passe oublié ?</button>
  {/if}
</div>

<style>
  .card {
    background: var(--color-bg-muted);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .card h2 { margin: 0 0 1rem; font-size: 1.1rem; }
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }
  .password-wrap {
    position: relative;
    margin-bottom: 0.75rem;
  }
  .password-wrap input {
    margin-bottom: 0;
    padding-right: 2.5rem;
  }
  .password-wrap .toggle-pwd {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 2.5rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 0 4px 4px 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .password-wrap .toggle-pwd:hover:not(:disabled) {
    color: var(--color-text);
    background: var(--color-bg-muted);
  }
  .password-wrap .toggle-pwd:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .password-wrap .icon-eye {
    flex-shrink: 0;
  }
  button[type="submit"] {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: white;
    cursor: pointer;
  }
  button[type="submit"]:disabled { opacity: 0.7; cursor: not-allowed; }
  button.link { background: transparent; color: var(--color-primary); border: none; margin-top: 0.5rem; font-size: 0.9rem; cursor: pointer; }
  .error { color: var(--color-error); font-size: 0.9rem; margin: 0.5rem 0 0; }
</style>
