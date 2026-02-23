# Point de retour — Interface menu (avant onglets)

**Date** : 2025-02-13  
**Objectif** : Pouvoir revenir à cette interface si la refonte en onglets pose problème.

## Structure HTML (avant refonte)

- **`.menu-module.page`** : conteneur principal (flex column, full viewport).
- **`.menu-header`** : en-tête avec `h1` "Accueil", `p.welcome` "Bienvenue, **{user.prenom} {user.nom}**", `button.btn-logout` "Déconnexion".
- **`.menu-body`** : zone sous le header (flex, colonne en mobile, ligne en desktop).
  - **`.menu-content`** : section avec **boutons cartes** (`.menu-card`) — un par module. Ordre :
    1. Données personnelles
    2. Ajouter client
    3. Créer devis (`.menu-card-devis`, avec `.menu-card-desc` "Proposition envoyée au client (avant vente)")
    4. Facture (`.menu-card-facture`, desc "Document de vente (après accord du devis)")
    5. Liste documents
    6. Mes fichiers (`.menu-card-coffre`, desc "Coffre-fort — Documents chiffrés…")
    7. Explorer la base (`.menu-card-explorer`, desc "IndexedDB…")
    8. Sauvegarder / Restaurer (`.menu-card-archive`, desc "Archive chiffrée…")
  - **`#display_info.display_info`** : div de contenu qui affiche le module sélectionné (DonneesPersonnelles, AjouterClient, CreerDevis, etc.) ou le placeholder "Cliquez sur un bouton…".

## Comportement

- `displayModule` : `null` | `'donnees-personnelles'` | `'ajouter-client'` | … (8 valeurs).
- Un clic sur une carte appelle la fonction `show*` correspondante qui met `displayModule` et réinitialise `selectedClient` / `selectedDevisForFacture`.
- Navigation programmatique : `openFactureForClient(client)`, `openDevisForClient(client)`, `openFactureFromDevis(devis)`.

## Styles principaux (avant onglets)

- **Mobile** : `.menu-content` en flex wrap, cartes en grille (taille clamp 140px–200px largeur, 120–180px hauteur).
- **Tablette 768–1023px** : idem, cartes un peu plus grandes.
- **Desktop 1024px+** : `.menu-body` en `flex-direction: row` ; `.menu-content` en colonne à gauche (`.flex: 0 0 auto`, cartes 190–220px), `.display_info` à droite (`min-width: 0`).
- Cartes : bordure 2px, border-radius 12px, hover teal/or/blue selon type (devis, facture, coffre, explorer, archive).
- `.display_info` : bordure, border-radius 12px, background #f8fafc, padding, overflow auto.

## Fichier à restaurer pour revenir en arrière

- **Composant** : `frontend/src/modules/menu/Menu.svelte`
- Une sauvegarde complète du fichier tel qu’au 2025-02-13 (version « cartes à gauche ») peut être conservée sous un nom du type `Menu.svelte.cartes-backup` ou recréée à partir de l’historique git au commit précédant la refonte onglets.

## Ordre des modules (inchangé dans la refonte onglets)

1. Données personnelles  
2. Ajouter client  
3. Créer devis  
4. Facture  
5. Liste documents  
6. Mes fichiers  
7. Explorer la base  
8. Sauvegarder / Restaurer  
