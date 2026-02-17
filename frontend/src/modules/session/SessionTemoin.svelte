<script>
  /**
   * Composant témoin : envoie la requête pour vérifier si la session est valide,
   * affiche les pages conditionnellement. Taille null (n'ajoute pas de boîte au contenu autorisé).
   */
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/apiClient.js';

  let { content: AuthorizedContent, logout, onUnauthorized } = $props();

  let sessionValid = $state(null);
  let user = $state(null);

  async function verify(isMounted) {
    sessionValid = null;
    try {
      const res = await apiClient.get('/api/auth/me');
      if (!isMounted()) return;
      const data = res.data;
      if (data?.valid === true) {
        user = data.user;
        sessionValid = true;
      } else {
        sessionValid = false;
      }
    } catch {
      if (isMounted()) sessionValid = false;
    }
  }

  onMount(() => {
    let mounted = true;
    const isMounted = () => mounted;
    verify(isMounted);
    return () => { mounted = false; };
  });

  function goLogin() {
    onUnauthorized?.();
    if (!onUnauthorized) window.location.href = '/';
  }
</script>

<div class="temoin" class:contents={sessionValid === true}>
  {#if sessionValid === null}
    <p class="temoin-loading">Vérification de la session…</p>
  {:else if sessionValid === true && AuthorizedContent}
    <AuthorizedContent {user} {logout} />
  {:else if sessionValid === false}
    <div class="temoin-unauthorized">
      <h1>Non autorisé</h1>
      <p>Votre session est invalide ou a expiré. Veuillez vous connecter.</p>
      <button type="button" onclick={goLogin}>Aller à la connexion</button>
    </div>
  {/if}
</div>

<style>
  .temoin.contents {
    display: contents;
  }
  .temoin:not(.contents) {
    max-width: 480px;
    margin: 2rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }
  .temoin-loading { margin: 2rem 0; color: #64748b; }
  .temoin-unauthorized h1 { font-size: 1.25rem; color: #b91c1c; }
  .temoin-unauthorized p { margin: 1rem 0; }
  .temoin-unauthorized button {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #0f766e;
    background: #0f766e;
    color: white;
    cursor: pointer;
  }
</style>
