# Workflows – Zero-K Billing

Document qui décrit **comment l'app fonctionne vraiment** (flux connexion, clé, données, backup).

---

## Chiffrement vs Hash – Qui fait quoi ?

| | Chiffrement (AES-GCM) | Hash (SHA-256) |
|---|------------------------|----------------|
| **Où ?** | **100 % frontend** | **Frontend** calcule, **backend** stocke |
| **À quoi ça sert ?** | Rendre illisibles les devis/factures dans IndexedDB (sans la clé, on ne peut pas lire). | Preuve d'intégrité : le serveur garde uniquement un hash du document, pas le contenu. |
| **Clé / entrée** | Clé dérivée du **mot de passe** (PBKDF2), gardée **uniquement en mémoire**, **jamais envoyée** au serveur. | Le **contenu du document** est hashé côté front ; le hash est envoyé au back. |
| **Qui stocke quoi ?** | Frontend : IndexedDB (payload chiffré + IV). | Backend : table `Proof` (invoiceId, hash, signature, timestamp). |

En résumé : **chiffrement** = protection locale. **Hash** = preuve d'intégrité côté serveur sans exposer le contenu.

---

## 1. Au démarrage de l'app

```
Ouverture de l'app
       │
       ▼
  fetchUser()  ────  GET /api/auth/me  (cookie session)
       │
       ├── Session INVALIDE ──► page = 'auth'  (Login / Register)
       │
       └── Session VALIDE ──► encryptionKeyLoadedStore = false ?
                                       │
                               ┌───────┴────────┐
                               │                │
                         Clé EN MÉMOIRE    Pas de clé
                         (rare, même onglet) (rechargement)
                               │                │
                               ▼                ▼
                          page = 'menu'    Écran Unlock
                                           (ressaisie mot de passe)
```

**Important :** depuis l'implémentation de l'écran `Unlock.svelte`, l'utilisateur **ne peut jamais** accéder au menu sans avoir fourni son mot de passe dans cette session. Ce mot de passe est nécessaire pour dériver la clé de chiffrement ET pour déchiffrer la sauvegarde serveur.

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
       │  • encryptionKeyLoadedStore.set(true)
       ▼
  syncAfterUnlock(uid, password)   ← NOUVEAU
       │  • Construit le bundle local (buildBundle)
       │  • Si vide → tente de télécharger depuis le serveur (getBackup)
       │  • Si non vide → calcule le hash local et compare au serveur
       │  • Restaure / envoie la sauvegarde selon le cas
       │  • syncReadyStore.set(true) quand terminé
       ▼
  page = 'menu'
```

---

## 3. Déverrouillage (Unlock.svelte – rechargement de page)

```
Session valide mais clé absente
       │
       ▼
  Unlock.svelte : saisie du mot de passe
       │
       ▼
  initEncryption(password)  →  _encryptionKey en mémoire
       │
       ▼
  await syncAfterUnlock(uid, password)   ← IMPORTANT : await ici
       │  (même logique que le flux Login)
       ▼
  encryptionKeyLoadedStore.set(true)  →  App.svelte rend le menu
```

Le `await` est crucial : le menu ne s'affiche qu'**après** que la sync soit terminée, évitant l'affichage vide avant restauration.

---

## 4. Sync backup au déverrouillage (backupSync.js)

### Cas 1 — Base locale vide (premier accès ou cache effacé)

```
buildBundle → isEmpty = true
       │
       ▼
  GET /api/backup
       │
       ├── 404 → rien sur le serveur → { restored: false }
       │
       └── 200 + payload
               │
               ▼
         openArchive(payload, password)  ← déchiffrement client-side
               │
               ▼
         applyRestore(uid, bundle)  ← réhydrate IndexedDB
               │
               ▼
         _putCurrentState()  ← réaligne le hash serveur avec le hash local réel
               │
               ▼
         syncResultStore = 'restored_empty'
```

### Cas 2 — Base locale non vide (session courante avec données)

```
buildBundle → isEmpty = false
       │
       ▼
  computeStateHash(bundle)  → hash local
       │
       ▼
  GET /api/backup?hash=<hash>
       │
       ├── 404 → serveur n'a rien → PUT backup (createArchive + upload)
       │
       ├── 200 + unchanged: true → tout est à jour → syncResultStore = 'unchanged'
       │
       └── 200 + payload différent
               │
               ▼
         openArchive + applyRestore + _putCurrentState
               │
               ▼
         syncResultStore = 'restored_overwritten'
```

### Cas 3 — Multiposte (nouveau PC)

Scénario : même utilisateur, même mot de passe, PC différent.

```
PC 2 – IndexedDB vide
       │
       ▼
  Login / Unlock → syncAfterUnlock
       │
       ▼  (Cas 1 ci-dessus)
  Télécharge le blob chiffré depuis le serveur
       │
       ▼
  Déchiffre avec le mot de passe (même clé dérivée → même résultat)
       │
       ▼
  Toutes les données restaurées automatiquement sur PC 2
```

**Prérequis multiposte :** utiliser le **même mot de passe** sur tous les postes (la clé de chiffrement est dérivée du mot de passe + sel stocké localement, donc le sel doit aussi correspondre — voir `SAUVEGARDE_ZERO_KNOWLEDGE.md` § Multiposte).

---

## 5. Création / modification de données (writes)

```
addDevis / addFacture / updateDevis / updateFacture / deleteDevis / deleteFacture
addClient / updateClient / deleteClient / saveSociete
       │
       ▼
  Écriture dans IndexedDB (via dbEncrypted.js ou db.js)
       │
       ▼
  scheduleBackupUpload(uid)   ← debounce 5 s
       │
       ▼
  (après 5 s sans nouvelle modification)
  buildBundle → computeStateHash → PUT /api/backup
```

Le debounce évite d'envoyer un PUT à chaque frappe de touche. Seule la dernière modification dans la fenêtre de 5 s déclenche l'upload.

---

## 6. Lecture des devis / factures

```
getAllDevis() / getDevis(id)
       │
       ├── _encryptionKey présente
       │   → Récupère payload + iv depuis IndexedDB
       │   → Déchiffre avec la clé → retourne en clair à l'UI
       │
       └── _encryptionKey = null
           → Lit depuis IndexedDB tel quel
           → Si données chiffrées (encrypted: true) : illisibles pour l'UI
             → Impossible en pratique depuis l'implémentation de Unlock.svelte
```

---

## 7. Données jamais chiffrées

| Donnée | Fichier utilisé | Chiffré ? |
|--------|------------------|-----------|
| Devis | dbEncrypted.js | Oui (AES-GCM) |
| Factures | dbEncrypted.js | Oui (AES-GCM) |
| Clients | db.js | Non |
| Société | db.js | Non |
| Profils layout | db.js | Non |
| Sel de dérivation | db.js (meta) | Non (normal pour un salt) |

**Note :** bien que clients et société ne soient pas chiffrés individuellement dans IndexedDB, ils sont inclus dans l'archive chiffrée lors de la sauvegarde serveur (`createArchive`). Ils ne sont donc pas lisibles sur le serveur.

---

## 8. Déconnexion

```
logout()
  →  POST /api/auth/logout
  →  clearEncryptionKey()   (_encryptionKey = null)
  →  clearBackupPassword()  (mot de passe backup effacé de la mémoire)
  →  page = 'auth'
```

Après déconnexion, la clé et le mot de passe backup sont effacés de la mémoire. Les données dans IndexedDB restent chiffrées ; elles seront déchiffrées au prochain déverrouillage.

---

## 9. Schéma récapitulatif global

```
                    ┌────────────────────────────────────┐
                    │         Ouverture de l'app         │
                    └─────────────────┬──────────────────┘
                                      │
                         GET /api/auth/me (cookie)
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                                               │
       Session invalide                               Session valide
              │                                               │
              ▼                                               ▼
       Écran Login/Register                          Clé en mémoire ?
              │                                               │
              │                               ┌──────────────┼──────────────┐
              │                               │                             │
              │                             Oui                           Non
              │                               │                             │
              ▼                               │                             ▼
       Login + initEncryption(mdp)            │                       Écran Unlock
              │                               │                    (ressaisie mot de passe)
              └───────────────────────────────┤                             │
                                              │                             │
                                   await syncAfterUnlock(uid, mdp)  ←──────┘
                                              │
                                  ┌───────────┴────────────┐
                                  │                        │
                           Base locale vide          Base locale non vide
                                  │                        │
                           Télécharge + restaure    Compare hash local/serveur
                                  │                        │
                                  └───────────┬────────────┘
                                              │
                                        page = 'menu'
                                              │
                                   ┌──────────┴──────────┐
                                   │                     │
                               Écriture               Lecture
                               (add/update/delete)     (get/getAll)
                                   │                     │
                             scheduleBackup           Déchiffrement
                             (debounce 5 s)           avec _encryptionKey
                                   │
                              PUT /api/backup
```
