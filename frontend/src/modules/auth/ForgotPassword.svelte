<script>
  import { apiClient } from '$lib/apiClient.js';
  import { createEmailField, createPasswordField } from '$lib/formField.js';
  import { normalizePhrase } from '$lib/recoveryPhrase.js';
  import { deriveKey, saltFromBase64 } from '$lib/crypto/index.js';
  import { decrypt } from '$lib/crypto/aesGcm.js';

  let { onSwitchToLogin } = $props();

  const emailField = createEmailField();
  const newPasswordField = createPasswordField('', { minLength: 8, autocomplete: 'new-password' });
  const emailStore = emailField.store;
  const newPasswordStore = newPasswordField.store;

  let phraseInput = $state('');
  let error = $state('');
  let loading = $state(false);
  let success = $state(false);

  async function submit(e) {
    e.preventDefault();
    error = '';
    const emailErr = emailField.getError();
    const pwdErr = newPasswordField.getError();
    if (emailErr || pwdErr) {
      error = emailErr || pwdErr;
      return;
    }
    const phrase = normalizePhrase(phraseInput);
    const wordCount = phrase ? phrase.split(/\s+/).filter(Boolean).length : 0;
    if (wordCount < 12) {
      error = 'Saisissez les 12 mots de votre phrase de récupération (séparés par des espaces).';
      return;
    }
    loading = true;
    try {
      const email = emailField.value.trim();
      const res = await apiClient.get('/api/auth/recovery-data', { params: { email } });
      const { salt, keyCheck } = res.data;
      if (!salt || !keyCheck?.payload || !keyCheck?.iv) {
        error = 'Aucune donnée de récupération pour ce compte.';
        return;
      }
      const saltBytes = saltFromBase64(salt);
      const key = await deriveKey('', saltBytes, phrase);
      try {
        const dec = await decrypt(keyCheck, key);
        if (dec?.check !== 'zerok-ok') throw new Error('Invalid');
      } catch {
        error = 'La phrase de récupération ne correspond pas à ce compte. Vérifiez l\'ordre et l\'orthographe des 12 mots.';
        return;
      }
      const newPassword = newPasswordField.value;
      await apiClient.post('/api/auth/reset-password', { email, newPassword });
      success = true;
    } catch (e) {
      if (e.response?.status === 404) {
        error = e.response?.data?.error || 'Aucune donnée de récupération pour cet email.';
      } else if (e.response?.status === 429) {
        error = e.response?.data?.error || 'Trop de tentatives. Réessayez plus tard.';
      } else {
        error = e.response?.data?.error || 'Erreur réseau';
      }
    } finally {
      loading = false;
    }
  }

  function back() {
    error = '';
    success = false;
    onSwitchToLogin?.();
  }
</script>

<div class="forgot-module card">
  <h2>Réinitialiser mon mot de passe</h2>
  {#if success}
    <p class="success">Mot de passe réinitialisé. Vous pouvez vous connecter avec votre email et votre nouveau mot de passe.</p>
    <button type="button" class="btn-pri" onclick={back}>Retour à la connexion</button>
  {:else}
    <p class="explain">Saisissez l'email de votre compte, la phrase de récupération (12 mots enregistrée à l'inscription), puis choisissez un nouveau mot de passe.</p>
    <p class="hint">Les 12 mots doivent être saisis dans l'ordre, séparés par un espace. Accents et majuscules ne comptent pas.</p>
    <form onsubmit={submit}>
      <input
        type="email"
        placeholder="Email du compte"
        required
        disabled={loading}
        maxlength={emailField.maxLength}
        value={$emailStore}
        oninput={(e) => (emailField.value = e.currentTarget.value)}
      />
      <textarea
        placeholder="Les 12 mots de votre phrase de récupération (séparés par des espaces)"
        rows="3"
        disabled={loading}
        value={phraseInput}
        oninput={(e) => (phraseInput = e.currentTarget.value)}
      ></textarea>
      <input
        type="password"
        placeholder="Nouveau mot de passe"
        required
        disabled={loading}
        minlength={newPasswordField.minLength}
        maxlength={newPasswordField.maxLength}
        autocomplete="new-password"
        value={$newPasswordStore}
        oninput={(e) => (newPasswordField.value = e.currentTarget.value)}
      />
      {#if error}<p class="error">{error}</p>{/if}
      <button type="submit" disabled={loading}>{loading ? 'Vérification…' : 'Réinitialiser le mot de passe'}</button>
    </form>
    <button type="button" class="link" onclick={back}>Retour à la connexion</button>
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
  .explain, .hint { font-size: 0.9rem; color: var(--color-text-muted); margin: 0 0 0.75rem; line-height: 1.4; }
  .success { color: var(--color-primary); font-weight: 500; margin-bottom: 1rem; }
  input, textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }
  textarea { resize: vertical; min-height: 4rem; }
  button[type="submit"], .btn-pri {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: white;
    cursor: pointer;
  }
  button[type="submit"]:disabled, .btn-pri:disabled { opacity: 0.7; cursor: not-allowed; }
  button.link { background: transparent; color: var(--color-primary); border: none; margin-top: 0.5rem; font-size: 0.9rem; cursor: pointer; }
  .error { color: var(--color-error); font-size: 0.9rem; margin: 0.5rem 0 0; }
</style>
