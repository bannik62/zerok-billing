<script>
  import { createPasswordField } from '$lib/formField.js';
  import { initEncryption, getAllDevis, clearEncryptionKey } from '$lib/dbEncrypted.js';

  let { user = null, onLogout = () => {} } = $props();
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
      await initEncryption(password, user?.id ?? null);
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

<div class="unlock-module card">
  <h2>Déverrouiller vos données</h2>
  <p class="hint">La session est active mais la clé de chiffrement a été perdue (rechargement). Entrez votre mot de passe pour la recréer.</p>
  <form onsubmit={submit}>
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
    <div class="actions">
      <button type="submit" disabled={loading}>{loading ? 'Déverrouillage…' : 'Déverrouiller'}</button>
      <button type="button" class="btn-logout" disabled={loading} onclick={onLogout}>Déconnexion</button>
    </div>
  </form>
</div>

<style>
  .card {
    background: #f8fafc;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  .hint {
    color: #64748b;
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
  }
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  button {
    width: 100%;
    padding: 0.6rem;
    background: #0f766e;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-logout {
    background: transparent;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }
  .btn-logout:hover:not(:disabled) {
    background: #f1f5f9;
    color: #475569;
  }
  .error {
    color: #b91c1c;
    font-size: 0.9rem;
    margin: 0 0 0.75rem 0;
  }
</style>
