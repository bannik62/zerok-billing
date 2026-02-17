# Audit Technique & Recommandations pour l'Implémentation

## 1. Sécurité & Stabilité Backend (Priorité Haute)

### Problème : Gestion des Sessions en RAM
Actuellement, `express-session` utilise le `MemoryStore` par défaut.
- **Risque** : Fuites de mémoire en prod, déconnexion de tous les utilisateurs à chaque redémarrage du serveur.
- **Solution** : Passer à un store persistant (PostgreSQL via `connect-pg-simple` ou Redis).
- **Code concerné** : `backend/server.js`.

### Problème : Validation des Entrées Auth
La validation dans `backend/routes/auth.js` est trop basique.
- **Risque** : Injection de données trop longues (DoS DB) ou mal formées.
- **Solution** : Ajouter des vérifications strictes :
  - Regex Email.
  - Limites de caractères (ex: pwd max 128 chars, nom/prénom max 100).
- **Code concerné** : `backend/routes/auth.js`.

## 2. Implémentation Zero-Knowledge (Cœur du Projet - Manquant)

### Architecture Actuelle
Les données sensibles (devis, factures) sont stockées dans `IndexedDB` via `frontend/src/lib/db.js`.
- **État actuel** : Stockage en CLAIR (`plainClone`). Aucune protection si le poste est compromis.

### Implémentation Requise (Client-Side)
1. **Génération de Clé** : À la connexion (`login`), dériver une clé de chiffrement (AES-GCM) depuis le mot de passe utilisateur ou la recevoir du serveur (si chiffrée par une clé maître).
2. **Chiffrement** : Modifier `addDevis`, `addFacture` dans `db.js`.
   - Avant d'écrire dans IndexedDB : `crypto.subtle.encrypt(AES-GCM, key, data)`.
3. **Déchiffrement** : Modifier `getDevis`, `getFacture`, `getAllDevis`.
   - À la lecture : `crypto.subtle.decrypt(...)`.
4. **Preuves (Hash)** :
   - Calculer le SHA-256 du document.
   - Envoyer ce hash au serveur pour preuve d'intégrité (Timestamping).

### Implémentation Requise (Server-Side)
- **Endpoint Preuves** : Créer les routes dans `backend/routes/secure.js` pour recevoir et stocker les hashs (`invoiceHash`) dans la table `Proof` (déjà définie dans `schema.prisma`).

## 3. Scalabilité & Production

- **Sessions** : (Voir point 1 - résolu par le store persistent).
- **Rate Limiting** : Actuellement en mémoire. Si plusieurs instances backend, utiliser un store Redis pour le rate limiter.
- **Docker** : La configuration actuelle est bonne pour le backend + DB. Le frontend est servi séparément (Vite), ce qui est optimal.
