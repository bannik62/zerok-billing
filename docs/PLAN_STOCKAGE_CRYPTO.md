# Plan stockage et chiffrement

> Dernière mise à jour : 2026-02-27 — Mise à jour suite à l'implémentation complète du chiffrement local et de la sauvegarde serveur zero-knowledge.

---

## 1. Déclencheur : bouton « Enregistrer en BDD »

- **Où** : éditeur Devis (`CreerDevis.svelte`) et éditeur Facture (`Facture.svelte`).
- **Quand** : l'utilisateur clique sur « Enregistrer en BDD ».
- **Entrée** : document en clair en mémoire (devis ou facture avec `entete`, `lignes`, `blockPositions`, etc.).

---

## 2. Flux côté client (à chaque enregistrement)

### 2.1 Document en clair

- On part du document tel qu'il est en mémoire (objet JS canonique).

### 2.2 Hash (intégrité / preuve)

- **Calcul** : hash du document **en clair** (avant chiffrement).
- **Algo** : SHA-256.
- **Entrée** : représentation canonique du document (`JSON.stringify` avec clés triées) pour reproductibilité.
- **Usage** : envoyé au serveur (table `Proof`) comme preuve d'enregistrement sans exposer le contenu.

### 2.3 Clé de chiffrement ✅ Implémentée

**Correction par rapport à la version initiale de ce document :**
La clé de chiffrement **n'est pas reçue du serveur**. Elle est :

- **Dérivée localement** à partir du mot de passe utilisateur (PBKDF2-SHA256, 100 000 itérations, 256 bits).
- **Salée** : le sel est généré à la création du compte et stocké dans IndexedDB (table `meta`, clé `keyDerivationSalt`). Il n'est jamais envoyé au serveur.
- **Stockée uniquement en mémoire** (`_encryptionKey` dans `dbEncrypted.js`) pour la durée de la session. Elle est effacée à la déconnexion ou au rechargement de page.
- **Rederivée** à chaque déverrouillage (Unlock.svelte ou Login.svelte) depuis le mot de passe ressaisi.

Ce modèle garantit que **le serveur ne peut jamais dériver la clé** : ni le mot de passe ni le sel ne lui sont transmis.

### 2.4 Chiffrement du document

- **Algo** : AES-GCM (symétrique, authentifié).
- **Entrée** : document en clair (même représentation que pour le hash).
- **Sortie** : blob chiffré (IV + ciphertext + tag), encodé en base64.
- **Stockage local** : en IndexedDB (`devis` / `factures`) :
  - `id`, `encrypted: true`
  - `payload` = blob chiffré (base64)
  - `iv` = vecteur d'initialisation (base64)

### 2.5 Envoi au serveur (preuves d'intégrité)

- Envoyé à `POST /api/proofs` :
  - `documentId`, `type` (`devis` | `facture`), `hash` SHA-256, métadonnées non sensibles.
- Le serveur stocke hash + métadonnées dans la table `Proof` ; il **ne stocke pas** le contenu.

---

## 3. Sauvegarde serveur zero-knowledge ✅ Implémentée (2026-02)

Une sauvegarde chiffrée de l'ensemble des données locales est automatiquement synchronisée avec le serveur.

- **Format** : archive chiffrée AES-GCM (même schéma que l'export manuel `.zerok-archive`).
- **Clé** : dérivée du mot de passe utilisateur (identique à la clé locale). Le serveur ne peut pas déchiffrer.
- **Stockage serveur** : table `user_backup` (champ `payload` TEXT et `stateHash` TEXT). Le serveur stocke un blob opaque + un hash de l'état.
- **Déclenchement** :
  - **Lecture** (restauration) : à chaque déverrouillage via `syncAfterUnlock()`.
  - **Écriture** : après chaque modification locale via `scheduleBackupUpload()` (debounce 5 s).
- **Cas d'usage** :
  - Récupération après effacement du cache (IndexedDB vide → restauré depuis le serveur).
  - **Multiposte** : connexion sur un nouveau PC → données restaurées automatiquement (voir § 3.1).

### 3.1 Multiposte

```
PC 2 (IndexedDB vide)
       │
       ▼
  Unlock / Login avec le même mot de passe
       │
       ▼
  syncAfterUnlock détecte base vide
       │
       ▼
  GET /api/backup → blob chiffré
       │
       ▼
  openArchive(blob, password) → déchiffrement client-side
       │
       ▼
  applyRestore → IndexedDB réhydraté
       │
       ▼
  Menu disponible avec toutes les données
```

**Prérequis :** même mot de passe sur tous les postes. Le salt de dérivation est inclus dans l'archive ou régénéré, selon le scénario (voir `SAUVEGARDE_ZERO_KNOWLEDGE.md`).

---

## 4. Lecture des documents (déchiffrement)

### 4.1 Normal (clé en mémoire)

1. Utilisateur déverrouille → `_encryptionKey` dérivée et chargée en mémoire.
2. À chaque lecture d'un document : `getAllDevis()` / `getDevis(id)` récupère le blob depuis IndexedDB et déchiffre avec `_encryptionKey`.
3. Affichage en clair dans l'UI.

### 4.2 Hors ligne (sans serveur)

Fonctionnel pour les données déjà présentes dans IndexedDB : le déchiffrement est **100 % local** (pas besoin du serveur). La clé est rederivée du mot de passe.

---

## 5. Jeton par mail (hors ligne avancé) – à faire plus tard

- **Service dédié** : à créer dans un second temps.
- **Déclencheur** : l'utilisateur demande un jeton pour déléguer l'accès ou autoriser un accès temporaire.
- **Limites** (côté serveur) : validité temporelle (ex. 24 h), nombre d'utilisations.
- Ce mécanisme ne remet pas en cause le zero-knowledge : la clé réelle reste dérivée du mot de passe.

---

## 6. Données concernées

| Donnée | Chiffré localement | Dans la sauvegarde serveur | Visible par le serveur |
|--------|-------------------|---------------------------|------------------------|
| Devis | Oui (AES-GCM) | Oui (dans l'archive chiffrée) | Non |
| Factures | Oui (AES-GCM) | Oui (dans l'archive chiffrée) | Non |
| Clients | Non | Oui (dans l'archive chiffrée) | Non |
| Société | Non | Oui (dans l'archive chiffrée) | Non |
| Hash preuves | Hash uniquement | Non | Hash seulement |
| Salt dérivation clé | Non (normal) | Non (stocké localement) | Non |

---

## 7. Résumé séquence « Enregistrer en BDD »

1. Utilisateur clique « Enregistrer en BDD ».
2. Document en clair disponible en mémoire.
3. Calcul du **hash** (SHA-256) du document canonique.
4. Récupération de la **clé** depuis `_encryptionKey` (mémoire) — rederivée du mot de passe au déverrouillage.
5. **Chiffrement** du document (AES-GCM) → blob.
6. **IndexedDB** : sauvegarde `id`, `payload` (blob chiffré), `iv`, `encrypted: true`.
7. **Envoi au serveur** : hash + métadonnées vers `POST /api/proofs` (pas le contenu).
8. **scheduleBackupUpload()** → debounce 5 s → `PUT /api/backup` (archive complète chiffrée).
9. Retour UX : succès ou erreur.
