<script>
  import { createPasswordField } from '$lib/formField.js';
  import { initEncryption, getAllDevis, clearEncryptionKey } from '$lib/dbEncrypted.js';

  let { user = null } = $props();
  const passwordField = createPasswordField('', { autocomplete: 'current-password' });
  const passwordStore = passwordField.store;

  let error = $state('');
  let loading = $state(false);

  async function submit(e) {
    e.preventDefault();
    error = '';
    const pwdErr = passwordField.getError();
    if (pwdErr) {
      error = pwdErr;
      return;
    }
    loading = true;
    try {
      const password = passwordField.value;
      await initEncryption(password);
      await getAllDevis(user?.id ?? null);
    } catch {
      clearEncryptionKey();
      error = 'Mot de passe incorrect';
      return;
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-container">
  <div class="auth-card card">
    <div class="card-header">
      <h2 class="auth-title">Déverrouiller vos données</h2>
      <p class="auth-subtitle">Votre session est active. Entrez votre mot de passe pour déchiffrer vos données.</p>
    </div>
    <div class="card-body">
      <div class="alert alert-info" role="alert" style="margin-bottom: var(--space-4);">
        🔒 La clé de chiffrement a été effacée (rechargement de la page). Votre mot de passe est requis pour la regénérer.
      </div>
      <form onsubmit={submit} class="auth-form">
        <div class="form-field">
          <label for="unlock-password" class="label">Mot de passe</label>
          <input
            id="unlock-password"
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
          {loading ? 'Déverrouillage en cours…' : 'Déverrouiller'}
        </button>
      </form>
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
</style>
