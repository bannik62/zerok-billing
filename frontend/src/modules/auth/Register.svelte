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

<div class="register-module card">
  <h2>Inscription</h2>
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
    <input
      type="text"
      placeholder="Prénom"
      required
      disabled={loading}
      maxlength={prenomField.maxLength}
      autocomplete={prenomField.autocomplete ?? undefined}
      value={$prenomStore}
      oninput={(e) => (prenomField.value = e.currentTarget.value)}
    />
    <input
      type="text"
      placeholder="Nom"
      required
      disabled={loading}
      maxlength={nomField.maxLength}
      autocomplete={nomField.autocomplete ?? undefined}
      value={$nomStore}
      oninput={(e) => (nomField.value = e.currentTarget.value)}
    />
    <input
      type="text"
      placeholder="Adresse (optionnel)"
      disabled={loading}
      maxlength={adresseField.maxLength}
      autocomplete={adresseField.autocomplete ?? undefined}
      value={$adresseStore}
      oninput={(e) => (adresseField.value = e.currentTarget.value)}
    />
    {#if error}<p class="error">{error}</p>{/if}
    <button type="submit" disabled={loading}>{loading ? 'Inscription…' : "S'inscrire"}</button>
  </form>
  <button type="button" class="link" onclick={switchView}>Déjà un compte ? Connexion</button>
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
