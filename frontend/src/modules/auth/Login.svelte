<script>
  import { apiClient } from '$lib/apiClient.js';
  import { createEmailField, createPasswordField } from '$lib/formField.js';
  import { initEncryption } from '$lib/dbEncrypted.js';

  let { onSuccess, onError, onSwitchToRegister } = $props();

  const emailField = createEmailField();
  const passwordField = createPasswordField('', { autocomplete: 'current-password' });
  const emailStore = emailField.store;
  const passwordStore = passwordField.store;

  let error = $state('');
  let loading = $state(false);

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
        email: emailField.value,
        password
      });
      await initEncryption(password, (res.data?.user ?? res.data)?.id ?? null);
      onSuccess?.(res.data);
    } catch (e) {
      error = e.response?.data?.error || 'Erreur réseau';
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
    <input
      type="password"
      placeholder="Mot de passe"
      required
      disabled={loading}
      minlength={passwordField.minLength}
      maxlength={passwordField.maxLength}
      autocomplete={passwordField.autocomplete ?? undefined}
      value={$passwordStore}
      oninput={(e) => (passwordField.value = e.currentTarget.value)}
    />
    {#if error}<p class="error">{error}</p>{/if}
    <button type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Connexion'}</button>
  </form>
  <button type="button" class="link" onclick={switchView}>Créer un compte</button>
</div>

<style>
  .card {
    background: #f8fafc;
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
    border: 1px solid #e2e8f0;
    border-radius: 4px;
  }
  button[type="submit"] {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #0f766e;
    background: #0f766e;
    color: white;
    cursor: pointer;
  }
  button[type="submit"]:disabled { opacity: 0.7; cursor: not-allowed; }
  button.link { background: transparent; color: #0f766e; border: none; margin-top: 0.5rem; font-size: 0.9rem; cursor: pointer; }
  .error { color: #b91c1c; font-size: 0.9rem; margin: 0.5rem 0 0; }
</style>
