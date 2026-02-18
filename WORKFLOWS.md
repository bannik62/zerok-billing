# Workflows – Zero-K Billing

Document qui décrit **comment l’app fonctionne vraiment** (flux connexion, clé, données).

---

## Chiffrement vs Hash – Qui fait quoi ?

| | Chiffrement (AES-GCM) | Hash (SHA-256) |
|---|------------------------|----------------|
| **Où ?** | **100 % frontend** | **Frontend** calcule, **backend** stocke |
| **À quoi ça sert ?** | Rendre illisibles les devis/factures dans IndexedDB (sans la clé, on ne peut pas lire). | Preuve d’intégrité : le serveur garde uniquement un hash (+ signature) du document, pas le contenu. |
| **Clé / entrée** | Clé dérivée du **mot de passe** (PBKDF2), gardée **uniquement en mémoire** dans le navigateur, **jamais envoyée** au serveur. | Le **contenu du document** (devis/facture) est hashé côté front ; le hash (et la signature) sont envoyés au back. |
| **Qui stocke quoi ?** | Frontend : IndexedDB (payload chiffré + IV). | Backend : table Proof (invoiceId, hash, signature, timestamp). Le serveur ne voit **jamais** le contenu du devis/facture. |

En résumé : **chiffrement** = protection locale (vol d’appareil, lecture du disque). **Hash** = preuve que le document n’a pas été modifié, stockée côté serveur sans exposer le contenu.

---

## 1. Au démarrage de l’app

```
Ouverture de l’app
       │
       ▼
  fetchUser()  ────  GET /api/auth/me  (cookie session)
       │
       ├── Session VALIDE ──► page = 'menu'  (on affiche le Menu)
       │                      ⚠️ Le mot de passe n’est PAS ressaisi
       │                      → initEncryption() jamais appelé
       │                      → _encryptionKey = null
       │
       └── Session INVALIDE (ou pas de cookie)
                      ──► page = 'auth'  (écran Login/Register)
```

- **Si tu arrives sur le menu sans voir l’écran de connexion** : la session (cookie) était encore valide. Dans ce cas **la clé de chiffrement n’est jamais dérivée** : `_encryptionKey` reste `null`.
- **Si tu passes par l’écran Login** : tu entres ton mot de passe → `initEncryption(password)` est appelé → la clé est dérivée et stockée en mémoire → `_encryptionKey` est définie.

---

## 2. Connexion (écran Login)

```
Utilisateur saisit email + mot de passe
       │
       ▼
  POST /api/auth/login  (serveur vérifie, pose un cookie)
       │
       ▼
  initEncryption(password)
       │  • Récupère ou crée le sel (getKeyDerivationSalt) dans IndexedDB
       │  • deriveKey(password, salt) → clé AES
       │  • setEncryptionKey(key)  → _encryptionKey en mémoire
       ▼
  onSuccess()  →  page = 'menu'
```

Après ce flux, **devis et factures** passent par la couche chiffrée (AES-GCM). Les **clients / société / profils** continuent d’être lus/écrits en clair via `db.js`.

---

## 3. Création d’un devis (depuis le Menu)

```
Menu  →  "Créer devis"  →  formulaire  →  Valider  →  addDevis(devis)
                                                    │
                                                    ▼
                                    dbEncrypted.addDevis()
                                                    │
                        ┌───────────────────────────┴───────────────────────────┐
                        │                                                       │
                  _encryptionKey présente                              _encryptionKey = null
                        │                                                       │
                        ▼                                                       ▼
              Chiffrement AES-GCM                              dbAddDevis(devis)  (db.js)
              putDevisRaw({ id, encrypted: true,                → stocké EN CLAIR
                           payload, iv })                       dans IndexedDB
```

Donc aujourd’hui :

- **Avec clé** (tu viens de te connecter via Login) : le devis est chiffré puis stocké.
- **Sans clé** (session restaurée sans repasser par Login, ou premier usage sans connexion) : le devis est stocké **en clair**.

Même logique pour **factures** : chiffrées seulement si `_encryptionKey` est définie.

---

## 4. Lecture des devis (liste, édition, export)

```
getAllDevis() / getDevis(id)
       │
       ▼
  dbEncrypted.getAllDevis() / getDevis()
       │
       ├── _encryptionKey présente
       │   → Récupère les enregistrements bruts (payload + iv)
       │   → Déchiffre avec la clé
       │   → Retourne les devis en clair à l’UI
       │
       └── _encryptionKey = null
           → return dbGetAllDevis() / dbGetDevis()
           → Lit directement depuis IndexedDB (objets tels qu’ils sont stockés)
           → Si les devis ont été stockés chiffrés (encrypted: true), tu récupères
             { id, encrypted: true, payload, iv } → l’UI ne peut pas afficher correctement.
```

Donc en pratique :

- **Tu t’es connecté une fois, tu n’as pas fermé l’onglet** : clé en mémoire, lecture/écriture cohérentes.
- **Tu as fermé l’onglet puis rouvert** : la session peut encore être valide (cookie), mais `_encryptionKey` est perdue → lecture via `db.js` → si les données étaient chiffrées, la liste / l’édition peuvent être cassées ou illisibles.

---

## 5. Données jamais chiffrées

Ces données ne passent **pas** par la couche chiffrée ; elles sont toujours lues/écrites en clair (IndexedDB via `db.js`) :

| Donnée        | Fichier utilisé | Chiffré ? |
|---------------|------------------|-----------|
| Devis         | dbEncrypted.js   | Oui, si clé présente |
| Factures      | dbEncrypted.js   | Oui, si clé présente |
| Clients       | db.js (réexporté) | Non |
| Société       | db.js (réexporté) | Non |
| Profils layout| db.js (réexporté) | Non |
| Sel de dérivation | db.js (meta)   | Non (normal pour un salt) |

---

## 6. Déconnexion

```
logout()
  →  POST /api/auth/logout
  →  clearEncryptionKey()   (_encryptionKey = null)
  →  page = 'auth'
```

Après déconnexion, la clé est effacée de la mémoire. Les prochaines lectures/écritures de devis et factures se font sans clé (comportement décrit en 3 et 4).

---

## 7. Résumé des incohérences

1. **Session valide au chargement** : on peut arriver sur le menu sans jamais appeler `initEncryption` → pas de clé alors que des données peuvent être déjà chiffrées en base.
2. **Création sans clé** : possible de créer des devis/factures quand `_encryptionKey` est null → stockage en clair.
3. **Clients / société** : toujours en clair ; pas de lien avec la clé utilisateur.

Pour que le workflow soit clair et sécurisé, il faudrait par exemple :

- Exiger **toujours** un passage par Login (mot de passe) pour accéder au menu (pas de “session valide seule” sans ressaisir le mot de passe), **ou**
- Persister la clé de façon sécurisée (ex. dérivée à chaque fois à partir du mot de passe ressaisi ou d’un secret débloqué par le mot de passe) pour que “session valide” rime avec “clé disponible”.

---

## 8. Schéma récapitulatif

```
                    ┌─────────────────────────────────────────┐
                    │            Ouverture de l’app           │
                    └────────────────────┬────────────────────┘
                                         │
                         GET /api/auth/me (cookie)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
       Session invalide            Session valide
              │                          │
              ▼                          ▼
       Écran Login                 Menu affiché
              │                    (pas de mot de passe)
              │                    _encryptionKey = null
              ▼
       Login + initEncryption(mdp)
              │
              ▼
       _encryptionKey définie
              │
              ▼
       Menu affiché
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
 addDevis /          getDevis /
 addFacture          getAllDevis
    │                   │
    ▼                   ▼
 Chiffrement         Déchiffrement
 (si clé)            (si clé)
    │                   │
    ▼                   ▼
 IndexedDB            UI (liste, PDF…)
 (payload + iv)       (données en clair en mémoire)
```

En résumé : le workflow “chiffrement” dépend entièrement du fait que **Login ait été fait dans ce même chargement de page** ; dès qu’on recharge l’app et qu’on repasse uniquement par “session valide”, la clé n’est plus là et le modèle devient incohérent ou cassé pour les données déjà chiffrées.
