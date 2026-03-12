<script>
  import { apiClient } from '$lib/apiClient.js';

  let { user = null } = $props();

  let messages = $state([]);
  let inputText = $state('');
  let loading = $state(false);
  let error = $state('');
  let history = $state([]);
  let results = $state([]);

  async function send() {
    const text = (inputText || '').trim();
    if (!text || loading) return;
    inputText = '';
    messages = [...messages, { role: 'user', content: text }];
    loading = true;
    error = '';
    try {
      const res = await apiClient.post('/api/prospect/chat', {
        message: text,
        history
      });
      const data = res.data ?? {};
      messages = [...messages, { role: 'assistant', content: data.reply ?? '' }];
      history = data.history ?? [];
      results = Array.isArray(data.results) ? data.results : [];
    } catch (e) {
      const errData = e.response?.data;
      if (errData?.error === 'NO_LLM_KEY') {
        error = "Configurez une clé OpenAI ou Mistral dans Paramètres > Token service pour utiliser l'assistant.";
      } else {
        error = errData?.message ?? errData?.error ?? 'Erreur de communication.';
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="prospect-module">
  <h2 class="prospect-title">Prospect</h2>
  <p class="prospect-intro">
    Posez une question en langage naturel pour rechercher des entreprises (SIRENE, Pappers). Les résultats s'affichent dans le panneau à droite.
  </p>
  <p class="prospect-third-party" role="status">
    Les requêtes sont envoyées à un serveur tiers (LLM et API publiques). Ne saisissez pas de données sensibles.
  </p>

  <div class="prospect-layout">
    <section class="prospect-chat" aria-label="Chat prospect">
      <div class="prospect-messages">
        {#each messages as msg, i (msg.role + (msg.content || '').slice(0, 80) + i)}
          <div class="prospect-msg" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'}>
            <span class="prospect-msg-role">{msg.role === 'user' ? 'Vous' : 'Assistant'}</span>
            <p class="prospect-msg-content">{msg.content}</p>
          </div>
        {/each}
        {#if loading}
          <div class="prospect-msg assistant">
            <span class="prospect-msg-role">Assistant</span>
            <p class="prospect-msg-content">Réflexion…</p>
          </div>
        {/if}
      </div>
      {#if error}
        <p class="prospect-error">{error}</p>
      {/if}
      <form class="prospect-form" onsubmit={(e) => { e.preventDefault(); send(); }}>
        <label for="prospect-input" class="sr-only">Votre message</label>
        <input
          id="prospect-input"
          type="text"
          class="prospect-input"
          placeholder="Ex. Plombiers à Calais"
          bind:value={inputText}
          disabled={loading}
        />
        <button type="submit" class="prospect-btn" disabled={loading || !inputText?.trim()}>
          Envoyer
        </button>
      </form>
    </section>

    <aside class="prospect-results" aria-label="Entreprises trouvées">
      <h3 class="prospect-results-title">Entreprises trouvées</h3>
      {#if results.length === 0}
        <p class="prospect-results-empty">Aucune entreprise pour l’instant. Posez une question dans le chat.</p>
      {:else}
        <ul class="prospect-results-list">
          {#each results as item, j (item.siret + (item.nom || '') + j)}
            <li class="prospect-results-item">
              <strong>{item.nom || '—'}</strong>
              {#if item.siret}<span class="prospect-results-siret">SIRET {item.siret}</span>{/if}
              {#if item.adresse}<p class="prospect-results-adresse">{item.adresse}</p>{/if}
              {#if item.formeJuridique}<span class="prospect-results-forme">{item.formeJuridique}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </aside>
  </div>
</div>

<style>
  .prospect-module { max-width: 56rem; }
  .prospect-title { margin: 0 0 0.5rem; font-size: 1.25rem; color: var(--color-primary); }
  .prospect-intro { margin: 0 0 0.5rem; font-size: 0.95rem; color: var(--color-text-soft); }
  .prospect-third-party { margin: 0 0 1rem; font-size: 0.85rem; color: var(--color-text-muted); font-style: italic; }
  .prospect-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  @media (max-width: 768px) {
    .prospect-layout { grid-template-columns: 1fr; }
  }
  .prospect-chat { display: flex; flex-direction: column; gap: 0.75rem; }
  .prospect-messages { display: flex; flex-direction: column; gap: 0.75rem; max-height: 20rem; overflow-y: auto; padding: 0.5rem 0; border: 1px solid var(--color-border-strong); border-radius: 8px; background: var(--color-bg-elevated); }
  .prospect-msg { padding: 0.5rem 0.75rem; border-radius: 6px; }
  .prospect-msg.user { background: var(--color-primary); color: white; align-self: flex-end; max-width: 85%; }
  .prospect-msg.assistant { background: var(--color-bg-soft); align-self: flex-start; max-width: 90%; }
  .prospect-msg-role { font-size: 0.75rem; font-weight: 600; display: block; margin-bottom: 0.25rem; }
  .prospect-msg-content { margin: 0; font-size: 0.9rem; white-space: pre-wrap; }
  .prospect-error { margin: 0; font-size: 0.9rem; color: var(--color-error); }
  .prospect-form { display: flex; gap: 0.5rem; }
  .prospect-input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-strong); border-radius: 6px; background: var(--color-bg-elevated); color: var(--color-text); font-size: 0.95rem; }
  .prospect-btn { padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid var(--color-primary); background: var(--color-primary); color: white; font-size: 0.95rem; cursor: pointer; }
  .prospect-btn:hover:not(:disabled) { opacity: 0.9; }
  .prospect-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .prospect-results { border: 1px solid var(--color-border-strong); border-radius: 8px; background: var(--color-bg-elevated); padding: 1rem; max-height: 24rem; overflow-y: auto; }
  .prospect-results-title { margin: 0 0 0.75rem; font-size: 1rem; font-weight: 600; color: var(--color-text); }
  .prospect-results-empty { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); }
  .prospect-results-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .prospect-results-item { padding: 0.5rem 0; border-bottom: 1px solid var(--color-border-soft); font-size: 0.9rem; }
  .prospect-results-item:last-child { border-bottom: none; }
  .prospect-results-siret { display: block; font-size: 0.8rem; color: var(--color-text-muted); }
  .prospect-results-adresse { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-text-soft); }
  .prospect-results-forme { display: block; font-size: 0.8rem; color: var(--color-text-muted); }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
