# Refonte : layouts fixes à la place de l’éditeur à blocs

## 1. Bilan des changements décidés

### 1.1 Objectif
- Remplacer l’éditeur à blocs (drag/drop, resize) par **un ou plusieurs layouts fixes** (modèles de facture/devis prédéfinis).
- Remplacer les **profils** (mises en page sauvegardées par l’utilisateur) par le **choix d’un modèle** parmi N proposés (pour le test : **1 seul layout**).
- Garder la **même mise en page** partout : écran, impression, PDF email.

### 1.2 Principes
- **Modularité** : un module = une responsabilité claire (rendu document, choix de layout, données, etc.).
- **Séparation des responsabilités** : données (entete, lignes, totaux) ≠ présentation (layout) ≠ export (PDF, print).
- **Étape par étape** : commencer par **un seul layout** pour valider le flux, puis ajouter d’autres modèles si besoin.

### 1.3 Ce qui change (résumé)

| Zone | Avant | Après |
|------|--------|--------|
| **Création / édition devis** | Formulaire + étape 2 avec SheetA4, blocs déplaçables, profils | Formulaire + aperçu en layout fixe unique (puis choix parmi N layouts) |
| **Création / édition facture** | Idem : SheetA4, blocs, profils | Idem : layout fixe, choix de modèle |
| **Aperçu impression** | PrintPreviewModal avec SheetA4 + blockPositions | Même rendu que le layout fixe (composant partagé ou HTML commun) |
| **PDF email (signature)** | Déjà layout fixe (buildPdfDocumentHtml) | Inchangé, peut recevoir un `layoutId` plus tard pour variantes |
| **Données document** | blockPositions (objet positions/tailles) + optionnel profil | layoutId (ex. `'classique'`) — un seul layout au début |
| **Profils** | Store layoutProfiles (name + blockPositions), modals Sauver/Gérer | Supprimé ; à terme : 3 modèles en dur dans le code |

### 1.4 Ce qui ne change pas
- **Backend** : aucune modification (pas de layout en base serveur).
- **Données métier** : entete, lignes, reduction, sousTotal, total, tvaMontant, totalTTC, clients, societe.
- **Preuves / hash** : déjà sans blockPositions, inchangé.
- **Utilisateurs / auth** : inchangé.

### 1.5 Migrations
- **IndexedDB** : à terme, nouvelle version Dexie pour **supprimer le store layoutProfiles** (migration destructive pour les profils uniquement). Pas obligatoire si on se contente de ne plus l’utiliser.
- **Documents existants** : on lit `layoutId` avec défaut `'classique'` ; `blockPositions` peut rester en base mais est ignoré.

---

## 2. Modularité et responsabilités

### 2.1 Couches à respecter

```
┌─────────────────────────────────────────────────────────────┐
│  UI : Création / édition (CreerDevis, Facture)             │
│  - Formulaire (entete, lignes, reduction)                  │
│  - Choix du modèle (layoutId) — 1 valeur au début          │
│  - Aperçu = composant de rendu document                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Rendu document (une seule responsabilité : afficher)       │
│  - Composant(s) layout fixe(s)                             │
│  - Entrée : document + client + societe + layoutId          │
│  - Sortie : DOM (écran + impression)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Export PDF / HTML (une seule responsabilité : générer)    │
│  - buildPdfDocumentHtml(document, client, societe, docType) │
│  - Optionnel : layoutId pour variantes CSS                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Données (db, dbEncrypted)                                  │
│  - Devis / Facture : entete, lignes, totaux, layoutId       │
│  - Plus de blockPositions utilisé ; layoutProfiles supprimé  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Fichiers / modules cibles

| Responsabilité | Fichier(s) ou module | Rôle |
|---------------|----------------------|------|
| **Constantes layouts** | `frontend/src/lib/documentLayouts.js` (nouveau) | Liste des layouts (id, name) ; un seul au début. |
| **Rendu écran + impression** | `frontend/src/modules/document-layout/DocumentLayout.svelte` (nouveau) | Affiche devis/facture en layout fixe à partir de (document, client, societe, layoutId, docType). |
| **Génération HTML PDF** | `frontend/src/lib/pdfDocumentHtml.js` (existant) | Inchangé pour le test ; plus tard accepter layoutId si besoin. |
| **Création devis** | `CreerDevis.svelte` | Plus d’éditeur à blocs ; formulaire + aperçu DocumentLayout + layoutId. |
| **Édition facture** | `Facture.svelte` | Idem : formulaire / données + DocumentLayout + layoutId. |
| **Aperçu impression** | `PrintPreviewModal.svelte` | Utilise DocumentLayout au lieu de SheetA4. |
| **Données** | `db.js`, `dbEncrypted.js` | layoutId sur document ; plus d’usage de layoutProfiles pour la création ; migration optionnelle (suppression store). |

---

## 3. Plan étape par étape (un seul layout pour le test)

### Phase A – Fondations (sans casser l’existant)

| Étape | Tâche | Fichiers | Critère de fin |
|-------|--------|----------|----------------|
| **A1** | Créer le module des layouts (1 seul) | `src/lib/documentLayouts.js` | Constante `LAYOUTS` avec un entrée `{ id: 'classique', name: 'Classique' }`. |
| **A2** | Créer le composant de rendu layout fixe | `src/modules/document-layout/DocumentLayout.svelte` | Composant qui reçoit document, client, societe, docType, layoutId et affiche la facture/devis en mise en page fixe (même structure que le HTML PDF actuel). Réutilisable pour écran et impression. |

### Phase B – Brancher l’aperçu (côté création devis)

| Étape | Tâche | Fichiers | Critère de fin |
|-------|--------|----------|----------------|
| **B1** | Afficher DocumentLayout en étape 2 de CreerDevis | `CreerDevis.svelte` | En étape 2, à la place de SheetA4 + EditorSidebar, afficher uniquement DocumentLayout avec layoutId = 'classique'. Garder temporairement l’ancien code (commenté ou condition) si besoin. |
| **B2** | Enregistrer layoutId sur le devis | `CreerDevis.svelte`, `db.js` (mental) | À la sauvegarde du devis, inclure `layoutId: 'classique'`. Les champs entete, lignes, totaux inchangés. |

### Phase C – Impression

| Étape | Tâche | Fichiers | Critère de fin |
|-------|--------|----------|----------------|
| **C1** | Aperçu impression avec layout fixe | `PrintPreviewModal.svelte` | Remplacer SheetA4 par DocumentLayout (même document, client, societe, layoutId lu du document ou défaut 'classique'). |

### Phase D – Facture

| Étape | Tâche | Fichiers | Critère de fin |
|-------|--------|----------|----------------|
| **D1** | Facture : layout fixe + layoutId | `Facture.svelte` | Remplacer SheetA4 + EditorSidebar par DocumentLayout ; supprimer drag/resize/profils ; lire et sauvegarder layoutId (défaut 'classique'). |

### Phase E – Nettoyage et données

| Étape | Tâche | Fichiers | Critère de fin |
|-------|--------|----------|----------------|
| **E1** | Supprimer modals profils et sélecteur profils | `CreerDevis.svelte`, `Facture.svelte` | Plus de SaveProfileModal, ManageProfilesModal, ni d’appel à getLayoutProfiles / addLayoutProfile pour la création. |
| **E2** | Supprimer le module editor (blocs) | `editor/` (SheetA4, PlacedBlock, EditorSidebar, BlockToolbar, utils positions) | Supprimer ou désactiver les imports ; tout passe par DocumentLayout. |
| **E3** | Données : layoutId partout, ignorer blockPositions | `db.js`, `dbEncrypted.js`, archive si besoin | Devis/facture utilisent layoutId (défaut 'classique'). Anciens documents sans layoutId : lecture avec défaut. blockPositions non utilisé. |
| **E4** | (Optionnel) Migration Dexie : supprimer layoutProfiles | `db.js` | Nouvelle version Dexie sans le store layoutProfiles. À faire quand on est sûr de ne plus en avoir besoin. |

### Phase F – (Plus tard) Plusieurs layouts

| Étape | Tâche | Fichiers | Critère de fin |
|-------|--------|----------|----------------|
| **F1** | Ajouter 2e et 3e layout dans LAYOUTS | `documentLayouts.js` | Deux nouvelles entrées (ex. 'moderne', 'minimal'). |
| **F2** | Variantes de rendu selon layoutId | `DocumentLayout.svelte` (et/ou pdfDocumentHtml.js) | Selon layoutId, appliquer des classes ou un sous-composant différent. |
| **F3** | Sélecteur de modèle dans l’UI | `CreerDevis.svelte`, `Facture.svelte` | Liste ou boutons pour choisir le modèle ; sauver layoutId sur le document. |

---

## 4. Ordre recommandé pour commencer

1. **A1** → **A2** (fondations : constantes + composant de rendu).
2. **B1** → **B2** (devis : aperçu + sauvegarde layoutId).
3. **C1** (impression).
4. **D1** (facture).
5. **E1** → **E2** → **E3** (nettoyage profils et editor, données).
6. **E4** si tu veux supprimer le store layoutProfiles.

On commence par **A1** et **A2** pour avoir un seul layout testable sans toucher encore à l’éditeur existant.
