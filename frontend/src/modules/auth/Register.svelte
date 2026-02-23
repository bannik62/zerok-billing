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
  import { initEncryption } from '$lib/dbEncrypted.js';
  import { fetchWordlist, generateRecoveryPhrase } from '$lib/recoveryPhrase.js';
  import { deriveKey, generateSalt, saltToBase64, encrypt } from '$lib/crypto/index.js';

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
  let step = $state(1);
  let userData = $state(null);
  let passwordForPhrase = $state('');
  let recoveryPhrase = $state('');
  let phraseSaved = $state(false);
  let phraseLoading = $state(false);
  let phraseError = $state('');
  let copied = $state(false);

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
      const data = res.data;
      userData = data;
      passwordForPhrase = passwordField.value;
      const wordlist = await fetchWordlist();
      recoveryPhrase = generateRecoveryPhrase(wordlist);
      step = 2;
    } catch (e) {
      error = e.response?.data?.error || 'Erreur réseau';
      onError?.(error);
    } finally {
      loading = false;
    }
  }

  async function copyPhrase() {
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      phraseError = 'Copie impossible';
    }
  }

  async function confirmPhraseAndContinue() {
    if (!phraseSaved || !userData || !passwordForPhrase || !recoveryPhrase) return;
    phraseError = '';
    phraseLoading = true;
    try {
      await initEncryption(passwordForPhrase, userData.id, null);
      const recoverySalt = generateSalt(16);
      const keyRecovery = await deriveKey('', recoverySalt, recoveryPhrase);
      const keyCheckRecovery = await encrypt({ check: 'zerok-ok' }, keyRecovery);
      await apiClient.post('/api/auth/recovery-data', {
        salt: saltToBase64(recoverySalt),
        keyCheck: keyCheckRecovery
      });
      onSuccess?.(userData);
    } catch (e) {
      phraseError = e.response?.data?.error || e?.message || 'Erreur';
    } finally {
      phraseLoading = false;
    }
  }

  function switchView() {
    error = '';
    step = 1;
    userData = null;
    recoveryPhrase = '';
    phraseSaved = false;
    onSwitchToLogin?.();
  }
</script>

<div class="register-module card">
  {#if step === 1}
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
  {:else}
  <h2>Sauvegardez votre phrase de récupération</h2>
  <p class="explain">Si vous oubliez votre mot de passe, cette phrase vous permettra de récupérer l'accès à votre compte <strong>sans perdre vos données</strong>. Copiez-la et conservez-la dans un endroit sûr. Ne la partagez avec personne.</p>
  <p class="warn">Sans cette phrase, en cas d'oubli du mot de passe vos données chiffrées ne pourront pas être récupérées.</p>
  <div class="phrase-box">
    <code class="phrase">{recoveryPhrase}</code>
    <button type="button" class="btn-copy" onclick={copyPhrase}>{copied ? 'Copié !' : 'Copier la phrase'}</button>
  </div>
  <label class="checkbox-wrap"><input type="checkbox" bind:checked={phraseSaved} /><span>J'ai copié et sauvegardé ma phrase dans un endroit sûr.</span></label>
  <p class="reminder">Vous ne pourrez plus revoir cette phrase ici. En cas de mot de passe oublié, ressaisissez-la sur la page « Mot de passe oublié ».</p>
  {#if phraseError}<p class="error">{phraseError}</p>{/if}
  <button type="button" class="btn-continue" disabled={!phraseSaved || phraseLoading} onclick={confirmPhraseAndContinue}>{phraseLoading ? 'Enregistrement…' : 'Continuer'}</button>
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
  .explain, .warn, .reminder { font-size: 0.9rem; color: var(--color-text-muted); margin: 0 0 0.75rem; line-height: 1.4; }
  .warn { color: var(--color-error, #c00); }
  .phrase-box { margin: 1rem 0; padding: 1rem; background: var(--color-bg-elevated, #f5f5f5); border-radius: 6px; border: 1px solid var(--color-border); }
  .phrase { display: block; font-family: ui-monospace, monospace; font-size: 0.95rem; word-break: break-word; margin-bottom: 0.75rem; }
  .btn-copy {
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--color-border-strong);
    background: var(--color-bg-elevated);
    color: var(--color-text);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .btn-copy:hover { background: var(--color-bg-muted); }
  .checkbox-wrap {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.9rem;
    margin: 1rem 0;
    cursor: pointer;
  }
  .checkbox-wrap input { margin-top: 0.2rem; }
  .reminder { font-size: 0.85rem; }
  .btn-continue {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: white;
    cursor: pointer;
  }
  .btn-continue:disabled { opacity: 0.7; cursor: not-allowed; }
  input[type="text"],
  input[type="email"],
  input[type="password"] {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
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
