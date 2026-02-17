# Plan stockage et chiffrement – à partir du bouton « Enregistrer en BDD »

## 1. Déclencheur : bouton « Enregistrer en BDD »

- **Où** : éditeur Devis (`CreerDevis.svelte`) et éditeur Facture (`Facture.svelte`).
- **Quand** : l’utilisateur clique sur « Enregistrer en BDD ».
- **Entrée** : document en clair en mémoire (devis ou facture avec `entete`, `lignes`, `blockPositions`, etc.).

---

## 2. Flux côté client (à chaque enregistrement)

### 2.1 Document en clair

- On part du document tel qu’il est en mémoire (objet JS canonique, ex. JSON stringifié de façon déterministe pour le hash).

### 2.2 Hash (intégrité / preuve)

- **Calcul** : hash du document **en clair** (avant chiffrement).
- **Algo** : SHA-256.
- **Entrée** : représentation canonique du document
  (ex. `JSON.stringify(document, clés triées)` ou structure fixe) pour reproductibilité.
- **Usage** :
  - Envoyer ce hash au serveur avec les métadonnées (preuve d’enregistrement, intégrité).
  - Optionnel : stocker le hash en local avec le blob chiffré pour vérification ultérieure.

### 2.3 Clé de chiffrement

- **Source** : reçue du serveur après validation de session (témoin / auth).
- **Stockage** : en mémoire (ou session) le temps de la session ; **pas** en localStorage pour ne pas permettre le déchiffrement sans serveur.
- Si pas de clé disponible (pas connecté) → « Enregistrer en BDD » doit soit refuser, soit enregistrer seulement en local chiffré avec une clé dérivée temporaire (à définir selon UX).

### 2.4 Chiffrement du document

- **Algo** : AES-GCM (symétrique, authentifié).
- **Entrée** : document en clair (même représentation que pour le hash).
- **Sortie** : blob chiffré (IV + ciphertext + tag), ex. en base64 ou buffer.
- **Stockage local** : en IndexedDB (stores `devis` / `factures`) on stocke :
  - `id`, `createdAt` (et autres métadonnées non sensibles si besoin),
  - `payload` (ou équivalent) = blob chiffré,
  - `hash` = hash SHA-256 du document en clair (pour preuve / intégrité).

### 2.5 Envoi au serveur

- **Envoyer** (pas le contenu détaillé du document) :
  - `documentId` (id du devis/facture),
  - `type` : `'devis'` | `'facture'`,
  - `hash` : SHA-256 du document en clair,
  - **métadonnées** : numéro, date émission, objet, clientId, total, etc. (pour liste / recherche côté serveur).
- Le serveur stocke hash + métadonnées ; il ne stocke **pas** le contenu chiffré.

---

## 3. Lecture des documents (déchiffrement)

### 3.1 En ligne (session validée)

1. L’utilisateur se connecte / session validée par le témoin.
2. Le serveur envoie la **clé de déchiffrement** (ou une clé de session dérivée).
3. Le client garde la clé en **mémoire** (variable / session) pour la durée de la session.
4. À chaque lecture d’un document (Liste documents, édition, aperçu) :
   - lecture du blob chiffré en IndexedDB,
   - déchiffrement avec la clé en mémoire,
   - affichage / édition en clair.

### 3.2 Hors ligne (sans serveur)

- **Par défaut** : pas de clé → pas de déchiffrement → données illisibles (comportement voulu).
- **Exception** : voir section 4 (jeton par mail).

---

## 4. Jeton par mail (hors ligne) – à mettre en place plus tard

- **Service dédié** : à créer plus tard.
- **Déclencheur** : l’utilisateur demande explicitement un **jeton** pour pouvoir déchiffrer hors ligne.
- **Livraison** : envoi du jeton **par mail** à l’utilisateur (lien ou code à usage limité).
- **Limites** (à appliquer côté serveur) :
  - **Temps** : validité du jeton (ex. 24 h, 7 jours),
  - **Nombre** : nombre max d’utilisations (ex. 1 ou 5 connexions / ouvertures).
- **Usage côté client** : à la réception du jeton (saisie du code ou clic sur le lien), le client l’envoie au serveur (ou à un endpoint dédié) ; le serveur vérifie les limites puis renvoie une **clé de déchiffrement** (ou un secret pour dériver la clé). Le client peut alors déchiffrer en local pour la durée / le nombre d’usages autorisés.
- **Stockage de la clé hors ligne** : uniquement en mémoire ou sessionStorage pour la session ouverte avec le jeton ; pas de persistance long terme si on veut garder le principe « illisible sans serveur sauf jeton limité ».

---

## 5. Données concernées

- **À chiffrer en local** : contenu des **devis** et **factures** (tout le document : entete, lignes, blockPositions, etc.).
- **Optionnel** : clients, société — selon niveau de confidentialité souhaité (peut rester en clair en local ou être chiffré avec la même clé).
- **Hash + métadonnées** : envoyés au serveur pour chaque devis/facture enregistré.

---

## 6. Résumé séquence « Enregistrer en BDD »

1. Utilisateur clique « Enregistrer en BDD ».
2. Document en clair disponible en mémoire.
3. Calcul du **hash** (SHA-256) du document canonique.
4. Récupération de la **clé** (déjà en mémoire si session validée ; sinon échec ou attente connexion).
5. **Chiffrement** du document (AES-GCM) → blob.
6. **IndexedDB** : sauvegarde `id`, `createdAt`, `hash`, `payload` (blob chiffré), + métadonnées minimales si besoin (ex. `numero`, `documentType`).
7. **Envoi au serveur** : `documentId`, `type`, `hash`, métadonnées (pas le contenu).
8. Retour UX : succès ou erreur (réseau, session invalide, etc.).

---

## 7. Ordre d’implémentation suggéré

1. **Hash** : fonction de hash canonique + envoi hash + métadonnées au serveur (sans chiffrement pour valider le flux).
2. **Chiffrement** : couche AES-GCM côté client ; stockage en IndexedDB en `payload` chiffré ; déchiffrement à la lecture quand clé disponible.
3. **Serveur** : endpoint(s) pour recevoir hash + métadonnées ; endpoint pour fournir la clé après auth/session.
4. **Jeton par mail** : service + limites (temps / nombre) dans un second temps.
