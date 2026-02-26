<script>
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/apiClient.js';

  let { user = null } = $props();

  let providers = $state([]);
  let loading = $state(true);
  let stripeConfigured = $state(false);
  let secretKey = $state('');
  let saving = $state(false);
  let message = $state({ type: '', text: '' });

  async function loadConfig() {
    loading = true;
    message = { type: '', text: '' };
    try {
      const res = await apiClient.get('/api/payment/config');
      const list = res.data?.providers ?? [];
      providers = list;
      stripeConfigured = list.some((p) => p.provider === 'stripe' && p.configured);
    } catch (e) {
      message = { type: 'error', text: e.response?.data?.error ?? 'Impossible de charger la config.' };
    } finally {
      loading = false;
    }
  }

  async function saveStripe(e) {
    e.preventDefault();
    const key = (secretKey || '').trim();
    if (!key) {
      message = { type: 'error', text: 'Saisissez la clé secrète Stripe.' };
      return;
    }
    saving = true;
    message = { type: '', text: '' };
    try {
      await apiClient.put('/api/payment/config', { provider: 'stripe', secretKey: key });
      message = { type: 'success', text: 'Stripe est configuré. Les paiements en ligne seront proposés après signature des factures.' };
      secretKey = '';
      await loadConfig();
    } catch (e) {
      message = { type: 'error', text: e.response?.data?.error ?? 'Erreur lors de l\'enregistrement.' };
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    loadConfig();
  });
</script>

<div class="paiement-module">
  <h2 class="paiement-title">Paiement</h2>
  <p class="paiement-intro">
    Configurez vos moyens de paiement pour que vos clients puissent régler les factures en ligne après signature.
  </p>

  {#if loading}
    <p class="paiement-loading">Chargement…</p>
  {:else}
    <section class="paiement-section" aria-labelledby="stripe-heading">
      <h3 id="stripe-heading" class="paiement-h3">Stripe</h3>
      {#if stripeConfigured}
        <p class="paiement-status configured">Stripe est configuré.</p>
        <p class="paiement-hint">Pour modifier la clé secrète, saisissez la nouvelle ci-dessous et enregistrez.</p>
      {:else}
        <p class="paiement-status">Stripe n'est pas encore configuré.</p>
      {/if}
      <form class="paiement-form" onsubmit={saveStripe}>
        <label for="stripe-secret" class="paiement-label">Clé secrète Stripe</label>
        <input
          id="stripe-secret"
          type="password"
          class="paiement-input"
          placeholder="sk_test_… ou sk_live_…"
          bind:value={secretKey}
          autocomplete="off"
        />
        <button type="submit" class="paiement-btn" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </section>

    {#if message.text}
      <p class="paiement-msg" class:success={message.type === 'success'} class:error={message.type === 'error'}>
        {message.text}
      </p>
    {/if}
  {/if}
</div>

<style>
  .paiement-module { max-width: 36rem; }
  .paiement-title { margin: 0 0 0.5rem; font-size: 1.25rem; color: var(--color-primary); }
  .paiement-intro { margin: 0 0 1.5rem; font-size: 0.95rem; color: var(--color-text-soft); line-height: 1.45; }
  .paiement-loading { color: var(--color-text-muted); }
  .paiement-section { margin-bottom: 1.5rem; }
  .paiement-h3 { margin: 0 0 0.5rem; font-size: 1rem; font-weight: 600; color: var(--color-text); }
  .paiement-status { margin: 0 0 0.25rem; font-size: 0.9rem; color: var(--color-text-muted); }
  .paiement-status.configured { color: var(--color-success, #059669); }
  .paiement-hint { margin: 0 0 0.75rem; font-size: 0.85rem; color: var(--color-text-muted); }
  .paiement-form { display: flex; flex-direction: column; gap: 0.5rem; max-width: 24rem; }
  .paiement-label { font-size: 0.9rem; font-weight: 500; color: var(--color-text); }
  .paiement-input { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-strong); border-radius: 6px; background: var(--color-bg-elevated); color: var(--color-text); font-size: 0.95rem; }
  .paiement-btn { padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid var(--color-primary); background: var(--color-primary); color: white; font-size: 0.95rem; cursor: pointer; align-self: flex-start; }
  .paiement-btn:hover:not(:disabled) { opacity: 0.9; }
  .paiement-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .paiement-msg { margin: 1rem 0 0; font-size: 0.9rem; padding: 0.5rem 0; }
  .paiement-msg.success { color: var(--color-success, #059669); }
  .paiement-msg.error { color: var(--color-error); }
</style>
