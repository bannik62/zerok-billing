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

  let { user, logout } = $props();

  $effect(() => {
    const uid = user?.id;
    if (uid == null || isLegacyMigratedForUser(uid)) return;
    migrateLegacyDataToUser(uid)
      .then(() => setLegacyMigratedForUser(uid))
      .catch(() => {});
  });

  let displayModule = $state('liste-documents'); // Par défaut, afficher la liste de documents
  let selectedClient = $state(null);
  let selectedDevisForFacture = $state(null);
  let mobileMenuOpen = $state(false);

  const menuItems = [
    {
      id: 'liste-documents',
      label: 'Documents',
      icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
      group: 'core'
    },
    {
      id: 'creer-devis',
      label: 'Nouveau devis',
      icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v6 M9 14h6',
      group: 'core'
    },
    {
      id: 'facture',
      label: 'Nouvelle facture',
      icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 11h6 M9 15h6 M9 19h2',
      group: 'core'
    },
    {
      id: 'ajouter-client',
      label: 'Clients',
      icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 11h-6 M19 8v6',
      group: 'data'
    },
    {
      id: 'coffre-fort',
      label: 'Coffre-fort',
      icon: 'M3 13h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z M7 13V7a5 5 0 0 1 10 0v6',
      group: 'data'
    },
    {
      id: 'donnees-personnelles',
      label: 'Profil',
      icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      group: 'settings'
    },
    {
      id: 'sauvegarder-restaurer',
      label: 'Sauvegarde',
      icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
      group: 'settings'
    },
    {
      id: 'explorer-base',
      label: 'Explorateur',
      icon: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 5v14a3 3 0 0 0 6 0V5a3 3 0 0 0-6 0z M21 12a3 3 0 0 0-6 0v7a3 3 0 0 0 6 0v-7z',
      group: 'settings'
    }
  ];

  function navigate(moduleId) {
    displayModule = moduleId;
    selectedClient = null;
    selectedDevisForFacture = null;
    mobileMenuOpen = false;
  }

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

  function getModuleTitle() {
    const item = menuItems.find(m => m.id === displayModule);
    return item?.label || 'Tableau de bord';
  }
</script>

<div class="app-layout">
  <!-- Sidebar Desktop -->
  <aside class="sidebar" class:open={mobileMenuOpen}>
    <div class="sidebar-header">
      <div class="brand">
        <svg class="brand-icon" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M12 18v-6"/>
          <path d="M9 15l3 3 3-3"/>
        </svg>
        <span class="brand-name">ZK Facturation</span>
      </div>
      <button class="btn-close-mobile" onclick={() => mobileMenuOpen = false} aria-label="Fermer le menu">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav" aria-label="Navigation principale">
      <div class="nav-section">
        <div class="nav-section-title">Principal</div>
        {#each menuItems.filter(item => item.group === 'core') as item (item.id)}
          <button
            class="nav-item"
            class:active={displayModule === item.id}
            onclick={() => navigate(item.id)}
            aria-current={displayModule === item.id ? 'page' : undefined}
          >
            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d={item.icon}/>
            </svg>
            <span class="nav-label">{item.label}</span>
          </button>
        {/each}
      </div>

      <div class="nav-section">
        <div class="nav-section-title">Données</div>
        {#each menuItems.filter(item => item.group === 'data') as item (item.id)}
          <button
            class="nav-item"
            class:active={displayModule === item.id}
            onclick={() => navigate(item.id)}
            aria-current={displayModule === item.id ? 'page' : undefined}
          >
            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d={item.icon}/>
            </svg>
            <span class="nav-label">{item.label}</span>
          </button>
        {/each}
      </div>

      <div class="nav-section">
        <div class="nav-section-title">Paramètres</div>
        {#each menuItems.filter(item => item.group === 'settings') as item (item.id)}
          <button
            class="nav-item"
            class:active={displayModule === item.id}
            onclick={() => navigate(item.id)}
            aria-current={displayModule === item.id ? 'page' : undefined}
          >
            <svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d={item.icon}/>
            </svg>
            <span class="nav-label">{item.label}</span>
          </button>
        {/each}
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">
          {user.prenom?.charAt(0)}{user.nom?.charAt(0)}
        </div>
        <div class="user-details">
          <div class="user-name">{user.prenom} {user.nom}</div>
          <div class="user-email">{user.email}</div>
        </div>
      </div>
      <button class="btn-logout" onclick={logout} title="Se déconnecter">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span>Déconnexion</span>
      </button>
    </div>
  </aside>

  <!-- Overlay mobile -->
  {#if mobileMenuOpen}
    <div class="mobile-overlay" onclick={() => mobileMenuOpen = false}></div>
  {/if}

  <!-- Main content -->
  <div class="main-content">
    <header class="content-header">
      <button class="btn-menu-mobile" onclick={() => mobileMenuOpen = true} aria-label="Ouvrir le menu">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <h1 class="content-title">{getModuleTitle()}</h1>
    </header>

    <main class="content-body">
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
      {/if}
    </main>
  </div>
</div>

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
    background: var(--color-neutral-50);
  }

  /* === SIDEBAR === */
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--layout-sidebar-width);
    background: white;
    border-right: 1px solid var(--color-neutral-200);
    display: flex;
    flex-direction: column;
    z-index: var(--z-fixed);
    transition: transform var(--transition-base);
  }

  .sidebar-header {
    padding: var(--space-5);
    border-bottom: 1px solid var(--color-neutral-200);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .brand-icon {
    color: var(--color-primary-700);
    flex-shrink: 0;
  }

  .brand-name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-neutral-900);
  }

  .btn-close-mobile {
    display: none;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: var(--space-2);
    color: var(--color-neutral-600);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) 0;
  }

  .nav-section {
    margin-bottom: var(--space-6);
  }

  .nav-section-title {
    padding: 0 var(--space-5) var(--space-2);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-neutral-500);
  }

  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    background: transparent;
    border: none;
    border-left: 3px solid transparent;
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-neutral-700);
    transition: all var(--transition-fast);
    text-align: left;
  }

  .nav-item:hover {
    background: var(--color-neutral-50);
    color: var(--color-neutral-900);
  }

  .nav-item.active {
    background: var(--color-primary-50);
    border-left-color: var(--color-primary-700);
    color: var(--color-primary-700);
  }

  .nav-icon {
    flex-shrink: 0;
  }

  .nav-label {
    flex: 1;
  }

  .sidebar-footer {
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--color-neutral-200);
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .user-details {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-neutral-900);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-email {
    font-size: var(--font-size-xs);
    color: var(--color-neutral-500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-logout {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-error-50);
    border: 1px solid var(--color-error-200);
    border-radius: var(--radius-md);
    color: var(--color-error-700);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-logout:hover {
    background: var(--color-error-100);
    border-color: var(--color-error-300);
  }

  /* === MAIN CONTENT === */
  .main-content {
    flex: 1;
    margin-left: var(--layout-sidebar-width);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .content-header {
    background: white;
    border-bottom: 1px solid var(--color-neutral-200);
    padding: var(--space-5) var(--layout-content-padding);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
  }

  .btn-menu-mobile {
    display: none;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: var(--space-2);
    color: var(--color-neutral-600);
  }

  .content-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-neutral-900);
  }

  .content-body {
    flex: 1;
    padding: var(--layout-content-padding);
    overflow: auto;
  }

  .mobile-overlay {
    display: none;
  }

  /* === RESPONSIVE === */
  @media (max-width: 1023px) {
    .sidebar {
      transform: translateX(-100%);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .btn-close-mobile {
      display: block;
    }

    .main-content {
      margin-left: 0;
    }

    .btn-menu-mobile {
      display: block;
    }

    .mobile-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: calc(var(--z-fixed) - 1);
    }
  }

  @media (max-width: 640px) {
    .content-header {
      padding: var(--space-4);
    }

    .content-title {
      font-size: var(--font-size-xl);
    }

    .content-body {
      padding: var(--space-4);
    }

    .user-email {
      display: none;
    }
  }
</style>
