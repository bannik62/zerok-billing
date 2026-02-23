<script>
  import { apiClient } from '$lib/apiClient.js';

  let { user = null, onVerified, onLogout } = $props();

  let code = $state('');
  let error = $state('');
  let loading = $state(false);
  let resendLoading = $state(false);
  let resendSuccess = $state('');

  async function submit(e) {
    e.preventDefault();
    error = '';
    resendSuccess = '';
    const trimmed = code.replace(/\s/g, '');
    if (!trimmed || trimmed.length !== 6) {
      error = 'Entrez le code à 6 chiffres reçu par email.';
      return;
    }
    loading = true;
    try {
      await apiClient.post('/api/auth/verify-email', { code: trimmed });
      onVerified?.();
    } catch (e) {
      error = e.response?.data?.error || e?.message || 'Code invalide ou expiré.';
    } finally {
      loading = false;
    }
  }

  async function resend() {
    error = '';
    resendSuccess = '';
    resendLoading = true;
    try {
      await apiClient.post('/api/auth/resend-verification');
      resendSuccess = 'Un nouveau code a été envoyé à votre adresse email.';
    } catch (e) {
      error = e.response?.data?.error || e?.message || 'Impossible d\'envoyer le code.';
    } finally {
      resendLoading = false;
    }
  }
</script>

<div class="verify-module card">
  <h2>Vérifiez votre email</h2>
  <p class="hint">
    Nous avons envoyé un code à 6 chiffres à <strong>{user?.email ?? ''}</strong>. Entrez-le ci-dessous pour accéder à votre compte.
  </p>
  <form onsubmit={submit}>
    <input
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="6"
      placeholder="000000"
      autocomplete="one-time-code"
      value={code}
      oninput={(e) => (code = e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
      disabled={loading}
    />
    {#if error}<p class="error">{error}</p>{/if}
    {#if resendSuccess}<p class="success">{resendSuccess}</p>{/if}
    <button type="submit" disabled={loading || code.length !== 6}>
      {loading ? 'Vérification…' : 'Valider'}
    </button>
  </form>
  <button type="button" class="link" onclick={resend} disabled={resendLoading}>
    {resendLoading ? 'Envoi…' : 'Renvoyer le code'}
  </button>
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
  .hint {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0 0 1rem;
  }
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 1.25rem;
    letter-spacing: 0.25em;
    text-align: center;
  }
  button[type="submit"] {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: white;
    cursor: pointer;
    width: 100%;
  }
  button[type="submit"]:disabled { opacity: 0.7; cursor: not-allowed; }
  button.link {
    display: block;
    margin-top: 0.75rem;
    background: transparent;
    border: none;
    color: var(--color-primary);
    font-size: 0.9rem;
    cursor: pointer;
  }
  button.link:disabled { opacity: 0.7; cursor: not-allowed; }
  button.link-muted { color: var(--color-text-muted); }
  .error { color: var(--color-error); font-size: 0.9rem; margin: 0.5rem 0 0; }
  .success { color: var(--color-success, green); font-size: 0.9rem; margin: 0.5rem 0 0; }
</style>
