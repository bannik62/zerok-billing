<script>
  /**
   * Écran « Sauvegardez votre phrase de récupération » affiché après validation email
   * (compte vérifié mais pas encore de données recovery).
   */
  import { apiClient } from '$lib/apiClient.js';
  import { createPasswordField } from '$lib/formField.js';
  import { initEncryption } from '$lib/dbEncrypted.js';
  import { fetchWordlist, generateRecoveryPhrase } from '$lib/recoveryPhrase.js';
  import { deriveKey, generateSalt, saltToBase64, encrypt } from '$lib/crypto/index.js';

  let { user = null, onDone, onLogout } = $props();

  const passwordField = createPasswordField('', { autocomplete: 'current-password' });
  const passwordStore = passwordField.store;

  let recoveryPhrase = $state('');
  let phraseSaved = $state(false);
  let loading = $state(false);
  let loadingPhrase = $state(true);
  let error = $state('');
  let copied = $state(false);

  $effect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchWordlist()
      .then((wordlist) => {
        if (cancelled) return;
        recoveryPhrase = generateRecoveryPhrase(wordlist);
      })
      .catch(() => {
        if (!cancelled) error = 'Impossible de charger la liste de mots.';
      })
      .finally(() => {
        if (!cancelled) loadingPhrase = false;
      });
    return () => { cancelled = true; };
  });

  async function copyPhrase() {
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      error = 'Copie impossible';
    }
  }

  async function confirm() {
    if (!phraseSaved || !user?.id || !recoveryPhrase) return;
    const pwd = passwordField.value;
    if (passwordField.getError() || !pwd) {
      error = 'Entrez votre mot de passe.';
      return;
    }
    error = '';
    loading = true;
    try {
      await initEncryption(pwd, user.id, null);
      const recoverySalt = generateSalt(16);
      const keyRecovery = await deriveKey('', recoverySalt, recoveryPhrase);
      const keyCheckRecovery = await encrypt({ check: 'zerok-ok' }, keyRecovery);
      await apiClient.post('/api/auth/recovery-data', {
        salt: saltToBase64(recoverySalt),
        keyCheck: keyCheckRecovery
      });
      onDone?.();
    } catch (e) {
      error = e.response?.data?.error || e?.message || 'Erreur';
    } finally {
      loading = false;
    }
  }
</script>

<div class="setup-phrase card">
  <h2>Sauvegardez votre phrase de récupération</h2>
  <p class="explain">
    Si vous oubliez votre mot de passe, cette phrase vous permettra de récupérer l'accès à votre compte
    <strong>sans perdre vos données</strong>. Copiez-la et conservez-la dans un endroit sûr. Ne la partagez avec personne.
  </p>
  <p class="warn">Sans cette phrase, en cas d'oubli du mot de passe vos données chiffrées ne pourront pas être récupérées.</p>

  {#if loadingPhrase}
    <p class="muted">Génération de la phrase…</p>
  {:else}
    <div class="phrase-box">
      <code class="phrase">{recoveryPhrase}</code>
      <button type="button" class="btn-copy" onclick={copyPhrase}>{copied ? 'Copié !' : 'Copier la phrase'}</button>
    </div>
    <label class="checkbox-wrap">
      <input type="checkbox" bind:checked={phraseSaved} />
      <span>J'ai copié et sauvegardé ma phrase dans un endroit sûr.</span>
    </label>
    <p class="reminder">Vous ne pourrez plus revoir cette phrase ici. En cas de mot de passe oublié, ressaisissez-la sur la page « Mot de passe oublié ».</p>

    <label class="password-label">Mot de passe (pour enregistrer la phrase)</label>
    <input
      type="password"
      placeholder="Votre mot de passe"
      disabled={loading}
      minlength={passwordField.minLength}
      maxlength={passwordField.maxLength}
      value={$passwordStore}
      oninput={(e) => (passwordField.value = e.currentTarget.value)}
    />

    {#if error}<p class="error">{error}</p>{/if}
    <button type="button" class="btn-continue" disabled={!phraseSaved || loading} onclick={confirm}>
      {loading ? 'Enregistrement…' : 'Continuer'}
    </button>
  {/if}

  {#if onLogout}
    <button type="button" class="link link-muted" onclick={onLogout}>Se déconnecter</button>
  {/if}
</div>

<style>
  .card {
    background: var(--color-bg-muted);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .card h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
  .explain, .warn, .reminder { font-size: 0.9rem; color: var(--color-text-muted); margin: 0 0 0.75rem; line-height: 1.4; }
  .warn { color: var(--color-error, #c00); }
  .muted { font-size: 0.9rem; color: var(--color-text-muted); }
  .phrase-box { margin: 1rem 0; padding: 1rem; background: var(--color-bg-elevated, #f5f5f5); border-radius: 6px; border: 1px solid var(--color-border); }
  .phrase { display: block; font-family: ui-monospace, monospace; font-size: 0.95rem; word-break: break-word; margin-bottom: 0.75rem; }
  .btn-copy {
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--color-border-strong);
    background: var(--color-bg-elevated);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .checkbox-wrap { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.9rem; margin: 1rem 0; cursor: pointer; }
  .checkbox-wrap input { margin-top: 0.2rem; }
  .reminder { font-size: 0.85rem; }
  .password-label { display: block; font-size: 0.9rem; margin: 1rem 0 0.25rem; }
  input[type="password"] {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }
  .btn-continue {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: white;
    cursor: pointer;
  }
  .btn-continue:disabled { opacity: 0.7; cursor: not-allowed; }
  .error { color: var(--color-error); font-size: 0.9rem; margin: 0.5rem 0 0; }
  button.link { background: transparent; border: none; margin-top: 0.75rem; font-size: 0.9rem; cursor: pointer; }
  button.link-muted { color: var(--color-text-muted); }
</style>
