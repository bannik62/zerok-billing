<script>
  import DonneesPersonnelles from '../donnees-personnelles/DonneesPersonnelles.svelte';
  import AjouterClient from '../ajouter-client/AjouterClient.svelte';
  import CreerDevis from '../creer-devis/CreerDevis.svelte';
  import Facture from '../facture/Facture.svelte';
  import ListeDocuments from '../liste-documents/ListeDocuments.svelte';

  /**
   * Module Menu principal. Reçoit user du SessionTemoin.
   * display_info affiche le module correspondant au bouton cliqué.
   */
  let { user, logout } = $props();

  /** 'donnees-personnelles' | 'ajouter-client' | 'creer-devis' | 'facture' | 'liste-documents' | null */
  let displayModule = $state(null);
  /** Client sélectionné pour Facture ou Devis (depuis la liste clients) */
  let selectedClient = $state(null);
  function showDonneesPersonnelles() { displayModule = 'donnees-personnelles'; selectedClient = null; }
  function showAjouterClient() { displayModule = 'ajouter-client'; selectedClient = null; }
  function showCreerDevis() { displayModule = 'creer-devis'; selectedClient = null; }
  function showFacture() { displayModule = 'facture'; selectedClient = null; }
  function showListeDocuments() { displayModule = 'liste-documents'; selectedClient = null; }

  function openFactureForClient(client) {
    selectedClient = client;
    displayModule = 'facture';
  }
  function openDevisForClient(client) {
    selectedClient = client;
    displayModule = 'creer-devis';
  }
</script>

<div class="menu-module page">
  <header class="menu-header">
    <h1>Accueil</h1>
    <p class="welcome">Bienvenue, <strong>{user.prenom} {user.nom}</strong>.</p>
    <button type="button" class="btn-logout" onclick={logout}>Déconnexion</button>
  </header>

  <div class="menu-body">
    <section class="menu-content" aria-label="Actions">
      <button type="button" class="menu-card" aria-label="Données personnelles" onclick={showDonneesPersonnelles}>
        <span class="menu-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span class="menu-card-label">Données personnelles</span>
      </button>
      <button type="button" class="menu-card" aria-label="Ajouter client" onclick={showAjouterClient}>
        <span class="menu-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </span>
        <span class="menu-card-label">Ajouter client</span>
      </button>
      <button type="button" class="menu-card" aria-label="Créer devis" onclick={showCreerDevis}>
        <span class="menu-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </span>
        <span class="menu-card-label">Créer devis</span>
      </button>
      <button type="button" class="menu-card" aria-label="Facture" onclick={showFacture}>
        <span class="menu-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 15h6M9 11h6M9 19h2" />
          </svg>
        </span>
        <span class="menu-card-label">Facture</span>
      </button>
      <button type="button" class="menu-card" aria-label="Liste documents" onclick={showListeDocuments}>
        <span class="menu-card-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </span>
        <span class="menu-card-label">Liste documents</span>
      </button>
    </section>

    <div id="display_info" class="display_info" role="region" aria-label="Contenu du module">
      {#if displayModule === 'donnees-personnelles'}
        <DonneesPersonnelles />
      {:else if displayModule === 'ajouter-client'}
        <AjouterClient onOpenFacture={openFactureForClient} onOpenDevis={openDevisForClient} />
      {:else if displayModule === 'creer-devis'}
        <CreerDevis client={selectedClient} />
      {:else if displayModule === 'facture'}
        <Facture client={selectedClient} />
      {:else if displayModule === 'liste-documents'}
        <ListeDocuments {user} />
      {:else}
        <p class="display_info-placeholder">Cliquez sur un bouton pour afficher le module.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Mobile first - base (jusqu'à 767px) */
  .page {
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: clamp(0.75rem, 3vw, 1.5rem);
    font-family: system-ui, sans-serif;
  }
  .menu-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: clamp(1rem, 2.5vw, 1.5rem);
    flex-shrink: 0;
  }
  .menu-header h1 {
    font-size: clamp(1.25rem, 4vw, 1.5rem);
    color: #0f766e;
    margin: 0;
  }
  .welcome { margin: 0; font-size: clamp(0.875rem, 2.2vw, 0.95rem); }
  .menu-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: 1rem;
  }
  .menu-content {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: flex-start;
    gap: clamp(0.75rem, 2.5vw, 1.25rem);
    flex-shrink: 0;
  }
  .display_info {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    padding: clamp(1rem, 3vw, 1.5rem);
  }
  .display_info-placeholder {
    margin: 0;
    color: #64748b;
    font-size: clamp(0.9rem, 2.2vw, 1rem);
  }
  .menu-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(0.5rem, 1.5vw, 0.75rem);
    width: clamp(140px, 40vw, 200px);
    min-width: clamp(140px, 40vw, 200px);
    height: clamp(120px, 28svh, 180px);
    min-height: clamp(120px, 28svh, 180px);
    padding: clamp(1rem, 3vw, 1.5rem);
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
    color: #0f172a;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .menu-card:hover {
    border-color: #0f766e;
    background: #f0fdfa;
  }
  .menu-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0f766e;
    width: clamp(40px, 10vw, 48px);
    height: clamp(40px, 10vw, 48px);
    flex-shrink: 0;
  }
  .menu-card-icon :global(svg) {
    width: 100%;
    height: 100%;
  }
  .menu-card-label {
    font-weight: 600;
    font-size: clamp(0.9rem, 2.5vw, 1rem);
    text-align: center;
  }
  .btn-logout {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #b91c1c;
    background: #b91c1c;
    color: white;
    cursor: pointer;
    font-size: clamp(0.8rem, 2vw, 0.9rem);
    margin-left: auto;
  }

  /* Très petits écrans (max 475px) */
  @media (max-width: 475px) {
    .menu-content {
      justify-content: center;
    }
    .menu-card {
      width: 160px;
      min-width: 160px;
      height: 140px;
      min-height: 140px;
    }
  }

  /* Tablette (768px - 1023px) */
  @media (min-width: 768px) and (max-width: 1023px) {
    .menu-content {
      gap: 1.5rem;
    }
    .menu-card {
      width: 180px;
      min-width: 180px;
      height: 160px;
      min-height: 160px;
    }
  }

  /* Desktop (1024px - 1399px) */
  @media (min-width: 1024px) and (max-width: 1399px) {
    .page { padding: 1.5rem 2rem; }
    .menu-body { flex-direction: row; gap: 1.5rem; }
    .menu-content {
      flex: 0 0 auto;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 1.5rem;
    }
    .display_info { min-width: 0; }
    .menu-card {
      width: 190px;
      min-width: 190px;
      height: 170px;
      min-height: 170px;
    }
  }

  /* Large desktop (1400px - 1799px) */
  @media (min-width: 1400px) and (max-width: 1799px) {
    .page { padding: 2rem 3rem; }
    .menu-body { flex-direction: row; gap: 2rem; }
    .menu-content {
      flex: 0 0 auto;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 1.75rem;
    }
    .display_info { min-width: 0; }
    .menu-card {
      width: 200px;
      min-width: 200px;
      height: 180px;
      min-height: 180px;
    }
  }

  /* XL desktop (1800px+) */
  @media (min-width: 1800px) {
    .page { padding: 2rem 4rem; max-width: 1600px; margin: 0 auto; }
    .menu-body { flex-direction: row; gap: 2rem; }
    .menu-content {
      flex: 0 0 auto;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 2rem;
    }
    .display_info { min-width: 0; }
    .menu-card {
      width: 220px;
      min-width: 220px;
      height: 200px;
      min-height: 200px;
    }
  }
</style>
