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
| **Aperçu impression** | PrintPreviewModal avec SheetA4 + blockPositions | Même rendu que le layout fixe (DocumentLayout partagé) |
| **PDF email (signature)** | Déjà layout fixe (buildPdfDocumentHtml) | Inchangé, peut recevoir un `layoutId` plus tard pour variantes |
| **Données document** | blockPositions (objet positions/tailles) + optionnel profil | layoutId uniquement (ex. `'classique'`) — blockPositions supprimé du code |
| **Profils** | Store layoutProfiles (name + blockPositions), modals Sauver/Gérer | Store conservé en schéma (lecture seule, compatibilité) ; plus de CRUD ni export/restore ; modals orphelines à supprimer |

### 1.4 Ce qui ne change pas
- **Backend** : aucune modification (pas de layout en base serveur).
- **Données métier** : entete, lignes, reduction, sousTotal, total, tvaMontant, totalTTC, clients, societe.
- **Preuves / hash** : déjà sans blockPositions, inchangé.
- **Utilisateurs / auth** : inchangé.

### 1.5 Migrations
- **IndexedDB** : le store **layoutProfiles** est conservé dans le schéma Dexie (compatibilité) ; plus aucune écriture ni export/restore. Suppression du store (nouvelle version Dexie) optionnelle.
- **Documents existants** : on lit `layoutId` avec défaut `'classique'` ; `blockPositions` n’est plus lu ni écrit (anciens enregistrements peuvent encore contenir la clé, ignorée).

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
│  - layoutId uniquement ; blockPositions supprimé ; layoutProfiles store conservé (lecture seule) │
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

| Étape | Tâche | Fichiers | Statut |
|-------|--------|----------|--------|
| **E1** | Supprimer modals profils orphelines | `SaveProfileModal.svelte`, `ManageProfilesModal.svelte` | ⚠️ À faire : fichiers présents mais jamais importés ; à supprimer. |
| **E2** | Supprimer le module editor (blocs) | SheetA4, PlacedBlock, EditorSidebar, BlockToolbar | ✅ Fait : tout passe par DocumentLayout. |
| **E3** | Données : layoutId partout, plus de blockPositions | `CreerDevis.svelte`, `Facture.svelte`, `db.js` | ✅ Fait : blockPositions retiré du code (plus sauvegardé ni en state). layoutId seul. |
| **E4** | layoutProfiles : plus de CRUD ni export/restore | `db.js`, `SauvegarderRestaurer.svelte`, `ExplorerBase.svelte` | ✅ Fait : store conservé en schéma (compatibilité) ; fonctions CRUD supprimées ; export/restore ne concernent plus layoutProfiles ; explorateur n’affiche plus le store. Suppression du store Dexie (optionnel) = Phase 3 éviction. |

### Phase F – Multi-layouts

| Étape | Tâche | Fichiers | Statut |
|-------|--------|----------|--------|
| **F1** | 4 layouts dans LAYOUTS | `documentLayouts.js` | ✅ Fait : classique, avec-logo, moderne, minimal. |
| **F2** | Variantes de rendu selon layoutId | `DocumentLayout.svelte` | ✅ Fait : 4 blocs conditionnels + styles dédiés. |
| **F3** | Sélecteur de modèle dans l’UI | `CreerDevis.svelte`, `Facture.svelte` | ✅ Fait : select avec LAYOUTS ; layoutId sauvegardé sur le document. |

---

## 4. Bilan d’implémentation

| Phase | Statut | Commentaire |
|-------|--------|-------------|
| **A** – Fondations | ✅ Complète | documentLayouts.js + DocumentLayout.svelte (4 variantes). |
| **B** – Devis | ✅ Complète | DocumentLayout en étape 2, layoutId sauvegardé. |
| **C** – Impression | ✅ Complète | PrintPreviewModal utilise DocumentLayout. |
| **D** – Facture | ✅ Complète | DocumentLayout + sélecteur layoutId. |
| **E** – Nettoyage | ⚠️ Partielle | E2, E3, E4 faits (blockPositions supprimé, layoutProfiles éviction phases 1 et 2). E1 restant : supprimer SaveProfileModal.svelte et ManageProfilesModal.svelte (orphelines). |
| **F** – Multi-layouts | ✅ Complète | 4 layouts, sélecteur, rendu différencié. |

Optionnel : Phase 3 éviction layoutProfiles = supprimer le store du schéma Dexie (nouvelle version de base).
