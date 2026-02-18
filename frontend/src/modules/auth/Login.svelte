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
      await initEncryption(password);
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

<div class="auth-container">
  <div class="auth-card card">
    <div class="card-header">
      <h2 class="auth-title">Connexion</h2>
      <p class="auth-subtitle">Accédez à votre espace facturation sécurisé</p>
    </div>
    <div class="card-body">
      <form onsubmit={submit} class="auth-form">
        <div class="form-field">
          <label for="login-email" class="label">Adresse email</label>
          <input
            id="login-email"
            type="email"
            class="input"
            placeholder="votre@email.com"
            required
            disabled={loading}
            maxlength={emailField.maxLength}
            autocomplete={emailField.autocomplete ?? undefined}
            value={$emailStore}
            oninput={(e) => (emailField.value = e.currentTarget.value)}
          />
        </div>
        <div class="form-field">
          <label for="login-password" class="label">Mot de passe</label>
          <input
            id="login-password"
            type="password"
            class="input"
            placeholder="••••••••"
            required
            disabled={loading}
            minlength={passwordField.minLength}
            maxlength={passwordField.maxLength}
            autocomplete={passwordField.autocomplete ?? undefined}
            value={$passwordStore}
            oninput={(e) => (passwordField.value = e.currentTarget.value)}
          />
        </div>
        {#if error}
          <div class="alert alert-error" role="alert">{error}</div>
        {/if}
        <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;" disabled={loading}>
          {loading ? 'Connexion en cours…' : 'Se connecter'}
        </button>
      </form>
    </div>
    <div class="card-footer">
      <p class="auth-switch">Pas encore de compte ? <button type="button" class="btn-ghost" onclick={switchView}>Créer un compte</button></p>
    </div>
  </div>
</div>

<style>
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-neutral-100) 100%);
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
  }

  .auth-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary-700);
  }

  .auth-subtitle {
    margin: var(--space-2) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--color-neutral-600);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .auth-switch {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--color-neutral-600);
  }

  .auth-switch .btn-ghost {
    padding: 0;
    color: var(--color-primary-700);
    font-weight: var(--font-weight-medium);
  }

  .auth-switch .btn-ghost:hover {
    text-decoration: underline;
    background: transparent;
  }
</style>
