# 9 groupes d’inputs à encapsuler (sécurisation formulaires)

Objectif : encapsuler tous les champs de formulaire avec des classes (getters/setters + normalisation : maxLength, sanitization, valeurs autorisées) avant de continuer les évolutions.

---

## État par groupe

| # | Module / zone | Classe (ou pattern) | Statut |
|---|----------------|---------------------|--------|
| **1** | **Coffre-fort – recherche** | `CoffreFortSearchField` (recherche, max 200, sanitization) | ✅ Fait |
| **2** | **Coffre-fort – upload** | `CoffreFortUploadFields` (client, type, invoice, file, meta) | ✅ Fait |
| **3** | **Créer devis – sélecteur mise en page** | `DevisProfileSelectField` (profil id, liste autorisée) | ✅ Fait |
| **4** | **Liste documents – contrôles** | `ListeDocumentsControlsFields` (recherche + selectedDevisIds + selectedFactureIds) | ✅ Fait |
| **5** | **Sauvegarder / Restaurer** | `ArchiveRestoreFields` (mots de passe export/import + fichier import) | ✅ Fait |
| **6** | **Données personnelles** | `FormField` (createTextField, createUrlField) | ✅ Déjà fait |
| **7** | **Ajouter client** | `FormField` (createTextField, createTelField) | ✅ Déjà fait |
| **8** | **Auth (Login, Register, Unlock)** | `FormField` (createEmailField, createPasswordField) | ✅ Déjà fait |
| **9** | **Créer devis – formulaire étape 1 (DevisFormStep)** | `DevisFormStepFields` (normalisation clientId, tvaTaux, réduction, désignation/unite/quantite/prixUnitaire) + FormField pour dates/devise/objet | ✅ Fait |

---

## Règles d’encapsulation

- **Texte** : trim, maxLength, suppression caractères de contrôle (`\u0000-\u001f`, `\u007f`).
- **IDs** : maxLength 100 (aligné backend), trim.
- **Recherche** : maxLength 200 (aligné `maxlength` input).
- **Fichiers** : vérification extension / type MIME accepté.
- **Select (liste fixe)** : valeur restreinte aux options autorisées ; si la liste change (ex. profils), reset si valeur plus valide.

---

## Fichiers concernés

- **Groupe 1** : `frontend/src/modules/coffre-fort/CoffreFort.svelte`
- **Groupe 2** : `frontend/src/modules/coffre-fort/UploadSection.svelte`
- **Groupe 3** : `frontend/src/modules/creer-devis/CreerDevis.svelte`
- **Groupe 4** : `frontend/src/modules/liste-documents/ListeDocuments.svelte`
- **Groupe 5** : `frontend/src/modules/sauvegarder-restaurer/SauvegarderRestaurer.svelte`
- **Groupes 6–8** : DonneesPersonnelles, AjouterClient, Login, Register, Unlock (déjà FormField)
- **Groupe 9** : `frontend/src/modules/creer-devis/DevisFormStep.svelte` (partiel)
