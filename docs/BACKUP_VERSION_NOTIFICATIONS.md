# Notifications de mise à jour du backup serveur (multiposte)

Ce document décrit le mécanisme léger qui permet d’alerter les interfaces encore ouvertes
qu’un **autre poste** a mis à jour la sauvegarde serveur (`/api/backup`), sans re-télécharger
en permanence le blob chiffré.

L’objectif est purement **UX** : éviter qu’un onglet “en retard” continue de travailler sur
un état ancien sans prévenir l’utilisateur.

---

## 1. Modèle et données utilisées

- Modèle Prisma existant : `UserBackup`
  - `stateHash : String` — hash canonique de l’état local (déjà utilisé par `/api/backup`).
  - `updatedAt : DateTime @updatedAt` — mis à jour automatiquement à chaque écriture.

On réutilise ces deux champs pour exposer une **version légère** côté API.

---

## 2. Route backend légère : `GET /api/backup/version`

**Fichier** : `backend/routes/secure.js`  
**Route** : `GET /api/backup/version`

- Authentification requise (comme les autres routes `/api/*`).
- Comportement :
  - Si aucun backup pour l’utilisateur :
    - `404 { error: 'Aucune sauvegarde' }`
  - Sinon :
    - `200 { stateHash: string, updatedAt: string (ISO) }`

Cette route **ne renvoie pas le blob chiffré** : seulement de quoi détecter qu’il y a eu
un changement de backup entre deux appels.

---

## 3. Client API : `getBackupVersion()`

**Fichier** : `frontend/src/lib/backupApi.js`

```js
export async function getBackupVersion() {
  // GET /api/backup/version
  // Retourne :
  // - { status: 200, stateHash, updatedAt } si une sauvegarde existe
  // - { status: 404 } si aucune sauvegarde
}
```

Cette fonction ne gère **aucun état global** : elle encapsule uniquement l’appel réseau
et la forme des données.

---

## 4. Module dédié de version : `backupVersion.js`

**Fichier** : `frontend/src/lib/backupVersion.js`

Rôle : centraliser toute la logique liée à la **version** du backup (hash / timestamp /
polling), séparée de la logique métier de sync (`backupSync.js`).

### 4.1 Stores

- `backupVersionStore`  
  - Type : `{ stateHash: string | null, updatedAt: string | null }`
  - Contient la **dernière version connue** côté client telle que vue depuis le serveur
    (résultat de `/api/backup/version`).

- `serverUpdateAvailableStore`  
  - Type : `boolean`
  - Passe à `true` quand le polling détecte qu’une nouvelle version serveur (nouveau hash)
    est disponible par rapport à `backupVersionStore`.

### 4.2 API du module

- `setKnownServerStateHash(stateHash: string | null | undefined)`  
  - À appeler dès qu’un **PUT /api/backup** réussi est fait depuis ce client
    (`_putCurrentState`, `scheduleBackupUpload`, `uploadBackupNow`).
  - But : ne pas considérer sa propre mise à jour comme “venant d’un autre poste”.

- `startBackupVersionPolling()`  
  - Lance un `setInterval` (60 s) côté navigateur :
    - Appelle `getBackupVersion()`.
    - Met à jour `backupVersionStore`.
    - Si le `stateHash` retourné diffère de celui stocké → `serverUpdateAvailableStore.set(true)`.
  - Idempotent : si déjà démarré, ne crée pas de second interval.

- `stopBackupVersionPolling()`  
  - Nettoie l’intervalle en cours.
  - À appeler au **logout** ou quand on quitte le `page === 'menu'`.

---

## 5. Intégration dans la sync auto : `backupSync.js`

**Fichier** : `frontend/src/lib/backupSync.js`

La logique métier existante (construction de bundle, hash, PUT/GET `/api/backup`) reste
inchangée, à l’exception de **l’enregistrement de la version serveur connue** après chaque PUT :

- Après `_putCurrentState(uid, password)` :
  - Calcul de `currentHash`.
  - `putBackup(...)`.
  - `setKnownServerStateHash(currentHash)` pour aligner `backupVersionStore`.

- Après `scheduleBackupUpload(uid)` (PUT débouncé) :
  - Après `putBackup(...)` :
  - `setKnownServerStateHash(stateHash)`.

- Après `uploadBackupNow(uid)` (PUT immédiat) :
  - Idem : `setKnownServerStateHash(stateHash)`.

