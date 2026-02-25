# Plan d’implémentation : paiement Stripe (1 plugin)

Étapes pour intégrer le paiement en ligne avec **un seul plugin (Stripe)**. L’ordre est pensé pour avancer par blocs testables.

---

## Où et quand le Pro entre sa clé Stripe

- **Où** : dans l’application zerok-billing, dans une section dédiée, par exemple **Paramètres** (ou **Compte**) → **Paiement** / **Moyens de paiement**. Une page ou un encart avec un formulaire : « Clé secrète Stripe » (et éventuellement « Clé publique Stripe » si besoin plus tard).
- **Quand** : une fois, quand le Pro veut accepter les paiements en ligne (ou pour passer en test). Il n’a pas à ressaisir la clé à chaque facture. Il peut revenir sur cette page pour modifier ou supprimer la clé.
- **Stockage** : côté backend, en base (table dédiée « config paiement » par utilisateur). La clé secrète doit être stockée de façon sécurisée (chiffrement au repos si possible, jamais loggée ni renvoyée au front).

---

## Étapes d’implémentation

### Phase A — Config Stripe (le Pro enregistre sa clé)

| Étape | Description | Fichiers / actions |
|-------|-------------|---------------------|
| **A1** | Backend : modèle et stockage de la config paiement par utilisateur (provider Stripe, clé secrète). | Prisma : nouveau modèle `PaymentConfig` (userId, provider, secretKey chiffré ou en clair en première version, createdAt). Migration. |
| **A2** | Backend : API pour enregistrer / lire la config (authentifié). | Routes protégées : `GET /api/payment/config` (retourne si Stripe est configuré, sans exposer la clé), `PUT /api/payment/config` (body : `{ provider: 'stripe', secretKey: 'sk_...' }`). |
| **A3** | Frontend : page ou section « Paiement » dans les paramètres. | Nouvelle page (ex. `Parametres.svelte` ou `Paiement.svelte`) accessible depuis le menu. Formulaire : champ « Clé secrète Stripe » (type password), bouton Enregistrer. Appel `PUT /api/payment/config`. Afficher « Stripe configuré » si `GET /api/payment/config` indique que Stripe est présent. |

---

### Phase B — Résumé paiement (montant + devise à l’envoi pour signature)

| Étape | Description | Fichiers / actions |
|-------|-------------|---------------------|
| **B1** | Backend : stocker le résumé (invoiceId, amountCents, currency) à l’envoi pour signature. | Option 1 : ajouter colonnes `amount_cents`, `currency` au modèle `SignRequest` (nullable pour les anciennes lignes). Option 2 : table `PaymentSummary(invoiceId, userId, amountCents, currency)` avec contrainte unique sur invoiceId+userId. Lors de `POST /api/documents/send-for-signature`, accepter `amountCents` et `currency` dans le body et les enregistrer (sur SignRequest ou PaymentSummary). |
| **B2** | Backend : valider et documenter le body de send-for-signature. | Validator : ajouter `amountCents` (number entier), `currency` (string, 3 lettres). Pour une facture, les exiger ; pour un devis, optionnels ou ignorés. |
| **B3** | Frontend : calculer et envoyer amountCents + currency lors de l’envoi pour signature. | Dans `ListeDocuments.svelte` (handleSendForSignature) : à partir du `document` déchiffré, calculer le total TTC (ou total selon ta logique métier) et la devise (entete ou societe). Envoyer `amountCents` (total en centimes) et `currency` (ex. 'eur') dans le body de `POST /api/documents/send-for-signature`. Pour un devis, tu peux envoyer 0 et 'eur' ou ne pas envoyer si le backend ne l’exige que pour les factures. |

---

### Phase C — Token de paiement et page « Régler maintenant »

| Étape | Description | Fichiers / actions |
|-------|-------------|---------------------|
| **C1** | Backend : générer un token de paiement après signature (facture uniquement). | Lors du GET `/sign/confirm` : après `confirmSignRequest(token)` réussi, récupérer la ligne SignRequest (invoiceId, documentType, userId). Si `documentType === 'facture'`, créer un token de paiement (aléatoire, courte durée de vie, ex. 1 h) et le stocker (table `PaymentToken` : token, invoiceId, userId, expiresAt). Retourner ou utiliser ce token pour construire le lien « Régler maintenant ». |
| **C2** | Backend : page « Document accepté » avec lien « Régler maintenant ». | Dans la réponse HTML de GET `/sign/confirm`, si statut ok et documentType === 'facture', ajouter dans la page un lien : « Régler maintenant » → `BASE_URL/pay?paymentToken=xxx` (où BASE_URL est le front ou le backend selon où tu sers la page /pay). |
| **C3** | Backend : retourner documentType + invoiceId après confirmation. | Adapter `confirmSignRequest` pour retourner un objet `{ status, documentType?, invoiceId? }` (ou une fonction séparée qui lit la ligne après confirmation) afin que la route GET `/sign/confirm` sache si c’est une facture et ait l’invoiceId pour créer le payment token. |
| **C4** | Page /pay : afficher la page de choix de moyen de paiement. | Route GET `/pay?paymentToken=...` (côté backend ou frontend) : valider le token (existe, non expiré, non déjà utilisé si one-shot). Récupérer le résumé (montant, devise) et la liste des providers configurés pour ce userId (ex. Stripe). Afficher une page avec le montant et un bouton « Payer avec Stripe ». Si le token est invalide, afficher un message d’erreur. |

---

### Phase D — Plugin Stripe et création de session

| Étape | Description | Fichiers / actions |
|-------|-------------|---------------------|
| **D1** | Backend : module plugin Stripe. | Nouveau fichier (ex. `backend/plugins/stripe.js`) : fonction `createCheckoutSession({ secretKey, amountCents, currency, invoiceId, successUrl, cancelUrl, description? })` qui appelle l’API Stripe (Checkout Sessions), retourne `{ redirectUrl }`. Utiliser le SDK Stripe (package `stripe`). |
| **D2** | Backend : route pour créer une session de paiement. | Route publique (ou protégée par paymentToken) : `POST /api/payment/create-session` avec body `{ paymentToken, provider: 'stripe' }`. Valider le paymentToken, récupérer invoiceId, userId, puis le résumé (amountCents, currency), récupérer la clé Stripe du Pro (PaymentConfig), appeler le plugin Stripe avec successUrl/cancelUrl pointant vers ton site. Réponse : `{ redirectUrl }`. |
| **D3** | Frontend ou page /pay : appel et redirection. | Sur la page /pay, au clic « Payer avec Stripe », appeler `POST /api/payment/create-session` avec le paymentToken (et provider 'stripe'), recevoir `redirectUrl`, puis `window.location.href = redirectUrl` pour envoyer le client sur Stripe Checkout. |
| **D4** | URLs de succès et d’annulation. | Définir successUrl et cancelUrl (ex. `BASE_URL/paiement/succes` et `BASE_URL/paiement/annule`) et les passer au plugin. Ces pages peuvent être simples (message « Paiement effectué » / « Paiement annulé »). Les webhooks Stripe (pour mettre à jour le statut côté backend) peuvent être une phase suivante. |

---

## Ordre recommandé

1. **A1 → A2 → A3** : le Pro peut enregistrer sa clé Stripe et voir « Stripe configuré ».
2. **B1 → B2 → B3** : à l’envoi pour signature d’une facture, le backend reçoit et stocke amountCents + currency.
3. **C1 → C2 → C3 → C4** : après signature d’une facture, le client voit « Régler maintenant » et arrive sur une page /pay avec bouton Stripe.
4. **D1 → D2 → D3 → D4** : le clic « Payer avec Stripe » crée une session et redirige vers Stripe ; le client paie puis revient sur succès/annulé.

---

## Récapitulatif « Où le Pro entre son token Stripe »

- **Endroit** : Paramètres (ou Compte) → **Paiement** (ou **Moyens de paiement**).
- **Moment** : une fois, à la configuration ; pas à chaque facture.
- **Champ** : Clé secrète Stripe (`sk_test_...` en dev, `sk_live_...` en prod). Type input password, jamais affichée en clair après enregistrement (optionnel : afficher « •••••••• » + lien « Modifier »).

Une fois ces étapes en place, tu as un flux complet : Pro configure Stripe → Pro envoie facture pour signature (montant stocké) → Client signe → Client voit « Régler maintenant » → Client paie avec Stripe.
