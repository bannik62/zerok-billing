# Documentation détaillée : implémentation paiement (Stripe)

Ce document décrit tout ce qui a été mis en place pour le flux **signature + paiement en ligne** dans zerok-billing : configuration Pro, résumé de paiement à l’envoi pour signature, token de paiement, page « Document accepté » avec icônes, et création de session Stripe jusqu’aux pages succès/annulé.

---

## 1. Vue d’ensemble du flux

1. **Pro** : configure sa clé Stripe (menu **Paiement**).
2. **Pro** : crée une facture, envoie pour signature (bouton dans Liste documents). Le front envoie `amountCents` + `currency` ; le backend enregistre la signature + le résumé paiement.
3. **Client** : reçoit l’email, clique sur « Signer / Accepter le document ». Une seule page s’ouvre (backend ou front) avec « Document accepté » et les **icônes des moyens de paiement** (Stripe).
4. **Client** : clique sur « Payer avec Stripe » → appel backend `POST /api/payment/create-session` → redirection vers Stripe Checkout → paiement → redirection vers `/paiement/succes` ou `/paiement/annule`.

Références : [PLAN_PAIEMENT_STRIPE_ETAPES.md](./PLAN_PAIEMENT_STRIPE_ETAPES.md), [PARCOURS_ENVOI_SIGNATURE_PAIEMENT.md](./PARCOURS_ENVOI_SIGNATURE_PAIEMENT.md), [README_STRIPE.md](../README_STRIPE.md) (à la racine si présent).

---

## 2. Modèles de données (Prisma)

### 2.1 PaymentConfig

- **Rôle** : stocker les credentials par utilisateur et par provider (Stripe, etc.).
- **Table** : `payment_config`.
- **Champs** : `id`, `userId`, `provider` (ex. `'stripe'`), `credentials` (JSON, ex. `{ secretKey: 'sk_...' }`), `createdAt`, `updatedAt`.
- **Contrainte** : `@@unique([userId, provider])`.
- **Utilisation** : lecture par `getConfiguredProviders(userId)` et par la route `create-session` pour récupérer la clé Stripe.

### 2.2 PaymentToken

- **Rôle** : token de paiement one-shot après signature d’une facture (courte durée de vie, ex. 1 h).
- **Table** : `payment_token`.
- **Champs** : `id`, `token` (unique), `invoiceId`, `userId`, `expiresAt`, `createdAt`.
- **Création** : après `confirmSignRequest` réussi, si `documentType === 'facture'`.
- **Validation** : `validatePaymentToken(token)` vérifie existence et non-expiration.

### 2.3 InvoicePaymentSummary

- **Rôle** : résumé de paiement par facture (montant + devise), rempli à l’envoi pour signature.
- **Table** : `invoice_payment_summary`.
- **Champs** : `id`, `invoiceId` (unique), `userId`, `amountCents`, `currency` (défaut `'EUR'`), `createdAt`.
- **Remplissage** : dans `POST /api/documents/send-for-signature`, si `documentType === 'facture'` et que le body contient `amountCents` et `currency`.
- **Lecture** : dans `POST /api/payment/create-session` pour créer la session Stripe avec le bon montant.

### 2.4 SignRequest (existant, utilisé tel quel)

- **Retour enrichi** : `confirmSignRequest(token)` retourne désormais un objet `{ status, documentType?, invoiceId?, userId? }` (et non plus une simple chaîne `'ok'`), pour savoir si le document est une facture et créer le payment token.

---

## 3. Backend – services

### 3.1 signRequestService.js

- **confirmSignRequest(token)**  
  Retourne `{ status: 'ok', documentType, invoiceId, userId }` en cas de succès, sinon `{ status: 'expired'|'used'|'invalid' }`. Permet à la route `/sign/confirm` et à `/api/sign/confirm` de savoir s’il s’agit d’une facture et de créer le payment token.

### 3.2 paymentTokenService.js

- **createPaymentToken({ invoiceId, userId })**  
  Génère un token aléatoire, expiration 1 h, enregistrement en base. Retourne `{ token, expiresAt }`.
- **validatePaymentToken(token)**  
  Vérifie que le token existe et n’est pas expiré. Retourne `{ invoiceId, userId }` ou `null`.

### 3.3 paymentConfigService.js

- **getConfiguredProviders(userId)**  
  Retourne la liste des providers configurés pour l’utilisateur (ex. `['stripe']`), sans exposer les clés. Utilisé pour afficher les icônes de paiement sur la page « Document accepté ».

---

## 4. Backend – validateurs (secureValidator.js)

### 4.1 send-for-signature

- **Champs ajoutés** : `amountCents` (entier, optionnel), `currency` (string 3 caractères, optionnel).
- **Règle métier** : pour `documentType === 'facture'`, `amountCents` et `currency` sont **obligatoires** (vérification dans `validateSendForSignatureBody`).
- **Constantes** : `AMOUNT_CENTS_MIN` (50 = 0,50 €, minimum Stripe), `AMOUNT_CENTS_MAX`, `CURRENCY_LENGTH`.

### 4.2 payment config

- **validatePaymentConfigBody(body)**  
  Valide `{ provider: 'stripe', secretKey }` (secretKey non vide, longueur max `PAYMENT_SECRET_KEY_MAX`). Utilisé par `PUT /api/payment/config`.

---

## 5. Backend – routes

### 5.1 Routes publiques (app.js, sans auth)

- **GET /api/sign/confirm?token=...**  
  Confirme la signature, crée un payment token si facture, récupère les providers configurés. Retourne en JSON : `{ status, documentType?, paymentToken?, providers? }`. Utilisé par le front Svelte (SignConfirm.svelte).

- **POST /api/payment/create-session**  
  Body : `{ paymentToken, provider }`. Valide le token, charge le résumé (InvoicePaymentSummary) et la config (PaymentConfig), appelle le plugin Stripe, retourne `{ redirectUrl }`. Gestion d’erreurs Stripe (400 + message). Exclue de la vérification CSRF (page statique /sign/confirm).  
  Référence : TODO dans le code pour un futur webhook Stripe.

- **GET /sign/confirm?token=...**  
  Page HTML autonome (lien dans l’email). Affiche « Document accepté » et, si facture avec providers configurés, une section « Régler cette facture » avec icône Stripe et script JS qui appelle `POST /api/payment/create-session` puis redirige vers `redirectUrl`.

- **GET /paiement/succes**  
  Page HTML « Paiement effectué » + lien « Accéder au site » (URL de base = `BACKEND_PUBLIC_URL` ou premier `allowedOrigins`).

- **GET /paiement/annule**  
  Page HTML « Paiement annulé » + lien « Accéder au site ».

### 5.2 Routes protégées (secure.js, requireAuth)

- **GET /api/payment/config**  
  Retourne `{ providers: [ { provider, configured: true }, ... ] }` (pas de clé secrète).

- **PUT /api/payment/config**  
  Body : `{ provider: 'stripe', secretKey }`. Upsert dans `PaymentConfig` (credentials = `{ secretKey }`).

- **POST /api/documents/send-for-signature**  
  Body étendu : en plus des champs existants, `amountCents` et `currency` (obligatoires pour une facture). Après création du SignRequest, si `documentType === 'facture'`, upsert dans `InvoicePaymentSummary` avec `invoiceId`, `userId`, `amountCents`, `currency`.

---

## 6. Backend – plugin Stripe (plugins/stripe.js)

- **createCheckoutSession({ secretKey, amountCents, currency, invoiceId, successUrl, cancelUrl, description? })**  
  Crée une session Stripe Checkout (mode payment, 1 line_item avec `price_data`), retourne `{ redirectUrl: session.url }`.
- **Validations** : clé commençant par `sk_`, montant entier ≥ 0, devise 3 caractères.
- **Gestion d’erreurs** : `StripeAuthenticationError`, `StripeInvalidRequestError`, message d’erreur lisible renvoyé à l’appelant.
- **Dépendance** : package npm `stripe`.

---

## 7. Frontend

### 7.1 Menu (Menu.svelte)

- Nouvel onglet **Paiement** qui affiche le composant `Paiement.svelte`.

### 7.2 Paiement.svelte (modules/paiement/)

- **Rôle** : configuration Stripe par le Pro.
- Au chargement : `GET /api/payment/config` pour afficher « Stripe est configuré » ou non.
- Formulaire : champ « Clé secrète Stripe » (type password), bouton Enregistrer. À la soumission : `PUT /api/payment/config` avec `{ provider: 'stripe', secretKey }`. Message de succès ou d’erreur.

### 7.3 SignConfirm.svelte (modules/auth/)

- **Rôle** : page de confirmation de signature quand l’utilisateur ouvre l’app avec `/sign/confirm?token=...`.
- Appel à `GET /api/sign/confirm?token=...`. Si `status === 'ok'` et que la réponse contient `paymentToken` et `providers`, affichage de la section « Régler cette facture » avec icône Stripe (badge officiel) et bouton « Payer avec Stripe ».
- Au clic : `POST /api/payment/create-session` avec `paymentToken` et `provider: 'stripe'`. Si `redirectUrl` dans la réponse → `window.location.href = redirectUrl` ; sinon affichage du message d’erreur (ex. « Clé Stripe invalide »).

### 7.4 ListeDocuments.svelte

- **Envoi pour signature** : pour une facture (`docType === 'facture'`), calcul de `amountCents = Math.round((totalTTC ?? total) * 100)` et `currency = 'eur'`. Vérification du **montant minimum 0,50 €** (50 centimes) : si inférieur, message d’erreur « Le montant minimum pour paiement en ligne est de 0,50 € » et pas d’envoi. Sinon, `amountCents` et `currency` sont ajoutés au body de `POST /api/documents/send-for-signature`.

---

## 8. Constantes (backend/config/constants.js)

- `PAYMENT_PROVIDERS` : `['stripe']`.
- `PAYMENT_SECRET_KEY_MAX` : 256.
- `CURRENCY_LENGTH` : 3.
- `AMOUNT_CENTS_MIN` : 50 (0,50 €, minimum Stripe).
- `AMOUNT_CENTS_MAX` : 999_999_99.

---

## 9. Migrations Prisma

- **payment_config** : déjà existante (Phase A).
- **payment_token** : table `payment_token` (token, invoice_id, user_id, expires_at, created_at).
- **invoice_payment_summary** : table `invoice_payment_summary` (invoice_id unique, user_id, amount_cents, currency, created_at).

Sur le serveur (VPS), appliquer les migrations après déploiement du code :

```bash
docker compose run --rm backend npx prisma migrate deploy
```

---

## 10. Sécurité et exclusions CSRF

- La route **POST /api/payment/create-session** est appelée depuis la page HTML statique `/sign/confirm` (sans session). Elle est **exclue de la vérification CSRF** dans `middleware/csrf.js` (chemin `payment/create-session` ou `api/payment/create-session`). Le flux reste sécurisé car l’autorisation repose sur le **payment token** (créé après signature, courte durée de vie).

---

## 11. Améliorations apportées par un autre agent (Continue)

Les changements suivants ont été intégrés (commit « fix(payment): Improve Stripe integration... ») et sont conservés :

- **Validation Stripe** : dans le plugin, vérification de la clé (`sk_`), du montant (entier) et de la devise (3 lettres) ; gestion des erreurs Stripe (auth, requête invalide) avec messages clairs.
- **Montant minimum 0,50 €** : `AMOUNT_CENTS_MIN = 50` ; côté front, blocage de l’envoi pour signature si facture < 0,50 € avec message explicite.
- **Logging** : log de la création de session Stripe dans `app.js` ; en cas d’erreur Stripe, renvoi 400 avec le message au lieu d’un 500.
- **Documentation** : `README_STRIPE.md` (config, workflow, limites, sécurité, schéma d’architecture, améliorations futures).
- **TODO** : commentaire dans `app.js` pour l’implémentation future du webhook Stripe (persistance du statut de paiement).

---

## 12. Récapitulatif des fichiers modifiés ou ajoutés

| Fichier | Rôle |
|--------|------|
| **Backend** | |
| `app.js` | Routes publiques : /api/sign/confirm, POST create-session, GET /sign/confirm (HTML), /paiement/succes, /paiement/annule ; gestion d’erreurs Stripe. |
| `config/constants.js` | Constantes paiement (dont AMOUNT_CENTS_MIN = 50). |
| `middleware/csrf.js` | Exclusion de create-session de la vérification CSRF. |
| `plugins/stripe.js` | createCheckoutSession avec validations et gestion d’erreurs Stripe. |
| `prisma/schema.prisma` | Modèles PaymentToken, InvoicePaymentSummary (PaymentConfig existant). |
| `routes/secure.js` | GET/PUT /api/payment/config ; send-for-signature avec amountCents/currency et upsert InvoicePaymentSummary. |
| `services/paymentTokenService.js` | createPaymentToken, validatePaymentToken. |
| `services/paymentConfigService.js` | getConfiguredProviders. |
| `services/signRequestService.js` | confirmSignRequest retourne un objet avec documentType, invoiceId, userId. |
| `validators/secureValidator.js` | amountCents/currency pour send-for-signature ; validatePaymentConfigBody. |
| Migrations | payment_token, invoice_payment_summary. |
| **Frontend** | |
| `modules/menu/Menu.svelte` | Onglet Paiement, import et affichage de Paiement.svelte. |
| `modules/paiement/Paiement.svelte` | Formulaire clé Stripe, GET/PUT config. |
| `modules/auth/SignConfirm.svelte` | Affichage icônes paiement, appel create-session, redirection. |
| `modules/liste-documents/ListeDocuments.svelte` | Envoi amountCents/currency pour facture ; validation min 0,50 €. |
| **Docs** | |
| `README_STRIPE.md` | Doc utilisateur et technique Stripe (ajout externe). |
| `docs/DOC_PAIEMENT_IMPLEMENTATION.md` | Ce document. |

---

## 13. Évolutions possibles

- Webhook Stripe pour persister le statut de paiement (payé / échoué) et mettre à jour la facture ou une table dédiée.
- Chiffrement au repos de la clé Stripe dans `PaymentConfig`.
- Support d’un autre provider (ex. Mollie) : nouveau plugin, ajout dans `PAYMENT_PROVIDERS` et dans l’affichage des icônes (backend HTML + SignConfirm.svelte).
- Pages succès/annulé plus riches (lien vers la facture, récap montant, etc.) ou hébergées sur le front avec routage Svelte.
