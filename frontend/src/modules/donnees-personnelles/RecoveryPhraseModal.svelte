<script>
  import Modal from '$lib/Modal.svelte';
  import { fetchWordlist, generateRecoveryPhrase } from '$lib/recoveryPhrase.js';
  import { initEncryption } from '$lib/dbEncrypted.js';
  import { deriveKey, generateSalt, saltToBase64, encrypt } from '$lib/crypto/index.js';
  import { apiClient } from '$lib/apiClient.js';
  import { createPasswordField } from '$lib/formField.js';

  let {
    open = false,
    user = null,
    isReplacing = false,
    onClose = null,
    onPhraseSaved = null
  } = $props();

  let recoveryPhrase = $state('');
  let phraseSaved = $state(false);
  let phraseSubmitLoading = $state(false);
  let phraseWordlistLoading = $state(false);
  let phraseError = $state('');
  let phraseCopied = $state(false);

  const phrasePasswordField = createPasswordField('', { autocomplete: 'current-password' });
  const phrasePasswordStore = phrasePasswordField.store;

  async function loadPhrase() {
    phraseError = '';
    phraseSaved = false;
    recoveryPhrase = '';
    phraseWordlistLoading = true;
    phraseCopied = false;
    phrasePasswordField.value = '';
    try {
      const wordlist = await fetchWordlist();
      recoveryPhrase = generateRecoveryPhrase(wordlist);
    } catch (e) {
      phraseError = 'Impossible de charger la liste de mots.';
    } finally {
      phraseWordlistLoading = false;
    }
  }

  $effect(() => {
    if (open) {
      loadPhrase();
    }
  });

  async function copyPhrase() {
    try {
      await navigator.clipboard.writeText(recoveryPhrase);
      phraseCopied = true;
      setTimeout(() => (phraseCopied = false), 2000);
    } catch {
      phraseError = 'Copie impossible';
    }
  }

  async function confirmPhraseSave(e) {
    e?.preventDefault?.();
    if (!phraseSaved || !user?.id || !recoveryPhrase || phraseSubmitLoading) return;
    const pwd = phrasePasswordField.value;
    if (phrasePasswordField.getError() || !pwd) {
      phraseError = 'Entrez votre mot de passe.';
      return;
    }
    phraseError = '';
    phraseSubmitLoading = true;
    try {
      await initEncryption(pwd, user.id, null);
      const recoverySalt = generateSalt(16);
      const keyRecovery = await deriveKey('', recoverySalt, recoveryPhrase);
      const keyCheckRecovery = await encrypt({ check: 'zerok-ok' }, keyRecovery);
      await apiClient.post('/api/auth/recovery-data', {
        salt: saltToBase64(recoverySalt),
        keyCheck: keyCheckRecovery
      });
      onPhraseSaved?.();
      onClose?.();
    } catch (err) {
      phraseError = err?.response?.data?.error || err?.message || 'Erreur lors de l’enregistrement.';
    } finally {
      phraseSubmitLoading = false;
    }
  }
</script>

<Modal {open} labelledBy="modal-phrase-title">
  <h3 id="modal-phrase-title" class="modal-title">
    {isReplacing ? 'Remplacer la phrase de récupération' : 'Sauvegarder une phrase de récupération'}
  </h3>
  <p class="phrase-modal-explain">
    Si vous oubliez votre mot de passe, cette phrase vous permettra de récupérer l’accès à votre compte sans perdre vos données.
    Copiez-la et conservez-la dans un endroit sûr. Ne la partagez avec personne.
  </p>
  {#if isReplacing}
    <p class="phrase-modal-warn">L’ancienne phrase ne permettra plus de récupérer le compte.</p>
  {/if}
  {#if phraseWordlistLoading}
    <p class="muted">Génération de la phrase…</p>
  {:else}
    <div class="phrase-box">
      <code class="phrase">{recoveryPhrase}</code>
      <button type="button" class="btn-copy" onclick={copyPhrase}>{phraseCopied ? 'Copié !' : 'Copier la phrase'}</button>
    </div>
    <label class="checkbox-wrap">
      <input type="checkbox" bind:checked={phraseSaved} />
      <span>J’ai copié et sauvegardé ma phrase dans un endroit sûr.</span>
    </label>
    <label for="phrase-modal-password" class="password-label">Mot de passe (pour enregistrer la phrase)</label>
    <input
      id="phrase-modal-password"
      type="password"
      placeholder="Votre mot de passe"
      disabled={phraseSubmitLoading}
      minlength={phrasePasswordField.minLength}
      maxlength={phrasePasswordField.maxLength}
      value={$phrasePasswordStore}
      oninput={(e) => (phrasePasswordField.value = e.currentTarget.value)}
    />
    {#if phraseError}<p class="phrase-error">{phraseError}</p>{/if}
    <div class="modal-actions">
      <button type="button" class="btn-cancel" onclick={onClose} disabled={phraseSubmitLoading}>Annuler</button>
      <button type="button" class="btn-submit" disabled={!phraseSaved || phraseSubmitLoading} onclick={confirmPhraseSave}>
        {phraseSubmitLoading ? 'Enregistrement…' : 'Enregistrer la phrase'}
      </button>
    </div>
  {/if}
</Modal>

<style>
  .phrase-modal-explain,
  .phrase-modal-warn {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0 0 0.75rem;
    line-height: 1.4;
  }
  .phrase-modal-warn {
    color: var(--color-error, #c00);
  }
  .phrase-box {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--color-bg-muted);
    border-radius: 6px;
    border: 1px solid var(--color-border);
  }
  .phrase-box .phrase {
    display: block;
    font-family: ui-monospace, monospace;
    font-size: 0.95rem;
    word-break: break-word;
    margin-bottom: 0.75rem;
  }
  .phrase-box .btn-copy {
    padding: 0.35rem 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--color-border-strong);
    background: var(--color-bg-elevated);
    font-size: 0.9rem;
    cursor: pointer;
  }
  .checkbox-wrap {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.9rem;
    margin: 1rem 0;
    cursor: pointer;
  }
  .checkbox-wrap input {
    margin-top: 0.2rem;
  }
  .password-label {
    display: block;
    font-size: 0.9rem;
    margin: 1rem 0 0.25rem;
  }
  .phrase-error {
    color: var(--color-error);
    font-size: 0.9rem;
    margin: 0.5rem 0 0;
  }
  .muted {
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
</style>


