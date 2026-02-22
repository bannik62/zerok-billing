<script>
  import DonneesPersonnelles from '../donnees-personnelles/DonneesPersonnelles.svelte';
  import AjouterClient from '../ajouter-client/AjouterClient.svelte';
  import CreerDevis from '../creer-devis/CreerDevis.svelte';
  import Facture from '../facture/Facture.svelte';
  import ListeDocuments from '../liste-documents/ListeDocuments.svelte';
  import CoffreFort from '../coffre-fort/CoffreFort.svelte';
  import ExplorerBase from '../explorer-base/ExplorerBase.svelte';
  import SauvegarderRestaurer from '../sauvegarder-restaurer/SauvegarderRestaurer.svelte';
  import {
    migrateLegacyDataToUser,
    isLegacyMigratedForUser,
    setLegacyMigratedForUser
  } from '$lib/db.js';

  /**
   * Module Menu principal. Reçoit user du SessionTemoin.
   * display_info affiche le module correspondant au bouton cliqué.
   */
  let { user, logout } = $props();

  /** Une fois par utilisateur : attribuer les données sans userId au compte connecté. */
  $effect(() => {
    const uid = user?.id;
    if (uid == null || isLegacyMigratedForUser(uid)) return;
    migrateLegacyDataToUser(uid)
      .then(() => setLegacyMigratedForUser(uid))
      .catch(() => {});
  });

  /** 'donnees-personnelles' | 'ajouter-client' | 'creer-devis' | 'facture' | 'liste-documents' | 'explorer-base' | 'sauvegarder-restaurer' | null */
  let displayModule = $state(null);
  /** Client sélectionné pour Facture ou Devis (depuis la liste clients) */
  let selectedClient = $state(null);
  /** Devis sélectionné pour créer une facture (depuis la liste documents) */
  let selectedDevisForFacture = $state(null);
  function showDonneesPersonnelles() { displayModule = 'donnees-personnelles'; selectedClient = null; selectedDevisForFacture = null; }
  function showAjouterClient() { displayModule = 'ajouter-client'; selectedClient = null; selectedDevisForFacture = null; }
  function showCreerDevis() { displayModule = 'creer-devis'; selectedClient = null; selectedDevisForFacture = null; }
  function showFacture() { displayModule = 'facture'; selectedClient = null; selectedDevisForFacture = null; }
  function showListeDocuments() { displayModule = 'liste-documents'; selectedClient = null; selectedDevisForFacture = null; }
  function showCoffreFort() { displayModule = 'coffre-fort'; selectedClient = null; selectedDevisForFacture = null; }
  function showExplorerBase() { displayModule = 'explorer-base'; selectedClient = null; selectedDevisForFacture = null; }
  function showSauvegarderRestaurer() { displayModule = 'sauvegarder-restaurer'; selectedClient = null; selectedDevisForFacture = null; }

  function openFactureForClient(client) {
    selectedClient = client;
    selectedDevisForFacture = null;
    displayModule = 'facture';
  }
  function openDevisForClient(client) {
    selectedClient = client;
    selectedDevisForFacture = null;
    displayModule = 'creer-devis';
  }
  function openFactureFromDevis(devis) {
    selectedDevisForFacture = devis;
    selectedClient = null;
    displayModule = 'facture';
  }
</script>

<div class="menu-module page">
  <header class="menu-header">
    <h1>Accueil</h1>
    <p class="welcome">Bienvenue, <strong>{user.prenom} {user.nom}</strong>.</p>
    <button type="button" class="btn-logout" onclick={logout}>Déconnexion</button>
  </header>

  <div class="menu-body">
    <!-- Onglets style classeur (scroll horizontal sur petit écran) -->
    <div class="menu-tabs-wrapper" role="presentation">
      <div class="menu-tabs" role="tablist" aria-label="Modules">
        <button type="button" role="tab" class="tab" class:active={displayModule === 'donnees-personnelles'} aria-selected={displayModule === 'donnees-personnelles'} aria-label="Données personnelles" onclick={showDonneesPersonnelles}>Données personnelles</button>
        <button type="button" role="tab" class="tab" class:active={displayModule === 'ajouter-client'} aria-selected={displayModule === 'ajouter-client'} aria-label="Ajouter client" onclick={showAjouterClient}>Ajouter client</button>
        <button type="button" role="tab" class="tab" class:active={displayModule === 'creer-devis'} aria-selected={displayModule === 'creer-devis'} aria-label="Créer devis" onclick={showCreerDevis}>Créer devis</button>
        <button type="button" role="tab" class="tab" class:active={displayModule === 'facture'} aria-selected={displayModule === 'facture'} aria-label="Facture" onclick={showFacture}>Facture</button>
        <button type="button" role="tab" class="tab" class:active={displayModule === 'liste-documents'} aria-selected={displayModule === 'liste-documents'} aria-label="Liste documents" onclick={showListeDocuments}>Liste documents</button>
        <button type="button" role="tab" class="tab" class:active={displayModule === 'coffre-fort'} aria-selected={displayModule === 'coffre-fort'} aria-label="Mes fichiers — Coffre-fort" onclick={showCoffreFort}>Mes fichiers</button>
        <button type="button" role="tab" class="tab" class:active={displayModule === 'explorer-base'} aria-selected={displayModule === 'explorer-base'} aria-label="Explorer la base" onclick={showExplorerBase}>Explorer la base</button>
        <button type="button" role="tab" class="tab" class:active={displayModule === 'sauvegarder-restaurer'} aria-selected={displayModule === 'sauvegarder-restaurer'} aria-label="Sauvegarder ou restaurer" onclick={showSauvegarderRestaurer}>Sauvegarder / Restaurer</button>
      </div>
    </div>

    <div id="display_info" class="display_info" role="region" aria-label="Contenu du module">
      {#if displayModule === 'donnees-personnelles'}
        <DonneesPersonnelles {user} />
      {:else if displayModule === 'ajouter-client'}
        <AjouterClient {user} onOpenFacture={openFactureForClient} onOpenDevis={openDevisForClient} />
      {:else if displayModule === 'creer-devis'}
        <CreerDevis {user} client={selectedClient} />
      {:else if displayModule === 'facture'}
        <Facture {user} client={selectedClient} devis={selectedDevisForFacture} />
      {:else if displayModule === 'liste-documents'}
        <ListeDocuments {user} onOpenFactureFromDevis={openFactureFromDevis} />
      {:else if displayModule === 'coffre-fort'}
        <CoffreFort {user} />
      {:else if displayModule === 'explorer-base'}
        <ExplorerBase {user} />
      {:else if displayModule === 'sauvegarder-restaurer'}
        <SauvegarderRestaurer {user} />
      {:else}
        <div class="welcome-presentation">
          <h2 class="welcome-presentation-title">Zero-Knowledge Facturation</h2>
          <p class="welcome-presentation-intro">
            Application de facturation <strong>local-first</strong> : vos devis, factures et documents restent chez vous.
            Le serveur ne voit jamais le contenu ; seul un hash (preuve d’intégrité) est enregistré.
          </p>
          <section class="welcome-presentation-section" aria-labelledby="welcome-points-forts">
            <h3 id="welcome-points-forts" class="welcome-presentation-h3">Points forts</h3>
            <ul class="welcome-presentation-list">
              <li><strong>Chiffrement côté client</strong> — Clé dérivée de votre mot de passe ; devis, factures et coffre-fort déchiffrés uniquement dans votre navigateur.</li>
              <li><strong>Preuves d’intégrité</strong> — Hash des documents envoyés au serveur pour vérifier qu’aucune donnée n’a été modifiée.</li>
              <li><strong>Données en local</strong> — IndexedDB dans le navigateur ; pas de fuite de contenu, même en cas de compromission du serveur.</li>
              <li><strong>Coffre-fort de documents</strong> — Justificatifs, contrats, fiches de paie… stockés et chiffrés comme le reste.</li>
              <li><strong>Sauvegarde / restauration</strong> — Archive chiffrée exportable pour reprendre vos données sur un autre appareil.</li>
            </ul>
          </section>
          <section class="welcome-presentation-section" aria-labelledby="welcome-pour-qui">
            <h3 id="welcome-pour-qui" class="welcome-presentation-h3">Pour qui ?</h3>
            <p class="welcome-presentation-text">
              Auto-entrepreneurs, TPE, artisans et professionnels qui veulent facturer et gérer leurs documents
              sans confier le contenu à un tiers. Idéal si la confidentialité et la maîtrise des données comptent pour vous.
            </p>
          </section>
          <section class="welcome-presentation-section" aria-labelledby="welcome-pourquoi">
            <h3 id="welcome-pourquoi" class="welcome-presentation-h3">Pourquoi ?</h3>
            <p class="welcome-presentation-text">
              Pour garder la main sur vos factures et pièces justificatives tout en bénéficiant d’un outil structuré :
              création de devis et factures, liste des documents, coffre-fort chiffré et preuves vérifiables,
              le tout sans exposer le détail à un hébergeur.
            </p>
          </section>
          <p class="welcome-presentation-cta">Choisissez un onglet ci-dessus pour accéder à un module.</p>
        </div>
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
    gap: 0;
  }
  /* Barre d'onglets style classeur — scroll horizontal si besoin */
  .menu-tabs-wrapper {
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    padding: 0.5rem 0.75rem 0 0.75rem;
    border-bottom: 2px solid #94a3b8;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    background: #cbd5e1;
  }
  .menu-tabs {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 0;
    min-width: min-content;
    padding: 0.25rem 0.5rem 0 0.5rem;
  }
  .tab {
    flex-shrink: 0;
    padding: 0.6rem 1rem;
    border: 1px solid #94a3b8;
    border-bottom: none;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    margin-bottom: -2px;
    background: #e2e8f0;
    color: #334155;
    font-size: clamp(0.8rem, 2vw, 0.9rem);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }
  .tab:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
  .tab.active {
    background: #f8fafc;
    color: #0f766e;
    border-color: #94a3b8;
    border-bottom: 2px solid #f8fafc;
    font-weight: 600;
  }
  .display_info {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid #e2e8f0;
    border-radius: 0 12px 12px 12px;
    background: #f8fafc;
    padding: clamp(1rem, 3vw, 1.5rem);
  }
  .welcome-presentation {
    max-width: 52rem;
    padding: 0.5rem 0;
  }
  .welcome-presentation-title {
    margin: 0 0 1rem 0;
    font-size: clamp(1.15rem, 3vw, 1.35rem);
    color: #0f766e;
    font-weight: 700;
  }
  .welcome-presentation-intro {
    margin: 0 0 1.5rem 0;
    font-size: clamp(0.95rem, 2.2vw, 1.05rem);
    line-height: 1.5;
    color: #334155;
  }
  .welcome-presentation-section {
    margin-bottom: 1.5rem;
  }
  .welcome-presentation-h3 {
    margin: 0 0 0.5rem 0;
    font-size: clamp(1rem, 2.5vw, 1.1rem);
    color: #0f766e;
    font-weight: 600;
  }
  .welcome-presentation-list {
    margin: 0;
    padding-left: 1.25rem;
    line-height: 1.55;
    color: #475569;
    font-size: clamp(0.9rem, 2vw, 1rem);
  }
  .welcome-presentation-list li {
    margin-bottom: 0.4rem;
  }
  .welcome-presentation-text {
    margin: 0;
    line-height: 1.55;
    color: #475569;
    font-size: clamp(0.9rem, 2vw, 1rem);
  }
  .welcome-presentation-cta {
    margin: 1.5rem 0 0 0;
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
    font-size: 0.9rem;
    color: #64748b;
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

  @media (min-width: 768px) {
    .page { padding: 1.5rem 2rem; }
  }
  @media (min-width: 1400px) {
    .page { padding: 2rem 3rem; }
  }
  @media (min-width: 1800px) {
    .page { padding: 2rem 4rem; max-width: 1600px; margin: 0 auto; }
  }
</style>
