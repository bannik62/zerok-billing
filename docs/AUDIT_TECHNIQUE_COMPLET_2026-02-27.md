# 📋 AUDIT TECHNIQUE COMPLET — ZEROK-BILLING

**Date :** 2026-02-27  
**Repository :** bannik62/zerok-billing  
**Scope :** Architecture, Cryptographie, Sécurité Backend, Qualité de Code

---

## 1️⃣ ARCHITECTURE GÉNÉRALE

### 1.1 Structure et Séparation Frontend/Backend ✅

```
zerok-billing/
├── backend/              # Node.js/Express + PostgreSQL
│   ├── routes/           # auth.js, secure.js, recovery.js
│   ├── services/         # Accès données (Prisma)
│   ├── middleware/       # requireAuth, csrf, errorHandler
│   ├── validators/       # Joi schema validation
│   ├── lib/              # prisma, logger, config
│   ├── config/           # env.js (centralisé)
│   ├── plugins/          # stripe.js
│   ├── handlers/         # stripeWebhook.js
│   └── prisma/           # schema.prisma, migrations
├── frontend/             # Svelte + Vite (PWA)
│   ├── src/
│   │   ├── modules/      # Composants (Auth, Menu, etc.)
│   │   ├── lib/          # Crypto, API, DB, CSRF
│   │   ├── assets/
│   └── package.json
└── docs/                 # Spécifications et audit
```

**Points positifs :**
- ✅ Séparation claire frontend/backend
- ✅ Services découplés de Prisma
- ✅ Middleware centralisé (auth, CSRF, erreurs)
- ✅ Configuration centralisée (backend/config/env.js)

**Points d'amélioration :**
- ⚠️ Pas de séparation par domaine métier (clients, devis, factures)
- ⚠️ Middleware et route logic mélangées (ex : app.js contient du code métier)

### 1.2 Patterns Utilisés

| Pattern | Implémentation | Status |
|---------|----------------|--------|
| Middleware | express (requireAuth, csrf, errorHandler) | ✅ |
| Validation | Joi schemas (authValidator, secureValidator) | ✅ |
| Service Layer | userService, proofService, signRequestService | ✅ |
| ORM | Prisma v6.19.2 | ✅ |
| Rate Limiting | express-rate-limit (auth endpoints) | ✅ |
| CSRF Protection | Token session + header validation | ✅ |
| Logging | Custom logger (console.log/error conditionnels) | ✅ |

### 1.3 Points de Couplage et Dette Technique

**Couplage Moyen :**
- `app.js` = main + routes (284 lignes mélange config, routes publiques, HTML inline)
- Devrait séparer : routes → routes/public.js, HTML → views/
- Accès direct à Prisma dans app.js (lignes 95-110) → À extraire dans service

**Configuration Stripe en clair en base :**
- TODO ligne 259 : "implémenter webhook Stripe"
- Clé secrète stockée sans chiffrement

**Dette Technique Identifiée :**

| Issue | Severity | Location |
|-------|----------|----------|
| Webhook Stripe non implémenté | ÉLEVÉ | app.js:259 TODO |
| Stripe key chiffrement manquant | ÉLEVÉ | backend/routes/secure.js:206-220 |
| Multi-devise : EUR uniquement | MOYEN | README_STRIPE.md |
| Logger basique (pas de rotation) | FAIBLE | backend/lib/logger.js |
| Rate limit en mémoire | MOYEN | À migrer Redis pour scaling |

---

## 2️⃣ COUCHE CRYPTOGRAPHIQUE (FRONTEND)

### 2.1 Algorithmes et Paramètres

```javascript
// ✅ AES-GCM (NIST approved)
const ALGO = 'AES-GCM';
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12;  // ✅ 96 bits, standard

// ✅ PBKDF2 robuste
const PBKDF2_ITERATIONS = 310_000;  // NIST 2024 : min 100k
const HASH_ALGO = 'SHA-256';
```

- ✅ AES-GCM : excellent choix (authentification intégrée)
- ✅ IV 12 bytes : standard NIST
- ✅ PBKDF2 310k iterations : conforme OWASP 2024
- ✅ Sel 16 bytes aléatoire

### 2.2 Flux de Dérivation de Clé

```
[Password] + [Recovery Phrase] → PBKDF2(SHA-256, 310k) → [CryptoKey AES-256]
                                       ↓ [Salt 16 bytes]
                                    [Never sent to server]
```

✅ Conforme : OWASP Password Storage, NIST SP 800-132  
⚠️ Recovery phrase option crée une clé différente (design intentionnel)

### 2.3 Gestion de la Clé en Mémoire

- ✅ Clé jamais persistée (pas IndexedDB, pas localStorage)
- ✅ Effacée à la déconnexion
- ⚠️ Pas de crypto.subtle.wrapKey() (clé reste en clair en RAM)
- ⚠️ Risque XSS : Script injecté peut lire _encryptionKey

### 2.4 Stockage des Données Chiffrées (IndexedDB)

- ✅ Données chiffrées au repos
- ✅ IV unique par document
- ⚠️ IndexedDB accessible au même domaine (même-origin policy)
- ⚠️ Service Worker peut accéder à IndexedDB (PWA)

### 2.5 Conformité Zero Knowledge

- ✅ Clé dérivée localement (jamais envoyée au serveur)
- ✅ Dévis/factures chiffrés avant IndexedDB
- ✅ Hash SHA-256 local (preuve d'intégrité)
- ✅ Serveur stocke UNIQUEMENT : User, Proofs (hash), AUCUN contenu devis/facture

---

## 3️⃣ SÉCURITÉ BACKEND

### 3.1 Middlewares de Sécurité

- ✅ Helmet (15 headers)
- ✅ CORS whitelist
- ✅ PostgreSQL session store
- ✅ Content-Security-Policy, X-Frame-Options, HSTS

### 3.2 Protection des Routes

- ✅ requireAuth : vérification session
- ✅ CSRF token 32 bytes, validation header
- ✅ Exclusions appropriées (payment, webhooks)

### 3.3 Validation des Entrées (Joi)

- ✅ EMAIL_MAX_LENGTH = 254 (RFC 5321)
- ✅ PASSWORD_MAX_LENGTH = 128
- ✅ Coverage : register, login, proofs, documents/proof, payment/config

### 3.4 Gestion des Sessions

- ✅ httpOnly, secure (prod), SameSite=lax
- ✅ 7 day TTL
- ✅ PostgreSQL store persistant
- ✅ Session secret validation en prod

### 3.5 Exposition de Données Sensibles

- ✅ Stripe key NOT returned to client
- ✅ User password hash NEVER returned
- ✅ SELECT spécifique (exclusion champs sensibles)

---

## 4️⃣ SURFACE D'ATTAQUE

### 4.1 Routes Publiques Intentionnelles ✅

- GET /api/auth/csrf-token, POST /register, /login, /logout
- GET /api/sign/confirm, POST /payment/create-session
- POST /webhooks/stripe, GET /api/health

### 4.2 Injections

| Type | Mitigation | Status |
|------|------------|--------|
| SQL | Prisma parameterized | ✅ MINIMAL |
| XSS | Joi + Svelte escaping + esc() | ✅ |
| CSRF | Token validation | ✅ |
| NoSQL | N/A (PostgreSQL) | - |

### 4.3 Dépendances npm

- ✅ Prisma, argon2, express, helmet, joi, stripe récents
- ⚠️ axios légèrement ancien (vérifier CVE)

### 4.4 Secrets Exposés

- ✅ No API keys hardcoded
- ✅ .gitignore complet (.env exclu)
- ✅ .env.example template only

---

## 5️⃣ QUALITÉ DU CODE

### 5.1 Taille de Fichiers

| Fichier | Lignes | Status |
|---------|--------|--------|
| backend/app.js | 284 | ⚠️ TROP GROS |
| backend/routes/secure.js | 357 | ⚠️ Trop large |
| frontend/src/lib/dbEncrypted.js | 150+ | ✅ |

### 5.2 Duplications

- ❌ Vérification userId répétée dans chaque route sécurisée
- Recommandation : middleware `requireUserId`

### 5.3 Gestion des Erreurs

- ✅ Try-catch systématique, error handler global
- ❌ sendMail().catch(() => {}) — silent failure
- ❌ Erreurs validation : string simple, pas structuré

### 5.4 Code Mort

- ✅ Services et routes utilisés
- ⚠️ recovery.js : vérifier si en production

---

## 6️⃣ BASE DE DONNÉES

### 6.1 Schéma Prisma

- ✅ User, Proof, DocumentProof, UserBackup, PaymentConfig
- ✅ InvoicePaymentSummary, PaymentToken, SignRequest
- ✅ @@unique([userId, invoiceId]), @@index([userId])

### 6.2 Données Sensibles en Clair

| Champ | Risque | Mitigation |
|-------|--------|------------|
| passwordHash | ✅ Argon2 | - |
| credentials (PaymentConfig) | ❌ CRITIQUE | Stripe key en clair |

### 6.3 Index Manquants

- ⚠️ Proof : index signedAt, invoiceHash
- ⚠️ SignRequest : index expiresAt
- ⚠️ InvoicePaymentSummary : index userId

---

## 7️⃣ POINTS CRITIQUES (Priorisés)

### 🔴 CRITIQUE (P1)

| ID | Issue | Impact | Fix |
|----|-------|--------|-----|
| P1.1 | Stripe key en clair (PaymentConfig) | DB compromise = clés exposées | Chiffrer avec clé maître ou Vault |
| P1.2 | Webhook Stripe non implémenté | Statut paiement jamais persisté | Implémenter handleStripeWebhook |
| P1.3 | Payment token réutilisable | Replay attack | Marquer token "used" après validation |

### 🟠 ÉLEVÉ (P2)

| ID | Issue | Fix |
|----|-------|-----|
| P2.1 | Erreurs email silencieuses | Retourner 503 + feedback user |
| P2.2 | Rate limit en mémoire | Migrer Redis |
| P2.3 | Log audit manquant | audit(action, userId, details) |
| P2.4 | CORS : no-origin accepté | Rejeter si origin absent |
| P2.5 | Chiffrement clé Stripe | Comme P1.1 |

### 🟡 MOYEN (P3)

- P3.1 Recovery phrase tests
- P3.2 Refactor app.js
- P3.3 Validation errors structurées
- P3.4 XSS mitigation systématique
- P3.5 Headers Helmet additionnels

### 🔵 FAIBLE (P4)

- P4.1 Logging production (Winston/Pino)
- P4.2 Swagger/OpenAPI
- P4.3 TypeScript (optionnel)
- P4.4 Tests E2E
- P4.5 npm update axios

---

## 📊 RÉSUMÉ EXÉCUTIF

### Scores Sécurité

| Dimension | Score | Status |
|-----------|-------|--------|
| Cryptographie | 9/10 | ✅ Excellent |
| Authentication | 8/10 | ✅ Bon |
| Authorization | 8/10 | ✅ Bon |
| Input Validation | 8/10 | ✅ Bon |
| Data Protection | 6/10 | ⚠️ Stripe key |
| Session Management | 8/10 | ✅ Bon |
| Error Handling | 7/10 | ⚠️ Silent failures |
| Logging & Audit | 6/10 | ⚠️ Minimal |
| Dependency Security | 8/10 | ✅ |
| Code Quality | 7/10 | ⚠️ App.js |
| **Overall** | **7.5/10** | ✅ BON |

### Top 5 Priorités

1. 🔴 Stripe Key Encryption (P1) — 2-4h
2. 🔴 Webhook Stripe Implementation (P1) — 4-6h
3. 🔴 Payment Token Replay Prevention (P1) — 1-2h
4. 🟠 Email Error Handling (P2) — 2h
5. 🟠 Redis Rate Limiter (P2) — 3-4h

### Forces

- ✅ Zero-Knowledge bien implémenté
- ✅ Crypto solide (AES-GCM, PBKDF2 310k)
- ✅ CSRF, validation Joi, Helmet
- ✅ Pas de secrets dans le code

### Faiblesses

- ❌ Stripe secret key en clair
- ❌ Webhook non implémenté
- ❌ Token paiement réutilisable
- ❌ Erreurs email silencieuses
- ❌ app.js monolithique

---

## 🎯 RECOMMANDATIONS

**Court terme (1-2 semaines) :**
1. Chiffrement clé Stripe
2. Implémentation webhook + statut paiement
3. Prévention replay token
4. Feedback erreurs email
5. CORS origin strict

**Moyen terme (1-3 mois) :**
1. Refactor app.js
2. Redis rate limiter
3. Logging production
4. Tests d'intégration
5. TypeScript (optionnel)

**Long terme (3+ mois) :**
1. Secrets manager
2. Chiffrement DB at rest
3. Audit trail
4. Rate limiting par user

---

*Audit complété le 2026-02-27 — Repository : bannik62/zerok-billing*
