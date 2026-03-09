# Analyse sync coffre-fort multiposte (A ↔ serveur ↔ B)

Document d’analyse uniquement : tracé du code réel, ordre des opérations, hypothèses de panne. Aucune modification de code.

---

## 1. Stockage du sel (meta)

- **Fichier** : `frontend/src/lib/db.js`
- **Store** : `meta` (clé primaire : `key`).
- **Sel utilisateur** : ligne `key = "keyDerivationSalt-${userId}"`, valeur dans `row.salt` (string base64).
- **Lecture** : `getKeyDerivationSalt(userId)` → `db[STORE_META].get(key)` → `row.salt` ou `null`.
- **Écriture** : `setKeyDerivationSalt(saltBase64, userId)` → `db[STORE_META].put({ key, salt: saltBase64 })`.
- **Effacement** : `clearKeyDataForUser(userId)` → supprime la ligne du sel **et** la ligne keyCheck pour cet userId. **N’est pas appelé** par `clearLocalDataForUser` : celle-ci ne touche qu’à clients, societe, devis, factures, achats, documents. **Le store meta n’est pas vidé par clearLocalDataForUser.**

---

## 2. Poste A — construction et envoi du backup

### 2.1 Unlock puis ajout fichier coffre

- Unlock : `initEncryption(password, uid)` (depuis `Unlock.svelte` ou après login).
  - Si pas de sel en meta : `generateSalt(16)` → `setKeyDerivationSalt(saltBase64, uid)` → sel A écrit.
  - Dérivation clé A, keyCheck créé, `_encryptionKey = clé A`.
- Ajout fichier : `addDocument(...)` dans `dbEncrypted.js` → chiffrement avec `_encryptionKey` (clé A) → `putDocumentRaw` (store `documents`). Les champs `payload`, `iv` sont donc **chiffrés avec clé A**.

### 2.2 Envoi du backup (scheduleBackupUpload / uploadBackupNow)

- **backupSync.js** : `buildBundle(uid)` est appelé.
  - `getKeyDerivationSalt(uid)` : lecture en meta de `"keyDerivationSalt-${uid}"`. **Si rien n’existe encore pour cet uid**, retourne `null` (et éventuellement fallback legacy `META_KEY_SALT`).
  - `getAllDocuments(uid)` : retourne les enregistrements **bruts** du store `documents` (payload déjà chiffré clé A).
  - Retour : `{ ..., keyDerivationSalt: keyDerivationSalt || null, coffreFortDocuments: [...] }`.
- **archive.js** : `createArchive(bundle, password)` → `encrypt(bundle, keyArchive)`. Le `bundle` est sérialisé en JSON puis chiffré. **Si `keyDerivationSalt` est `null`, la clé existe quand même dans l’objet** (`keyDerivationSalt: null`). Après déchiffrement côté B, `restoredBundle.keyDerivationSalt` vaudra `null`.
- **backupApi.js** : `putBackup(JSON.stringify(archive), stateHash)` → envoi du blob au serveur.

**Point de défaillance possible côté A** : au moment du `buildBundle`, `getKeyDerivationSalt(uid)` renvoie `null`. Causes possibles :
- La clé en base est `"keyDerivationSalt-"+uid` (ex. `"keyDerivationSalt-42"`) alors que `uid` côté buildBundle est un type différent (string vs number) et que la lecture se fait avec une clé différente.
- Le sel n’a jamais été écrit pour cet `uid` (autre compte, autre device, ou initEncryption qui n’a pas encore persisté le sel au moment du premier upload).

---

## 3. Serveur

- Stocke le dernier blob et le hash. Aucune lecture du contenu. Pas de source d’erreur sur le sel ou les payloads.

---

## 4. Poste B — réception et restauration

### 4.1 Branche « base vide » (isEmpty)

- **backupSync.js** lignes 141–164 :
  1. `restoredBundle = openArchive(result.payload, password)` → déchiffrement du blob ; `restoredBundle.keyDerivationSalt` = valeur du bundle (string ou `null`).
  2. Si `uid != null && restoredBundle.keyDerivationSalt` :
     - `clearKeyDataForUser(uid)` → suppression sel et keyCheck **pour cet uid** en meta.
     - `setKeyDerivationSalt(restoredBundle.keyDerivationSalt, uid)` → écriture **sel A** en meta.
  3. `initEncryption(password, uid)` :
     - `getKeyDerivationSalt(uid)` → lit la ligne meta pour cet uid → **doit** retourner le sel A qu’on vient d’écrire.
     - Dérivation clé A, mise en mémoire `_encryptionKey = clé A`.
  4. `applyRestore(uid, restoredBundle)` :
     - **restore.js** : `clearLocalDataForUser(uid, { coffre, documents, achats, coffreFortFiles })` → efface clients, societe, devis, factures, achats, documents. **N’efface pas meta.**
     - Puis écriture des clients, societe, devis (via `addDevis`), factures (via `addFacture`), achats (via `addAchat`), coffre (via `putDocumentRaw`). Les payloads coffre sont **inchangés** (déjà chiffrés clé A).
     - En fin de `applyRestore` : `setKeyDerivationSalt(bundle.keyDerivationSalt, uid)` → réécrit le même sel (redondant).

**Point de défaillance possible** : si `restoredBundle.keyDerivationSalt` est `null` ou absent (bundle créé sans sel), l’étape 2 ne fait pas `setKeyDerivationSalt`. Ensuite `initEncryption` lit le sel en meta : soit vide (B tout neuf) → **génération d’un nouveau sel B et clé B**. Donc en mémoire on a **clé B** alors que les payloads coffre sont **clé A** → OperationError au déchiffrement.

### 4.2 Branche « hash différent » (données déjà présentes sur B)

- **backupSync.js** lignes 182–206 :
  1. `restoredBundle = openArchive(result.payload, password)`.
  2. Si `uid != null && restoredBundle.keyDerivationSalt` :
     - `clearKeyDataForUser(uid)` → supprime sel B et keyCheck B.
     - `setKeyDerivationSalt(restoredBundle.keyDerivationSalt, uid)` → écrit sel A.
  3. `clearLocalDataForUser(uid, { coffre: true, documents: true, achats: true, coffreFortFiles: true })` → efface clients, societe, devis, factures, achats, documents. **Meta n’est pas effacé** → le sel A écrit à l’étape 2 est **conservé**.
  4. `initEncryption(password, uid)` → lit le sel en meta (sel A) → dérive clé A → `_encryptionKey = clé A`.
  5. `applyRestore(uid, restoredBundle)` → réécrit tout à partir du bundle (dont coffre en `putDocumentRaw`).

Même logique que « base vide » : si le bundle contient le bon `keyDerivationSalt`, B devrait finir avec clé A et payloads clé A.

**Point de défaillance** : toujours si `restoredBundle.keyDerivationSalt` est absent ou `null`, B garde ou crée un sel B → clé B en mémoire → OperationError.

---

## 5. Ouverture d’un fichier coffre sur B

- **dbEncrypted.js** : `decryptDocumentBlob(record)` utilise `_encryptionKey` (en mémoire) et `record.payload`, `record.iv`. Si `_encryptionKey` est clé B et que le payload a été chiffré avec clé A → **OperationError**.

---

## 6. Synthèse des causes possibles (sans changer le code)

1. **Bundle sans sel côté A**  
   Lors du `buildBundle(uid)` qui alimente le backup, `getKeyDerivationSalt(uid)` retourne `null`.  
   → Vérifier côté A : type et valeur de `uid` (string vs number), présence effective en meta de la clé `"keyDerivationSalt-"+uid` après unlock et après ajout d’un fichier coffre.

2. **Perte du sel dans le bundle (sérialisation / déchiffrement)**  
   Le bundle passé à `createArchive` contient bien `keyDerivationSalt` (string), mais après `openArchive` sur B, `restoredBundle.keyDerivationSalt` est absent ou `null`.  
   → Vérifier que `encrypt`/`decrypt` (archive) ne suppriment pas la clé ; que le JSON sérialisé puis déchiffré conserve bien cette propriété.

3. **Ordre ou concurrence**  
   Hypothèse peu probable vu le code : une autre écriture meta (ou un clear) entre `setKeyDerivationSalt` et `initEncryption` sur B. `clearLocalDataForUser` ne touche pas meta ; seul `clearKeyDataForUser` le fait, et il est appelé **avant** `setKeyDerivationSalt` dans le flux actuel.

4. **Suppressions qui ne se répercutent pas**  
   Si le front fait encore un merge (local B + serveur) au lieu d’appliquer uniquement le bundle serveur, les documents supprimés sur A peuvent réapparaître sur B. Dans le code actuel (après la dernière modif), la branche « hash différent » utilise `restoredBundle` directement pour `applyRestore` (plus de merge) → les suppressions devraient être reflétées. Si ce n’est pas le cas, vérifier qu’aucun autre chemin ne réinjecte l’ancien état local.

---

## 7. Vérifications ciblées (sandbox A / B / serveur)

- **Sur A (après avoir ajouté un fichier coffre)** : avant l’appel PUT du backup, logger ou breakpoint dans `buildBundle` : valeur de `uid`, résultat de `getKeyDerivationSalt(uid)`, et présence de `keyDerivationSalt` dans l’objet retourné.
- **Sur B (après téléchargement du backup)** : après `openArchive` (branches isEmpty et hash différent), log `[zerok sync debug B] after openArchive (...)` avec `keyDerivationSalt`, `keyDerivationSaltType`, `keyDerivationSaltLength`.
- **Sur B (après initEncryption dans le flux de sync)** : vérifier que le sel lu en meta est bien celui qu’on a écrit (sel A) et que la clé dérivée est utilisée pour le déchiffrement des docs coffre (pas une autre clé en mémoire).

Ce document peut servir de base pour des logs ou des tests ciblés sans modifier la logique métier tant que la cause n’est pas identifiée.
