# Spec Phase 1 – Coffre-fort de documents (MVP)

Document de spécification pour la Phase 1 du coffre-fort zero-knowledge : modèle de données, API preuves, écrans et flux. Aucun code implémenté ici.

---

## 1. Modèle de données

### 1.1 IndexedDB (frontend) – nouveau store `documents`

**Base :** même base Dexie `zerok-billing`, **version passée à 9** (nouvelle migration).

**Nouveau store :** `documents`, clé primaire `id`.

```txt
documents: 'id, clientId, linkedInvoiceId, type, uploadedAt'
```

Index secondaires pour :
- filtrer par `clientId` ;
- filtrer par `linkedInvoiceId` (documents attachés à un devis/facture) ;
- tri par `uploadedAt`.

**Structure d’un enregistrement :**

| Champ             | Type    | Obligatoire | Description |
|-------------------|---------|-------------|-------------|
| `id`              | string  | oui         | UUID (crypto.randomUUID()) |
| `clientId`        | string  | oui         | Référence vers un client (store `clients`) |
| `linkedInvoiceId` | string? | non         | Id d’un devis ou facture (store `devis` ou `factures`) |
| `type`            | string  | oui         | `justificatif` \| `contrat` \| `rh` \| `autre` |
| `filename`       | string  | oui         | Nom original du fichier |
| `mimeType`        | string  | oui         | Ex. `application/pdf`, `image/jpeg` |
| `size`            | number  | oui         | Taille en octets (fichier original) |
| `uploadedAt`      | string  | oui         | ISO 8601 (ex. `new Date().toISOString()`) |
| `metadata`        | object? | non         | `{ description?, amount?, category?, tags? }` pour usage futur |
| `encrypted`       | boolean | oui         | Toujours `true` si clé de chiffrement active |
| `payload`         | string  | oui         | Contenu chiffré (AES-GCM) en base64 |
| `iv`              | string  | oui         | Vecteur d’initialisation en base64 (12 bytes) |

Le **hash** du fichier (SHA-256 hex) n’est **pas** stocké en base : il est calculé à l’upload et envoyé au serveur dans la preuve ; pour une éventuelle vérification locale ultérieure, on peut le stocker en option (`hash?: string`).

**Résumé :**

- Stockage : **uniquement côté client** (IndexedDB).
- Chiffrement : **même clé** que pour devis/factures (dérivée du mot de passe, sel dans `meta`).
- Pas de contenu envoyé au serveur, seulement une **preuve** (voir ci‑dessous).

---

### 1.2 Backend – preuves documents (aucun contenu)

**Principe :** le serveur ne stocke **jamais** le contenu des fichiers, seulement une preuve d’intégrité (identifiant + hash + métadonnées légères).

**Nouveau modèle Prisma : `DocumentProof`**

```prisma
model DocumentProof {
  id          String   @id @default(cuid())
  documentId  String   @unique @map("document_id")
  userId      String   @map("user_id")
  fileHash    String   @map("file_hash")   // SHA-256 hex, 64 car.
  filename    String
  mimeType    String   @map("mime_type")
  size        Int
  uploadedAt  DateTime @map("uploaded_at")
  invoiceId   String?  @map("invoice_id")  // optionnel : devis ou facture lié

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([documentId])
  @@index([invoiceId])
}
```

**Relation :** `User` doit avoir une relation `documentProofs DocumentProof[]`.

**Migration :** nouvelle migration Prisma (ex. `20260218120000_add_document_proof`) qui crée la table `document_proof` (nom de table au choix, ex. `document_proof`).

---

## 2. API preuves documents

**Authentification :** même middleware que les routes existantes (`requireAuth`), session valide requise.

### 2.1 `POST /api/documents/proof`

Enregistre une preuve pour un document (hash + métadonnées). Aucun corps de fichier.

**Body (JSON) :**

| Champ        | Type   | Obligatoire | Contrainte |
|--------------|--------|-------------|------------|
| `documentId` | string | oui         | Max 100 car. |
| `fileHash`   | string | oui         | SHA-256 hex, 64 car. |
| `filename`   | string | oui         | Max 255 car. |
| `mimeType`   | string | oui         | Max 100 car. |
| `size`       | number | oui         | Entier ≥ 0 |
| `invoiceId`  | string? | non         | Max 100 car. (devis ou facture lié) |

**Réponses :**

- `201` : `{ ok: true, documentId: "..." }`
- `400` : paramètres manquants ou invalides (hash pas hex 64, etc.)
- `401` : non authentifié
- `500` : erreur serveur

**Logique serveur :** upsert par `documentId` pour l’utilisateur courant (même sémantique que `Proof` pour les factures) : si le `documentId` existe déjà pour ce `userId`, mise à jour (hash, filename, etc.) ; sinon création.

### 2.2 `POST /api/documents/verify` (optionnel en Phase 1)

Vérification en lot, sur le même principe que `POST /api/proofs/verify`.

**Body :** `{ checks: { documentId: string, fileHash: string }[] }`

**Réponse :** `{ results: { documentId: string, verified: boolean }[] }`

Utile pour afficher une colonne « Vérifié » dans la liste des documents (comme pour les devis/factures). Peut être ajouté en Phase 1 ou juste après.

---

## 3. Chiffrement et hash côté client

### 3.1 Clé

- **Réutilisation** de la clé de chiffrement existante (dérivée du mot de passe utilisateur, sel dans `meta`).
- Pas de nouvelle clé dédiée aux fichiers.

### 3.2 Hash fichier (preuve d’intégrité)

- **Entrée :** `File` ou `ArrayBuffer` du fichier brut (avant chiffrement).
- **Algo :** SHA-256.
- **Sortie :** chaîne hexadécimale 64 caractères (même format que `invoiceHash`).
- Usage : envoyée dans `POST /api/documents/proof` comme `fileHash`.

### 3.3 Chiffrement / déchiffrement fichier

- **Algo :** AES-GCM (même que devis/factures), 256 bits, IV 12 bytes aléatoire par fichier.
- **Entrée chiffrement :** `File` ou `ArrayBuffer` + clé.
- **Sortie chiffrement :** `{ payload: string (base64), iv: string (base64), mimeType: string, originalSize: number }`.
- **Déchiffrement :** entrée `{ payload, iv, mimeType }` + clé → sortie `Blob` (pour téléchargement ou preview).

Les gros fichiers (> 10–20 MB) peuvent être traités plus tard en chunks (hors scope MVP).

---

## 4. Écrans et parcours (MVP)

### 4.1 Menu / navigation

- **Entrée « Coffre-fort »** (ou « Documents ») dans le menu principal, au même niveau que « Liste documents », « Créer devis », etc.
- Route dédiée (ex. `/coffre-fort` ou `/documents`).

### 4.2 Liste des documents (écran principal coffre-fort)

- **Tableau** : colonnes a minima  
  - Fichier (nom + icône type)  
  - Client (nom résolu via `clientId`)  
  - Type (`justificatif`, `contrat`, `rh`, `autre`)  
  - Taille (format lisible, ex. 245 Ko)  
  - Date d’upload  
  - Lien facture/devis (optionnel : numéro ou « — »)  
  - Actions : Télécharger, Supprimer  
- **Filtres (optionnel MVP) :** par client, par type (dropdown).
- **Recherche (optionnel MVP) :** sur nom de fichier, comme pour la liste devis/factures.
- Pas d’upload depuis cet écran en Phase 1 si on privilégie l’upload depuis la fiche facture/devis (voir 4.4).

### 4.3 Upload (zone d’upload)

- **Composant réutilisable** « Upload document » :
  - Champs : fichier (input file), client (liste déroulante), type (liste déroulante), **lien facture/devis** (optionnel, liste déroulante des devis + factures).
  - Limite de taille affichée (ex. 20 MB) et vérifiée avant chiffrement.
  - Types de fichiers acceptés : PDF, images (JPEG, PNG), éventuellement DOC/DOCX (à définir).
- **Flux :**
  1. Sélection fichier + client + type + optionnellement facture/devis.
  2. Calcul du hash (SHA-256) du fichier brut.
  3. Chiffrement du fichier (même clé que session).
  4. Enregistrement en IndexedDB (store `documents`).
  5. Appel `POST /api/documents/proof` avec `documentId`, `fileHash`, `filename`, `mimeType`, `size`, `invoiceId` (si renseigné).
  6. Retour à la liste ou message de succès.

### 4.4 Lien avec facture / devis

- **Depuis l’écran Coffre-fort :** lors de l’upload, champ optionnel « Lier à un devis / une facture » (liste des devis et factures récents ou recherche par numéro).
- **Depuis la fiche d’un devis ou d’une facture (Phase 1 ou juste après) :** bloc « Documents attachés » :
  - Liste des documents dont `linkedInvoiceId` = id du devis/facture courant.
  - Bouton « Joindre un document » qui ouvre le même composant d’upload avec `linkedInvoiceId` pré-rempli.
- Affichage du nombre de pièces jointes (ex. « 3 pièces jointes ») sur la liste des devis/factures (optionnel MVP).

### 4.5 Téléchargement

- Clic « Télécharger » sur une ligne de la liste.
- Récupération de l’enregistrement en IndexedDB, déchiffrement avec la clé session, création d’un `Blob`, déclenchement du téléchargement (nom = `filename` stocké).
- Gestion du cas « pas de clé » (utilisateur déconnecté ou session sans mot de passe) : message clair, pas de déchiffrement.

### 4.6 Suppression

- Suppression dans IndexedDB uniquement (MVP).
- Optionnel : appeler un endpoint « révoquer preuve » côté serveur (ex. DELETE ou flag) pour garder la traçabilité ; sinon la preuve reste en base (hash + métadonnées) même si le fichier local est supprimé. À trancher (recommandation : ne pas supprimer la preuve serveur en Phase 1, pour audit).

---

## 5. Intégration technique existante

- **Dexie :** ajout du store `documents` en version 9 ; pas de changement des autres stores.
- **dbEncrypted / clé :** même `initEncryption(password)` et même clé pour chiffrer/déchiffrer les fichiers.
- **Preuves factures/devis :** inchangées (`Proof`, `POST /api/proofs`, `POST /api/proofs/verify`). Les preuves documents sont **séparées** (`DocumentProof`, `POST /api/documents/proof`).
- **CSRF / auth :** mêmes middlewares que pour le reste de l’app (pas de cookie spécial pour les documents).
- **Liste documents (devis/factures) :** pas de modification obligatoire en Phase 1 ; le lien « Documents attachés » peut être ajouté sur la page détail d’un devis/facture (ou dans un onglet).

---

## 6. Récap livrables Phase 1

| Lot | Détail |
|-----|--------|
| **Données** | Store IndexedDB `documents` (Dexie v9), structure document complète (id, clientId, linkedInvoiceId, type, filename, mimeType, size, uploadedAt, metadata?, encrypted, payload, iv). |
| **Backend** | Modèle Prisma `DocumentProof`, migration, `POST /api/documents/proof`, (optionnel) `POST /api/documents/verify`. |
| **Crypto** | `hashFile(file)` → hex 64 ; `encryptFile(file, key)` → { payload, iv, mimeType, originalSize } ; `decryptFile(encrypted, key)` → Blob. |
| **Upload** | Composant upload (fichier, client, type, lien facture optionnel) → hash → chiffrement → IndexedDB → preuve serveur. |
| **Liste** | Écran liste documents (tableau + téléchargement + suppression). |
| **Lien facture** | Champ optionnel « Lier à un devis/facture » à l’upload ; (optionnel) bloc « Documents attachés » sur fiche devis/facture. |

Pas dans le MVP Phase 1 : preview PDF/images, OCR, signature électronique, partage temporaire, multi-utilisateurs, quotas par plan.

---

## 7. Ordre d’implémentation suggéré

1. **Backend :** schéma Prisma `DocumentProof` + migration + service + `POST /api/documents/proof`.
2. **Frontend – données :** Dexie v9 + store `documents` + helpers `addDocument`, `getDocument`, `getAllDocuments`, `getDocumentsByClientId`, `getDocumentsByInvoiceId`, `deleteDocument` (et couche chiffrée si tout passe par la même clé).
3. **Frontend – crypto :** `hashFile`, `encryptFile`, `decryptFile` (dans `$lib/crypto/` ou `$lib/crypto/fileEncryption.js`).
4. **Frontend – preuves :** `sendDocumentProof(document)` appelant `POST /api/documents/proof`.
5. **Frontend – UI :** écran liste documents + composant upload + entrée menu « Coffre-fort ».
6. **Lien facture/devis :** champ optionnel à l’upload + (optionnel) bloc « Documents attachés » sur la fiche devis/facture.
7. **(Optionnel)** `POST /api/documents/verify` + colonne « Vérifié » dans la liste documents.

Cette spec peut servir de référence pour l’implémentation sans modifier le présent fichier jusqu’à la fin de la Phase 1.
