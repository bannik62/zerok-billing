# Auth, session et dérivation de clé

Schémas du flux d’authentification, de session et de déverrouillage (dérivation de la clé de chiffrement).

---

## 1. Connexion et session

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant B as Backend
    participant S as Store session (PostgreSQL / Memory)

    U->>F: Saisie email + mot de passe
    F->>F: Récupère token CSRF (GET /api/auth/csrf-token)
    F->>B: POST /api/auth/login (credentials, X-CSRF-Token)
    B->>B: Vérifie email + hash mot de passe (argon2)
    B->>S: Crée session (userId)
    B->>F: 200 + user (id, email, nom, …)
    B->>F: Set-Cookie zerok.sid (httpOnly, 7j)
    F->>F: user = data, page = menu
    F->>F: Affiche écran Déverrouillage (clé non chargée)
```

- **Session** : cookie `zerok.sid`, durée 7 jours. Côté serveur : table `session` (PostgreSQL si `DATABASE_URL`) ou MemoryStore.
- **CSRF** : token en session, envoyé en header `X-CSRF-Token` sur les requêtes modifiantes.

---

## 2. Dérivation de la clé (déverrouillage coffre)

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant IDB as IndexedDB (meta)
    participant Crypto as crypto (dérivation)

    U->>F: Saisie mot de passe coffre
    F->>IDB: getKeyDerivationSalt(userId)
    alt Pas de sel
        F->>Crypto: generateSalt(16)
        F->>IDB: setKeyDerivationSalt(saltBase64, userId)
    end
    F->>Crypto: deriveKey(password, salt)
    Note over Crypto: Clé AES (jamais stockée)
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
- **Non stocké** : la clé dérivée vit uniquement en mémoire (`_encryptionKey` dans `dbEncrypted.js`). Fermeture d’onglet ou rechargement → clé perdue → il faut redéverrouiller (retaper le mot de passe).

---

## 3. Vue d’ensemble des stockages

```mermaid
flowchart LR
    subgraph Backend
        Session["Session (userId)"]
        PG[(PostgreSQL session)]
        Session --> PG
    end

    subgraph Navigateur
        Cookie["Cookie zerok.sid"]
        subgraph Frontend RAM
            Cle["Clé dérivée (AES)"]
        end
        subgraph IndexedDB
            Meta["meta: salt, keyCheck"]
            Devis["devis (chiffrés)"]
            Factures["factures (chiffrées)"]
        end
    end

    Cookie --> Session
    Cle --> Devis
    Cle --> Factures
    Cle -.->|"dérivée avec"| Meta
```

- **Cookie** : identifie la session côté backend.  
- **Clé** : uniquement en RAM ; dérivée à partir du mot de passe + sel (meta).  
- **IndexedDB** : sel et keyCheck (meta), devis/factures chiffrés avec la clé dérivée.

---

## 4. Déconnexion

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant B as Backend

    U->>F: Clic « Déconnexion »
    F->>B: POST /api/auth/logout (cookie, X-CSRF-Token)
    B->>B: session.destroy()
    B->>F: 200 + Set-Cookie (suppression)
    F->>F: clearEncryptionKey()
    F->>F: user = null, page = login
```

- Côté serveur : session détruite, cookie invalidé.  
- Côté frontend : clé effacée de la RAM, utilisateur ramené à l’écran de login.
