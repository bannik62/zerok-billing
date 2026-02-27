# Audit Technique – État des implémentations

> Dernière mise à jour : 2026-02-27

---

## 1. Sécurité & Stabilité Backend

### Sessions persistantes ✅ Résolu
`connect-pg-simple` est en place : les sessions sont stockées dans la table `session` (PostgreSQL). Pas de perte de sessions au redémarrage du backend.

### Validation des entrées Auth ✅ Résolu
Les routes `auth.js` et `recovery.js` utilisent des validators Joi (`validators/authValidator.js`) avec regex email, limites de longueur (pwd max 128, nom/prénom max 100, etc.) et sanitisation des entrées.

---

## 2. Zero-Knowledge ✅ Implémenté

### Chiffrement local (AES-GCM)
`frontend/src/lib/dbEncrypted.js` chiffre tous les devis et factures avec AES-GCM avant stockage dans IndexedDB. La clé de chiffrement est dérivée localement depuis le mot de passe (PBKDF2 + sel stocké en `meta`), jamais envoyée au serveur.

### Preuves d'intégrité (SHA-256)
Hash SHA-256 calculé côté client sur le contenu canonique du document. Envoyé au backend via `POST /api/proofs`. Le serveur stocke le hash (table `Proof`) sans jamais voir le contenu.

### Sauvegarde serveur zero-knowledge ✅ Implémenté (2026-02)
Archive chiffrée (même schéma que l'export manuel) stockée sur le serveur (table `user_backup`). Le serveur ne peut pas déchiffrer le contenu. Permet la récupération après perte du cache et le **fonctionnement multiposte** (voir `SAUVEGARDE_ZERO_KNOWLEDGE.md`).

### Écran Unlock ✅ Implémenté
Si la session est valide mais que la clé de chiffrement n'est pas en mémoire (rechargement de page), l'app affiche l'écran **Déverrouiller** (`Unlock.svelte`) et exige le mot de passe avant d'afficher le menu. Il est impossible d'accéder aux données chiffrées sans repasser par cet écran.

---

## 3. Scalabilité & Production

- **Sessions** : store PostgreSQL (résolu, voir § 1).
- **Rate Limiting** : en mémoire. Si plusieurs instances backend à terme, migrer vers un store Redis partagé.
- **Docker** : configuration backend + DB opérationnelle. Frontend servi séparément (build Vite → Nginx ou équivalent).
- **CI/CD** : GitHub Actions — deploy-backend (build, migrate, restart) et deploy-frontend (build, scp). Migrations via `prisma migrate deploy` dans le pipeline.

---

## 4. Points encore ouverts / à surveiller

| # | Sujet | Statut | Commentaire |
|---|-------|--------|-------------|
| 1 | Rate limiting multi-instance | À faire si scale | Redis pour partager l'état entre instances |
| 2 | Coffre-fort : drag & drop upload | À faire | Voir `SPEC_COFFRE_FORT_PHASE2.md` |
| 3 | Export ZIP (facture + docs liés) | À faire | Voir `SPEC_COFFRE_FORT_PHASE2.md` |
| 4 | Clients / société en clair | Par conception | Décision d'architecture : ces données ne sont pas chiffrées localement (niveau de sensibilité moindre). Peut évoluer. |
| 5 | Jeton offline (déchiffrement sans réseau) | À faire plus tard | Voir `PLAN_STOCKAGE_CRYPTO.md` § 4 |
