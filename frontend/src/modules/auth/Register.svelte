<script>
  /**
   * Module Inscription.
   */
  import { apiClient } from '$lib/apiClient.js';
  import {
    createEmailField,
    createPasswordField,
    createTextField
  } from '$lib/formField.js';

  let { onSuccess, onError, onSwitchToLogin } = $props();

  const emailField = createEmailField();
  const passwordField = createPasswordField('', { minLength: 8, autocomplete: 'new-password' });
  const prenomField = createTextField({ maxLength: 100, required: true, autocomplete: 'given-name' });
  const nomField = createTextField({ maxLength: 100, required: true, autocomplete: 'family-name' });
  const adresseField = createTextField({ maxLength: 255, required: false, autocomplete: 'street-address' });

  const emailStore = emailField.store;
  const passwordStore = passwordField.store;
  const prenomStore = prenomField.store;
  const nomStore = nomField.store;
  const adresseStore = adresseField.store;

  let error = $state('');
  let loading = $state(false);

  function getFirstError() {
    return (
      emailField.getError() ||
      passwordField.getError() ||
      prenomField.getError() ||
      nomField.getError() ||
      adresseField.getError()
    );
  }

  async function submit(e) {
    e.preventDefault();
    error = '';
    const firstError = getFirstError();
    if (firstError) {
      error = firstError;
      return;
    }
    loading = true;
    try {
      const res = await apiClient.post('/api/auth/register', {
        email: emailField.value,
        password: passwordField.value,
        prenom: prenomField.value,
        nom: nomField.value,
        adresse: adresseField.value || undefined
      });
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
    onSwitchToLogin?.();
  }
</script>

<div class="auth-container">
  <div class="auth-card card">
    <div class="card-header">
      <h2 class="auth-title">Inscription</h2>
      <p class="auth-subtitle">Créez votre compte pour commencer</p>
    </div>
    <div class="card-body">
      <form onsubmit={submit} class="auth-form">
        <div class="form-row">
          <div class="form-field">
            <label for="register-prenom" class="label">Prénom</label>
            <input
              id="register-prenom"
              type="text"
              class="input"
              placeholder="Jean"
              required
              disabled={loading}
              maxlength={prenomField.maxLength}
              autocomplete={prenomField.autocomplete ?? undefined}
              value={$prenomStore}
              oninput={(e) => (prenomField.value = e.currentTarget.value)}
            />
          </div>
          <div class="form-field">
            <label for="register-nom" class="label">Nom</label>
            <input
              id="register-nom"
              type="text"
              class="input"
              placeholder="Dupont"
              required
              disabled={loading}
              maxlength={nomField.maxLength}
              autocomplete={nomField.autocomplete ?? undefined}
              value={$nomStore}
              oninput={(e) => (nomField.value = e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="form-field">
          <label for="register-email" class="label">Adresse email</label>
          <input
            id="register-email"
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
          <label for="register-password" class="label">Mot de passe</label>
          <input
            id="register-password"
            type="password"
            class="input"
            placeholder="•••••••• (min. 8 caractères)"
            required
            disabled={loading}
            minlength={passwordField.minLength}
            maxlength={passwordField.maxLength}
            autocomplete={passwordField.autocomplete ?? undefined}
            value={$passwordStore}
            oninput={(e) => (passwordField.value = e.currentTarget.value)}
          />
        </div>
        <div class="form-field">
          <label for="register-adresse" class="label">Adresse <span class="optional">(optionnel)</span></label>
          <input
            id="register-adresse"
            type="text"
            class="input"
            placeholder="123 rue de la Paix, 75000 Paris"
            disabled={loading}
            maxlength={adresseField.maxLength}
            autocomplete={adresseField.autocomplete ?? undefined}
            value={$adresseStore}
            oninput={(e) => (adresseField.value = e.currentTarget.value)}
          />
        </div>
        {#if error}
          <div class="alert alert-error" role="alert">{error}</div>
        {/if}
        <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;" disabled={loading}>
          {loading ? 'Inscription en cours…' : "Créer mon compte"}
        </button>
      </form>
    </div>
    <div class="card-footer">
      <p class="auth-switch">Déjà un compte ? <button type="button" class="btn-ghost" onclick={switchView}>Se connecter</button></p>
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
    max-width: 480px;
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

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .optional {
    font-weight: var(--font-weight-normal);
    color: var(--color-neutral-500);
    font-size: var(--font-size-xs);
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

  @media (max-width: 640px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
