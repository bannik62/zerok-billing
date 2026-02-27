# Spec Phase 2 – Coffre-fort UX

Phase 2 améliore l’expérience utilisateur du coffre-fort (preview, drag & drop, métadonnées, recherche, export ZIP). Elle s’appuie sur tout ce qui est déjà en place en Phase 1.

---

## État d’implémentation (vérifié sur le code — 2026-02-27)

| # | Livrable | Statut | Commentaire |
|---|----------|--------|-------------|
| 1 | **Preview PDF / images** | ✅ Fait | `DocumentPreviewModal.svelte`, aperçu img/PDF. |
| 2 | **Drag & drop upload** | ✅ Fait | `UploadSection.svelte` : zone `.upload-dropzone`, handlers `onDrop`/`onDragOver`/`onDragLeave`, feedback visuel `.is-dragover`. |
| 3 | **Métadonnées** | ✅ Fait | Champs description, category, tags dans formulaire upload ; stockés dans `metadata`. |
| 4 | **Recherche** | ✅ Fait | `ListeDocumentsSearch.svelte` + `ListeDocumentsControlsFields.js`. |
| 5 | **Export ZIP (pièces jointes)** | ✅ Fait | `coffreFortExport.js` (JSZip) + `doExportPiecesJointesZip` dans `ListeDocuments.svelte`. Protégé par confirmation mot de passe. |

**Phase 2 : 100 % implémentée.**

---

## Vue d’ensemble des 5 livrables

| # | Livrable | En bref |
|---|----------|--------|
| 1 | **Preview PDF / images** | Voir le document dans la page (sans télécharger) après clic sur une ligne ou un bouton « Aperçu ». |
| 2 | **Drag & drop upload** | Zone où glisser-déposer un fichier en plus du bouton « Choisir un fichier ». |
| 3 | **Métadonnées** | Champs optionnels à l’upload (et éditables après) : description, montant, catégorie, tags. |
| 4 | **Recherche** | Champ de recherche qui filtre la liste (fichier, client, type, métadonnées). |
| 5 | **Export ZIP (facture + docs)** | Depuis la liste des devis/factures ou depuis un devis/facture : exporter en ZIP le PDF du document + les pièces jointes du coffre liées à ce document. |

---

## 1. Preview PDF / images

### 1.1 Objectif

L’utilisateur clique sur un document (ou sur un bouton « Aperçu ») et voit le contenu (PDF ou image) dans la page, sans télécharger. Pour les autres types (ex. DOC), garder uniquement « Télécharger ».

### 1.2 Types prévus pour la preview

- **Images :** `image/jpeg`, `image/png`, `image/gif`, `image/webp` → affichage dans un `<img>` (après déchiffrement → `URL.createObjectURL(blob)`).
- **PDF :** `application/pdf` → affichage dans une iframe ou un objet `<embed>` (après déchiffrement → `URL.createObjectURL(blob)`). Iframe avec `sandbox="allow-same-origin"` pour limiter les scripts.
- **Autres (DOC, etc.) :** pas de preview, seul le bouton « Télécharger » reste disponible.

### 1.3 Comportement proposé

- **Option A (simple) :** dans le tableau, ajouter un bouton « Aperçu » à côté de « Télécharger ». Au clic : déchiffrer le document, ouvrir une **modale** qui contient soit une `<img>`, soit une `<iframe src="blob:...">` selon le `mimeType`. Bouton « Fermer » pour fermer la modale et révoquer l’URL blob.
- **Option B :** clic sur le nom du fichier ouvre la même modale (et « Télécharger » reste un bouton séparé).

Recommandation : **Option A** (bouton « Aperçu » explicite).

### 1.4 Technique

- Utiliser `decryptDocumentBlob(record)` (déjà en place).
- Créer une modale `DocumentPreviewModal.svelte` qui reçoit en props : `open`, `document` (record), `onClose`.
- Dans la modale : si `open && document`, appeler `decryptDocumentBlob(document)`, obtenir le `Blob`, puis `url = URL.createObjectURL(blob)`.
  - Si `document.mimeType.startsWith('image/')` → `<img src={url} alt={document.filename} />`.
  - Si `document.mimeType === 'application/pdf'` → `<iframe src={url} title={document.filename} sandbox="allow-same-origin" />`.
  - Sinon → afficher un message « Aperçu non disponible. Utilisez Télécharger. » + bouton Télécharger.
- À la fermeture de la modale (ou quand `open` passe à false), appeler `URL.revokeObjectURL(url)` pour libérer la mémoire.

### 1.5 Récap

- Nouveau composant : `DocumentPreviewModal.svelte` (ou intégré dans `CoffreFort.svelte`).
- Dans la liste des documents : bouton « Aperçu » (affiché seulement si `mimeType` = image ou PDF).
- Gestion propre des URLs blob (revoke à la fermeture).

---

## 2. Drag & drop upload

### 2.1 Objectif

En plus de l’input file actuel, permettre de **glisser-déposer** un fichier dans une zone dédiée pour l’upload (même flux que Phase 1 : client, type, lien facture, puis chiffrement et envoi de la preuve).

### 2.2 Comportement

- Une **zone** (div) avec bordure en pointillés, texte du type : « Glissez un fichier ici ou cliquez pour choisir ».
- Quand l’utilisateur fait un **drag over** la zone : style visuel « prêt à recevoir » (ex. bordure en dur, fond légèrement coloré).
- Au **drop** : récupérer le premier fichier (`e.dataTransfer.files[0]`), vérifier la taille (max 20 Mo) et le type (même liste que Phase 1 : PDF, images, doc). Si valide, remplir `selectedFile` comme si l’utilisateur avait choisi le fichier via l’input ; l’utilisateur remplit ensuite client / type / lien facture et clique sur « Ajouter et chiffrer ».
- **Alternative possible :** le drop déclenche directement l’upload si client (et éventuellement type) sont déjà renseignés ; sinon afficher un message « Sélectionnez d’abord un client ».

Recommandation : **drop = sélection du fichier** (comme l’input file), sans lancer l’upload automatiquement ; l’utilisateur valide avec le bouton existant. Ainsi un seul flux (fichier + formulaire + bouton).

### 2.3 Technique

- Sur la zone : `ondragover` (e.preventDefault(), e.stopPropagation(), ajouter une classe `is-dragover`), `ondragleave` (retirer la classe), `ondrop` (e.preventDefault(), e.stopPropagation(), récupérer `e.dataTransfer.files[0]`, même validation que `onFileChange`, puis assigner à `selectedFile` et éventuellement déclencher un `input[type=file]` pour garder la cohérence si besoin).
- Garder l’input file existant : soit caché et la zone déclenche un clic sur l’input (`input.click()`), soit la zone et l’input sont tous les deux visibles (zone = drop, input = clic). Les deux peuvent mettre à jour `selectedFile`.

### 2.4 Récap

- Zone « drop » avec feedback visuel (dragover / dragleave).
- Au drop : validation taille + type, puis `selectedFile = file` (et affichage du nom du fichier comme aujourd’hui).
- Pas de changement de l’API ou du stockage, uniquement UX.

---

## 3. Métadonnées (montant, catégorie, description, tags)

### 3.1 Objectif

Permettre de renseigner des **métadonnées** sur chaque document (surtout pour les justificatifs : montant, catégorie comptable, description). Ces infos servent à la recherche (Phase 2.4) et à un éventuel export comptable plus tard.

### 3.2 Structure déjà en place

En Phase 1, le champ `metadata` existe déjà dans le modèle (objet optionnel). On fixe sa forme pour Phase 2 :

- `metadata.description` (string, optionnel) : texte libre.
- `metadata.amount` (number, optionnel) : montant (ex. montant du justificatif).
- `metadata.category` (string, optionnel) : catégorie (ex. « repas », « transport », « fourniture »). On peut proposer une liste prédéfinie + « Autre ».
- `metadata.tags` (array de strings, optionnel) : ex. `["déductible", "TVA 10%"]`. En UI : champ texte où l’utilisateur saisit des tags séparés par des virgules, qu’on stocke en tableau.

### 3.3 Où afficher / saisir les métadonnées

- **À l’upload :** dans le formulaire d’ajout de document, après (ou à côté de) « Type », ajouter des champs optionnels :
  - Description (textarea ou input text, une ligne).
  - Montant (input number, step 0.01).
  - Catégorie (select ou liste prédéfinie : Repas, Transport, Fourniture, Hébergement, Autre).
  - Tags (input text, placeholder « déductible, TVA 10% » → split par virgule, trim, stocker en `metadata.tags`).
- **Après coup (édition) :** dans la liste, un bouton « Modifier » (ou icône crayon) qui ouvre une petite modale (ou ligne éditante) avec les mêmes champs pré-remplis. À la sauvegarde : récupérer le record, modifier uniquement `metadata` (et éventuellement les champs « non chiffrés » si on en ajoute), puis `putDocumentRaw` (ou une fonction `updateDocument(id, { metadata })` si vous l’ajoutez en couche db).

### 3.4 Stockage

- Côté IndexedDB : le record `document` a déjà `metadata?: { description?, amount?, category?, tags? }`. Lors de l’upload, passer `metadata` à `addDocument`. Pour l’édition : lire le document, modifier `metadata`, réécrire avec `putDocumentRaw` (le payload chiffré ne change pas, seul le champ `metadata` en clair change).
- Côté backend (preuves) : pas besoin d’envoyer les métadonnées dans `POST /api/documents/proof` ; le serveur garde uniquement hash + métadonnées « techniques » (filename, mimeType, size). Les métadonnées métier restent uniquement en local.

### 3.5 Récap

- Formulaire upload : champs optionnels Description, Montant, Catégorie, Tags.
- Liste : affichage optionnel (ex. colonne « Description » ou « Montant »).
- Édition : possibilité de modifier les métadonnées d’un document existant (sans re-chiffrer le fichier).
- `addDocument` et couche db : accepter et persister `metadata` (déjà prévu en Phase 1).

---

## 4. Recherche (full-text sur métadonnées + fichier / client / type)

### 4.1 Objectif

Un **champ de recherche** au-dessus du tableau des documents. La liste affichée est filtrée en temps réel selon le texte saisi (nom de fichier, client, type, description, montant, catégorie, tags).

### 4.2 Périmètre de la recherche

Filtrer les documents dont au moins un des champs suivants contient la chaîne saisie (insensible à la casse, après trim) :

- `filename` ;
- Nom du client (résolu via `clientId` → raison sociale ou nom/prénom) ;
- Type (libellé : Justificatif, Contrat, RH, Autre) ;
- `metadata.description` ;
- `metadata.amount` (converti en string pour recherche, ex. "45.50") ;
- `metadata.category` ;
- `metadata.tags` (chaque tag).

### 4.3 Comportement

- Un seul input « Rechercher » (placeholder ex. « Fichier, client, description, montant… »).
- Pas de bouton « Rechercher » : filtrage **en temps réel** (comme la liste devis/factures).
- La liste affichée = `documents` filtrés par la requête. Si la requête est vide, tout afficher.
- Message si aucun résultat : « Aucun document ne correspond à la recherche. »

### 4.4 Technique

- State : `searchQuery = $state('')`, bindé à l’input.
- Liste dérivée : `filteredDocuments = $derived.by(() => { ... })` qui filtre `documents` selon `searchQuery.trim().toLowerCase()` et les champs ci-dessus (y compris résolution du nom client via `clientsMap`).
- Afficher `filteredDocuments` dans le tableau au lieu de `documents`.

### 4.5 Récap

- Un champ recherche + liste dérivée `filteredDocuments`.
- Recherche sur : filename, client, type, description, amount, category, tags.
- Pas de changement backend ni de schéma.

---

## 5. Export ZIP (facture ou devis + pièces jointes)

### 5.1 Objectif

Depuis l’app, pouvoir **exporter en un clic** un devis ou une facture avec toutes ses pièces jointes du coffre-fort dans une **archive ZIP** : le PDF du devis/facture (tel qu’exporté aujourd’hui) + les fichiers des documents dont `linkedInvoiceId` = cet id, déchiffrés et nommés avec leur `filename`.

### 5.2 Où placer le bouton

- **Option A :** Dans la **liste des documents** (devis/factures), sur chaque ligne : en plus de « Exporter » (PDF seul), un bouton « Exporter avec pièces jointes » (ZIP).
- **Option B :** Dans la modale d’aperçu avant impression (PrintPreviewModal) : un bouton « Télécharger ZIP (document + pièces jointes) ».
- **Option C :** Les deux (liste + modale).

Recommandation : au moins **liste des documents** (ListeDocuments.svelte) : bouton « Export ZIP » sur chaque ligne devis/facture. Optionnellement, le même bouton dans la modale d’impression.

### 5.3 Contenu du ZIP

1. **Fichier 1 :** le PDF du devis ou de la facture (même rendu que l’export PDF actuel). Nom suggéré : `Devis-NUMERO.pdf` ou `Facture-NUMERO.pdf` (ex. `Devis-2026-001.pdf`).
2. **Fichiers 2, 3, … :** pour chaque document du coffre-fort avec `linkedInvoiceId === id` du devis/facture, déchiffrer le document et l’ajouter au ZIP avec son `filename` (en évitant les doublons de noms : ex. suffixe `_1`, `_2` si même nom).

### 5.4 Technique

- **Génération du PDF du devis/facture :** aujourd’hui l’export passe par « Imprimer / PDF » (fenêtre d’impression du navigateur). Pour un ZIP, il faut obtenir le PDF **en mémoire** (Blob). Options :
  - Utiliser une lib côté client qui génère le PDF à partir du HTML (ex. **jsPDF** + **html2canvas**, ou **pdf-lib**, ou **@react-pdf/renderer** si on avait du React). Ou garder le flux actuel et ne mettre dans le ZIP que les **pièces jointes** (sans le PDF du devis/facture), en indiquant à l’utilisateur « Export des pièces jointes uniquement ».
  - **Compromis réaliste Phase 2 :** le ZIP contient **uniquement les pièces jointes** (documents du coffre liés à ce devis/facture). Le PDF du devis/facture reste obtenu via « Exporter » (impression) comme aujourd’hui. On évite d’intégrer une lib PDF lourde tout de suite.
- **Génération du ZIP :** lib côté client, ex. **JSZip**. Créer une instance `JSZip`, pour chaque document lié : `blob = await decryptDocumentBlob(doc)`, `zip.file(doc.filename, blob)`, puis `zip.generateAsync({ type: 'blob' })` et déclencher le téléchargement (lien temporaire + `download`).
- **Flux :** clic « Export ZIP » → récupérer les documents avec `getDocumentsByInvoiceId(devisOrFactureId)` → pour chaque doc, `decryptDocumentBlob(doc)` → ajouter au ZIP → télécharger `Devis-NUMERO-pieces-jointes.zip` ou `Facture-NUMERO-pieces-jointes.zip`.

Si plus tard vous voulez inclure le PDF du devis/facture dans le ZIP, il faudra soit une lib de génération PDF côté client, soit un endpoint serveur qui génère le PDF (ce qui sort du cadre zero-knowledge pour le contenu, donc à réfléchir).

### 5.5 Récap

- Bouton « Export ZIP » (ou « Pièces jointes ZIP ») sur chaque ligne devis/facture dans la liste des documents.
- Contenu du ZIP (Phase 2 minimal) : **tous les documents du coffre dont `linkedInvoiceId` = ce devis/facture**, déchiffrés, avec leur nom de fichier.
- Lib : JSZip (ou équivalent).
- Pas de changement backend ; tout en frontend (lecture IndexedDB + déchiffrement + ZIP).

---

## 6. Ordre d’implémentation suggéré

1. **Recherche** (4) : rapide, pas de nouvelle dépendance, réutilise la liste actuelle.
2. **Métadonnées** (3) : champs au formulaire upload + affichage (et optionnellement édition) ; structure déjà prête.
3. **Drag & drop** (2) : amélioration UX upload sans toucher au flux métier.
4. **Preview** (1) : modale + décodage selon mimeType ; un peu plus de code mais isolé.
5. **Export ZIP** (5) : ajout de JSZip, logique `getDocumentsByInvoiceId` + déchiffrement + génération ZIP + téléchargement ; possiblement en dernier car dépend de la stabilité du lien `linkedInvoiceId`.

---

## 7. Récap livrables Phase 2

| Livrable | Détail |
|----------|--------|
| **Preview** | Bouton « Aperçu » pour PDF/images ; modale avec img ou iframe ; revoke blob à la fermeture. |
| **Drag & drop** | Zone avec dragover/drop ; drop = sélection du fichier (même validation que l’input file). |
| **Métadonnées** | Champs description, montant, catégorie, tags à l’upload ; stockage dans `metadata` ; édition optionnelle. |
| **Recherche** | Champ recherche + liste dérivée filtrée (fichier, client, type, description, montant, catégorie, tags). |
| **Export ZIP** | Bouton « Pièces jointes ZIP » (ou « Export ZIP ») par devis/facture ; ZIP = documents liés déchiffrés ; lib JSZip. |

Aucun changement de schéma IndexedDB ni d’API backend nécessaire pour Phase 2 (sauf si vous ajoutez une route dédiée plus tard). Tout est côté frontend et UX.
