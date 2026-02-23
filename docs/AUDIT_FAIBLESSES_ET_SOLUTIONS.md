# Faiblesses critiques (audit) – Problème et solution

Ce document résume les deux problèmes critiques identifiés lors de l’audit d’architecture zerok-billing, et les solutions mises en place.

---

## 1. Collision inter-utilisateur sur les preuves (backend)

### Problème

- En base, une **preuve** (hash d’une facture ou d’un document) est enregistrée avec une clé d’unicité **globale** :
  - `Proof` : `invoiceId` unique dans toute la table
  - `DocumentProof` : `documentId` unique dans toute la table
- Les identifiants (invoiceId, documentId) sont générés **côté client**. Deux utilisateurs peuvent donc avoir localement le même id (ex. `facture-123`).
- Le backend fait un **upsert** sur `invoiceId` ou `documentId` seul. Si l’utilisateur B envoie une preuve pour un id déjà utilisé par l’utilisateur A, la preuve de A est **écrasée** par celle de B.
- **Conséquence** : perte d’intégrité des preuves, collision entre comptes.

### Solution

- Rendre l’unicité **par utilisateur** : une même facture/document ne peut avoir qu’une preuve **pour un même utilisateur**, pas dans le monde entier.
- **Schéma Prisma** : contrainte d’unicité sur la **paire** `(userId, invoiceId)` pour `Proof`, et `(userId, documentId)` pour `DocumentProof`, au lieu d’un unique sur `invoiceId` / `documentId`.
- **Services** : les upsert utilisent cette paire (ex. `where: { userId_invoiceId: { userId, invoiceId } }`) pour créer ou mettre à jour la preuve du bon utilisateur sans toucher à celle d’un autre.
- **Migration** : fichier `backend/prisma/migrations/20260220120000_proof_unique_per_user/migration.sql` — à appliquer avec `npx prisma migrate deploy` (ou `migrate dev`) lorsque `DATABASE_URL` est configuré.

---

## 2. Restauration d’archive destructive (frontend)

### Problème

- Lors d’une restauration d’archive, le code faisait un **clear()** sur tous les stores IndexedDB (clients, société, devis, factures, profils de mise en page).
- Cela vide **toute** la base locale du navigateur, y compris les données des **autres comptes** utilisant la même app sur le même poste (multi-comptes sur un même profil).
- **Conséquence** : un utilisateur qui restaure son archive peut **effacer les données d’un autre utilisateur** sans le vouloir.

### Solution

- Avant de réimporter l’archive, ne supprimer **que** les données qui appartiennent à l’utilisateur qui restaure (enregistrements dont `userId === currentUser.id`).
- Pour le cas **legacy** (données sans `userId`), ne supprimer que ces enregistrements-là, pas ceux des autres comptes.
- **Fonction** `clearLocalDataForUser(userId)` dans `frontend/src/lib/db.js` : supprime uniquement les clients, devis, factures, profils et la fiche société du `userId` donné (ou les données sans userId si `userId === null`).
- **SauvegarderRestaurer.svelte** : appelle `clearLocalDataForUser(uid)` au lieu de `db.clients.clear()`, `db.devis.clear()`, etc.

---

## Références

- Rapport d’audit (contexte) : discussion sur la vue d’ensemble, la cartographie et les faiblesses priorisées.
- Fichiers modifiés pour ces corrections :
  - Backend : `prisma/schema.prisma`, `services/proofService.js`, `services/documentProofService.js`, `prisma/migrations/20260220120000_proof_unique_per_user/migration.sql`
  - Frontend : `lib/db.js` (clearLocalDataForUser, paramètre userId sur updateClient, deleteClient, deleteDevis, deleteFacture), `lib/dbEncrypted.js`, `modules/sauvegarder-restaurer/SauvegarderRestaurer.svelte`, `modules/ajouter-client/AjouterClient.svelte`, `modules/liste-documents/ListeDocuments.svelte`
