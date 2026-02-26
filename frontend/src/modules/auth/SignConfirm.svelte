<script>
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/apiClient.js';

  let { token = '' } = $props();
  let status = $state(null); // null = loading, 'ok' | 'used' | 'expired'
  let error = $state(false);
  let paymentToken = $state(null);
  let providers = $state([]);
  let payMessage = $state('');
  let payLoading = $state(false);

  async function confirm() {
    if (!token) {
      status = 'expired';
      return;
    }
    try {
      const res = await apiClient.get('/api/sign/confirm', { params: { token } });
      status = res.data?.status ?? 'expired';
      paymentToken = res.data?.paymentToken ?? null;
      providers = Array.isArray(res.data?.providers) ? res.data.providers : [];
    } catch {
      error = true;
      status = 'expired';
    }
  }

  async function startPayment(provider) {
    if (!paymentToken || payLoading) return;
    payMessage = 'Redirection…';
    payLoading = true;
    try {
      const res = await apiClient.post('/api/payment/create-session', { paymentToken, provider });
      if (res.data?.redirectUrl) {
        window.location.href = res.data.redirectUrl;
        return;
      }
      payMessage = res.data?.error || 'Erreur';
    } catch (e) {
      payMessage = e.response?.data?.error || 'Erreur de connexion';
    } finally {
      payLoading = false;
    }
  }

  onMount(() => {
    if (token && status === null) confirm();
  });
</script>

<div class="sign-confirm">
  {#if status === null && !error}
    <p class="loading">Enregistrement de votre signature…</p>
  {:else}
    {#if status === 'ok'}
      <h1>Document accepté</h1>
      <p>Votre signature a bien été enregistrée.</p>
      {#if paymentToken && providers.length > 0}
        <section class="pay-section">
          <p class="pay-label">Régler cette facture</p>
          <div class="pay-icons">
            {#if providers.includes('stripe')}
              <button
                type="button"
                class="pay-btn"
                disabled={payLoading}
                onclick={() => startPayment('stripe')}
              >
                <img src="https://stripe.com/img/v3/payments/badges/stripe.svg" alt="Stripe" width="56" height="28" />
                <span>Payer avec Stripe</span>
              </button>
            {/if}
          </div>
          {#if payMessage}
            <p class="pay-msg">{payMessage}</p>
          {/if}
        </section>
      {/if}
    {:else}
      <h1>Lien invalide ou expiré</h1>
      <p>Ce lien a déjà été utilisé ou a expiré.</p>
    {/if}
    <p class="link-wrap">
      <a href="/">Accéder au site</a>
    </p>
  {/if}
</div>

<style>
  .sign-confirm {
    max-width: 480px;
    margin: 3rem auto;
    padding: 1rem;
    text-align: center;
    font-family: system-ui, sans-serif;
  }
  .sign-confirm h1 {
    font-size: 1.5rem;
    color: var(--color-primary, #2563eb);
    margin: 0 0 0.5rem;
  }
  .sign-confirm p {
    color: var(--color-text, #333);
    margin: 0 0 1rem;
  }
  .link-wrap {
    margin-top: 2rem !important;
  }
  .sign-confirm a {
    color: var(--color-primary, #2563eb);
    text-decoration: underline;
  }
  .loading {
    color: var(--color-text-muted, #666);
  }
  .pay-section {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border-strong, #e5e7eb);
  }
  .pay-label {
    margin: 0 0 1rem;
    font-weight: 600;
    color: var(--color-text, #333);
  }
  .pay-icons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    align-items: center;
  }
  .pay-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    border: 1px solid var(--color-border-strong, #e5e7eb);
    border-radius: 8px;
    background: var(--color-bg-elevated, #fff);
    color: var(--color-text, #333);
    font-size: 0.95rem;
    cursor: pointer;
  }
  .pay-btn:hover:not(:disabled) {
    background: var(--color-bg-muted, #f3f4f6);
  }
  .pay-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .pay-btn img {
    vertical-align: middle;
  }
  .pay-msg {
    margin: 0.75rem 0 0;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b7280);
  }
</style>
