# Auth, session et dérivation de clé

Schémas du flux d'authentification, de session, de déverrouillage et de synchronisation backup.

> Dernière mise à jour : 2026-02-27 — Ajout de la sync backup post-déverrouillage et mise à jour de la déconnexion.

---

## 1. Connexion et session

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant B as Backend
    participant S as Store session (PostgreSQL)

    U->>F: Saisie email + mot de passe
    F->>F: Récupère token CSRF (GET /api/auth/csrf-token)
    F->>B: POST /api/auth/login (credentials, X-CSRF-Token)
    B->>B: Vérifie email + hash mot de passe (argon2)
    B->>S: Crée session (userId)
    B->>F: 200 + user (id, email, nom, …)
    B->>F: Set-Cookie zerok.sid (httpOnly, 7j)
    F->>F: user = data
    F->>F: Affiche écran Déverrouillage (clé non chargée)
```

- **Session** : cookie `zerok.sid`, durée 7 jours. Côté serveur : table `session` (PostgreSQL, via `connect-pg-simple`).
- **CSRF** : token en session, envoyé en header `X-CSRF-Token` sur les requêtes modifiantes.

---

## 2. Dérivation de la clé (déverrouillage)

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend (Unlock.svelte)
    participant IDB as IndexedDB (meta)
    participant Crypto as crypto (dérivation)

    U->>F: Saisie mot de passe
    F->>IDB: getKeyDerivationSalt(userId)
    alt Pas de sel
        F->>Crypto: generateSalt(16)
        F->>IDB: setKeyDerivationSalt(saltBase64, userId)
    end
    F->>Crypto: deriveKey(password, salt)
    Note over Crypto: Clé AES — jamais stockée, jamais envoyée au serveur
    F->>IDB: getKeyCheck(userId)
    alt keyCheck existant
        F->>Crypto: decrypt(keyCheck, key)
        F->>F: Vérifie payload.check === 'zerok-ok'
    else Pas de keyCheck (première fois)
        F->>IDB: getAllDevisRaw / getAllFacturesRaw
        F->>Crypto: decrypt(un document chiffré, key)
        F->>F: Si OK, vérification réussie
        F->>Crypto: encrypt({ check: 'zerok-ok' }, key)
        F->>IDB: setKeyCheck(userId, encrypted)
    end
    F->>F: setEncryptionKey(key) → clé en RAM uniquement
    F->>F: encryptionKeyLoadedStore = true
```

- **Stocké en IndexedDB (store `meta`)** :
  - `keyDerivationSalt-{userId}` : sel en base64 (clair).
  - `keyCheck-{userId}` : `{ payload, iv }` = chiffré de `{ check: 'zerok-ok' }` avec la clé dérivée.
- **Non stocké** : la clé dérivée vit uniquement en mémoire (`_encryptionKey` dans `dbEncrypted.js`). Fermeture d'onglet ou rechargement → clé perdue → redéverrouillage requis.

---

## 3. Sync backup post-déverrouillage

Après la dérivation de clé, `syncAfterUnlock(uid, password)` est appelé (avec `await`) avant d'afficher le menu.

```mermaid
sequenceDiagram
    participant F as Frontend (backupSync.js)
    participant IDB as IndexedDB
    participant B as Backend
    participant Crypto as crypto

    F->>IDB: buildBundle(uid) → clients, devis, factures, société
    alt Bundle vide (nouveau PC ou cache effacé)
        F->>B: GET /api/backup
        alt 404
            B-->>F: Rien à restaurer
        else 200 + payload
            B-->>F: { payload, stateHash }
            F->>Crypto: openArchive(payload, password)
            F->>IDB: applyRestore(uid, bundle)
            F->>F: computeStateHash(bundle local réel)
            F->>B: PUT /api/backup (hash réaligné)
            F->>F: syncResultStore = 'restored_empty'
        end
    else Bundle non vide
        F->>F: computeStateHash(bundle)
        F->>B: GET /api/backup?hash=<hash>
        alt unchanged
            B-->>F: { unchanged: true }
            F->>F: syncResultStore = 'unchanged'
        else payload différent
            B-->>F: { payload, stateHash }
            F->>Crypto: openArchive(payload, password)
            F->>IDB: applyRestore(uid, bundle)
            F->>B: PUT /api/backup (hash réaligné)
            F->>F: syncResultStore = 'restored_overwritten'
        else 404
            F->>Crypto: createArchive(bundle, password)
            F->>B: PUT /api/backup
        end
    end
    F->>F: syncReadyStore = true → menu visible
```

**Point clé zero-knowledge** : le serveur reçoit uniquement un blob opaque (archive chiffrée AES-GCM) et un hash SHA-256 du bundle canonique. Il ne peut pas déchiffrer le contenu.

---

## 4. Vue d'ensemble des stockages

```mermaid
flowchart LR
    subgraph Backend
        Session["Session (userId)"]
        PG[(PostgreSQL)]
        Session --> PG
        Backup["user_backup (payload chiffré + hash)"]
        Backup --> PG
    end

    subgraph Navigateur
        Cookie["Cookie zerok.sid"]
        subgraph Frontend RAM
            Cle["Clé dérivée (AES)"]
            BkpPwd["Mot de passe backup (string)"]
        end
        subgraph IndexedDB
            Meta["meta: salt, keyCheck"]
            Devis["devis (chiffrés)"]
            Factures["factures (chiffrées)"]
            Clients["clients (clair)"]
            Societe["societe (clair)"]
        end
    end

    Cookie --> Session
    Cle --> Devis
    Cle --> Factures
    Cle -.->|"dérivée avec"| Meta
    BkpPwd -.->|"même que mot de passe coffre"| Cle
    BkpPwd -.->|"chiffre/déchiffre"| Backup
```

- **Cookie** : identifie la session côté backend.
- **Clé AES** : uniquement en RAM ; dérivée à partir du mot de passe + sel (meta).
- **Mot de passe backup** : gardé en mémoire le temps de la session pour pouvoir chiffrer/déchiffrer les archives envoyées ou reçues du serveur.
- **IndexedDB** : sel et keyCheck (meta), devis/factures chiffrés, clients/société en clair.
- **user_backup** : blob opaque + hash — le serveur ne peut pas lire le contenu.

---

## 5. Déconnexion

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant B as Backend

    U->>F: Clic « Déconnexion »
    F->>B: POST /api/auth/logout (cookie, X-CSRF-Token)
    B->>B: session.destroy()
    B->>F: 200 + Set-Cookie (suppression)
    F->>F: clearEncryptionKey()  ← clé AES effacée de la RAM
    F->>F: clearBackupPassword() ← mot de passe backup effacé de la RAM
    F->>F: user = null, page = login
```

- Côté serveur : session détruite, cookie invalidé.
- Côté frontend : clé AES ET mot de passe backup effacés de la RAM. Les données dans IndexedDB restent chiffrées — illisibles sans redéverrouillage.
