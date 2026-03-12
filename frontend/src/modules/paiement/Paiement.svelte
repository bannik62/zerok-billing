<script>
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/apiClient.js';

  let { user = null } = $props();

  let providers = $state([]);
  let loading = $state(true);
  let stripeConfigured = $state(false);
  let openaiConfigured = $state(false);
  let mistralConfigured = $state(false);
  let pappersConfigured = $state(false);
  let secretKey = $state('');
  let openaiKey = $state('');
  let mistralKey = $state('');
  let pappersKey = $state('');
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
      openaiConfigured = list.some((p) => p.provider === 'openai' && p.configured);
      mistralConfigured = list.some((p) => p.provider === 'mistral' && p.configured);
      pappersConfigured = list.some((p) => p.provider === 'pappers' && p.configured);
    } catch (e) {
      message = { type: 'error', text: e.response?.data?.error ?? 'Impossible de charger la config.' };
    } finally {
      loading = false;
    }
  }

  async function saveProvider(e, providerName) {
    e.preventDefault();
    const keyMap = { stripe: secretKey, openai: openaiKey, mistral: mistralKey, pappers: pappersKey };
    const key = (keyMap[providerName] || '').trim();
    const labels = { stripe: 'Stripe', openai: 'OpenAI', mistral: 'Mistral', pappers: 'Pappers' };
    if (!key) {
      message = { type: 'error', text: `Saisissez la clé ${labels[providerName]}.` };
      return;
    }
    saving = true;
    message = { type: '', text: '' };
    try {
      await apiClient.put('/api/payment/config', { provider: providerName, secretKey: key });
      message = { type: 'success', text: `${labels[providerName]} est configuré.` };
      if (providerName === 'stripe') secretKey = '';
      if (providerName === 'openai') openaiKey = '';
      if (providerName === 'mistral') mistralKey = '';
      if (providerName === 'pappers') pappersKey = '';
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
  <h2 class="paiement-title">Token service</h2>
  <p class="paiement-intro">
    Configurez les clés pour le paiement en ligne (Stripe) et pour le module Prospect (OpenAI, Mistral, Pappers).
  </p>

  {#if loading}
    <p class="paiement-loading">Chargement…</p>
  {:else}
    <section class="paiement-section" aria-labelledby="stripe-heading">
      <h3 id="stripe-heading" class="paiement-h3">
        <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo,_revised_2016.svg" alt="Stripe" class="stripe-logo" />
        <span>Stripe</span>
      </h3>
      {#if stripeConfigured}
        <p class="paiement-status configured">Stripe est configuré.</p>
        <p class="paiement-hint">Pour modifier la clé secrète, saisissez la nouvelle ci-dessous et enregistrez.</p>
      {:else}
        <p class="paiement-status">Stripe n'est pas encore configuré.</p>
      {/if}
      <form class="paiement-form" onsubmit={(e) => saveProvider(e, 'stripe')}>
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

    <section class="paiement-section" aria-labelledby="llm-heading">
      <h3 id="llm-heading" class="paiement-h3">Assistant IA (Prospect)</h3>
      <p class="paiement-hint">Au moins une clé (OpenAI ou Mistral) est requise pour le module Prospect.</p>
      <div class="paiement-provider-row">
        <div class="paiement-provider-block">
          <span class="paiement-provider-name">OpenAI</span>
          {#if openaiConfigured}<p class="paiement-status configured">Configuré</p>{/if}
          <form class="paiement-form" onsubmit={(e) => saveProvider(e, 'openai')}>
            <input type="password" class="paiement-input" placeholder="sk-…" bind:value={openaiKey} autocomplete="off" />
            <button type="submit" class="paiement-btn" disabled={saving}>Enregistrer</button>
          </form>
        </div>
        <div class="paiement-provider-block">
          <span class="paiement-provider-name">Mistral</span>
          {#if mistralConfigured}<p class="paiement-status configured">Configuré</p>{/if}
          <form class="paiement-form" onsubmit={(e) => saveProvider(e, 'mistral')}>
            <input type="password" class="paiement-input" placeholder="Clé API Mistral" bind:value={mistralKey} autocomplete="off" />
            <button type="submit" class="paiement-btn" disabled={saving}>Enregistrer</button>
          </form>
        </div>
      </div>
    </section>

    <section class="paiement-section" aria-labelledby="pappers-heading">
      <h3 id="pappers-heading" class="paiement-h3">Sources de données</h3>
      <p class="paiement-hint">Pappers (bilans, dirigeants). SIRENE et geo.api.gouv.fr sont gratuits et toujours actifs.</p>
      <div class="paiement-provider-block">
        <span class="paiement-provider-name">Pappers</span>
        {#if pappersConfigured}<p class="paiement-status configured">Configuré</p>{/if}
        <form class="paiement-form" onsubmit={(e) => saveProvider(e, 'pappers')}>
          <input type="password" class="paiement-input" placeholder="Clé API Pappers" bind:value={pappersKey} autocomplete="off" />
          <button type="submit" class="paiement-btn" disabled={saving}>Enregistrer</button>
        </form>
      </div>
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
  .paiement-h3 { margin: 0 0 0.5rem; font-size: 1rem; font-weight: 600; color: var(--color-text); display: flex; align-items: center; gap: 0.5rem; }
  .paiement-h3 .stripe-logo { height: 1.25rem; width: auto; display: block; }
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
  .paiement-provider-row { display: flex; flex-wrap: wrap; gap: 1.5rem; }
  .paiement-provider-block { min-width: 12rem; }
  .paiement-provider-name { font-size: 0.9rem; font-weight: 600; display: block; margin-bottom: 0.25rem; color: var(--color-text); }
</style>
