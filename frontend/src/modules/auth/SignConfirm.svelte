<script>
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/apiClient.js';

  let { token = '' } = $props();
  let status = $state(null); // null = loading, 'ok' | 'used' | 'expired'
  let error = $state(false);

  async function confirm() {
    if (!token) {
      status = 'expired';
      return;
    }
    try {
      const res = await apiClient.get('/api/sign/confirm', { params: { token } });
      status = res.data?.status ?? 'expired';
    } catch {
      error = true;
      status = 'expired';
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
</style>
