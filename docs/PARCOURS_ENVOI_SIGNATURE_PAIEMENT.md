# Parcours : envoi document, signature, puis paiement

Ce document décrit le **parcours actuel** (envoi + signature) puis les **modifications à apporter** pour le paiement en ligne (lien « Régler maintenant », choix du moyen de paiement, initiation du flux).

---

## 1. Parcours actuel (sans paiement)

### Acteurs

- **Pro** = utilisateur de zerok-billing (le professionnel qui émet devis/factures).
- **Client** = destinataire du document (reçoit l’email, signe, et plus tard paiera).

### Étapes détaillées

| # | Acteur | Action | Détail technique |
|---|--------|--------|------------------|
| 1 | Pro | Crée un devis ou une facture | Frontend (Liste documents / détail). Données en local (IndexedDB), preuve éventuelle envoyée au backend. |
| 2 | Pro | Envoie le document pour signature | Clic « Envoyer pour signature » (ou équivalent). **ListeDocuments.svelte** : `handleSendForSignature()` génère le PDF (html2pdf), envoie au backend `POST /api/documents/send-for-signature` avec `{ to, invoiceId, documentType, numero, pdfBase64, pdfFilename }`. |
| 3 | Backend | Envoi de l’email | **secure.js** : création d’un **token de signature** (`createSignRequest`), lien `BACKEND_PUBLIC_URL/sign/confirm?token=...`. Email avec sujet « Devis n° X à signer » / « Facture n° X à signer », corps HTML avec bouton **« Signer / Accepter le document »** pointant vers ce lien. Pièce jointe : PDF du document. |
| 4 | Client | Reçoit l’email | Boîte mail du client. Il voit le PDF en pièce jointe et le bouton « Signer / Accepter le document ». |
| 5 | Client | Clique sur « Signer / Accepter le document » | Ouverture du lien : **GET** `BACKEND_PUBLIC_URL/sign/confirm?token=...` (donc requête vers le **backend**). |
| 6 | Backend | Confirmation de signature | **app.js** : route GET `/sign/confirm`. Appel à `confirmSignRequest(token)` : si token valide, non expiré, non déjà utilisé → mise à jour `signedAt` en BDD (table `SignRequest`), retour `status === 'ok'`. **Important** : la signature est enregistrée dès ce GET (one-shot), pas de formulaire « Je signe » séparé. |
| 7 | Client | Voit la page suivante | Le backend renvoie du **HTML directement** (pas le front Svelte) : soit « Document accepté » + lien « Accéder au site » (vers `siteUrl` = frontend), soit « Lien invalide ou expiré » + « Accéder au site ». |
| 8 | Pro | Voit le statut « Accepté » | En rechargeant la liste des documents, le front appelle `GET /api/signatures` et met à jour la colonne « Accepté » pour les `invoiceId` signés. |

### Schéma résumé (actuel)

```
[Pro] Envoie pour signature
        → Backend : createSignRequest, envoi email (lien + PDF)
[Client] Reçoit email
        → Clic "Signer / Accepter le document"
        → GET /sign/confirm?token=...
        → Backend : confirmSignRequest(token) → signedAt enregistré
        → Page HTML : "Document accepté" + "Accéder au site"
```

### Points à retenir pour la suite

- Le lien dans l’email pointe vers le **backend** (`BACKEND_PUBLIC_URL`). La « page de signature » est donc une page HTML servie par Express, pas par le front Svelte (sauf si on fait pointer le lien vers le front et que le front appelle `GET /api/sign/confirm` — aujourd’hui les deux existent ; l’email utilise le backend).
- Après signature, le client ne voit **aucun lien « Régler maintenant »** pour l’instant.
- Le backend connaît après confirmation : `invoiceId`, `documentType` (devis | facture), `userId` (du pro). Pour proposer un paiement, on ne le fera que pour les **factures** (pas les devis), et il faudra un moyen d’autoriser le paiement pour ce `invoiceId` (ex. token de paiement dérivé ou réutilisation du token de signature avec un usage « payment »).

---

## 2. Modifications à apporter : intégration du paiement

### Principe (aligné avec la réalité des paiements en ligne)

- Les **clés API** (Stripe, Mollie, etc.) sont configurées par le **Pro** dans zerok-billing. Le client ne configure rien.
- Le **Client** choisit **avec quoi** payer parmi les moyens **activés** par le Pro (ex. icône Stripe, icône Mollie).
- « Le client clique sur Stripe → le plugin se monte » signifie : l’app utilise le **plugin Stripe déjà configuré** par le Pro pour créer une session de paiement (ex. Stripe Checkout) et redirige le client vers Stripe ; le client paie sur Stripe puis revient sur notre site. Aucune « connexion » ou configuration côté client.

### Enchaînement souhaité (après signature)

1. **Page « Document accepté »** (celle servie après GET `/sign/confirm`) : en plus du lien « Accéder au site », afficher un lien **« Régler maintenant »** **uniquement si** le document est une **facture** (pas un devis).
2. **Clic « Régler maintenant »** : redirection vers une **page de choix du moyen de paiement** (icônes des providers activés par le Pro : Stripe, Mollie, etc.).
3. **Clic sur un provider** (ex. Stripe) : l’app charge le **plugin** correspondant (déjà configuré par le Pro), crée une session de paiement (montant, facture, URLs de retour), et **redirige le client** vers la page de paiement du provider (ex. Stripe Checkout).
4. Le client paie sur le site du provider ; après paiement, le provider redirige vers une URL de succès/échec définie par nous (callback).

### Où insérer les changements

| Étape | Fichier / zone | Modification |
|-------|----------------|--------------|
| Page après signature | Backend **app.js** : GET `/sign/confirm` | Après avoir rendu « Document accepté », inclure dans le HTML un lien **« Régler maintenant »** vers une URL de paiement. Pour savoir si c’est une facture, il faut que `confirmSignRequest` (ou une nouvelle fonction) retourne aussi `documentType` et `invoiceId` pour construire l’URL (ex. `/pay?invoiceId=...&paymentToken=...`). Le **paymentToken** doit être un token one-shot ou limité dans le temps, lié à cette facture, pour que seul le client ayant signé puisse accéder à la page de paiement. |
| Nouvelle page : choix du provider | Frontend ou Backend | Une route (ex. GET `/pay` avec `invoiceId` + `paymentToken`) qui : (1) valide le token ; (2) charge les providers activés pour le Pro (propriétaire de la facture) ; (3) affiche une page avec les **icônes** (Stripe, Mollie, …). Pas de formulaire de connexion : juste « Payer avec Stripe », « Payer avec Mollie », etc. |
| Clic sur un provider | Même page ou API | Clic « Payer avec Stripe » → appel backend (ex. `POST /api/payment/create-session`) avec `{ invoiceId, paymentToken, provider: 'stripe' }`. Le backend utilise le **plugin Stripe** (credentials du Pro), crée une session Stripe Checkout avec le montant de la facture, et retourne l’URL de redirection. Le front redirige le navigateur vers cette URL. Le client paie sur Stripe ; Stripe redirige vers notre URL de succès/échec. |

### Flux résumé (avec paiement)

```
[Client] Clic "Signer / Accepter le document" (email)
        → GET /sign/confirm?token=...
        → Backend : confirmSignRequest → "Document accepté"
        → Page HTML : "Document accepté" + "Accéder au site"
                    + (si facture) "Régler maintenant" → /pay?invoiceId=...&paymentToken=...

[Client] Clic "Régler maintenant"
        → Page /pay : affichage des icônes (Stripe, Mollie, …) selon config du Pro

[Client] Clic "Payer avec Stripe"
        → Backend : création session Stripe (plugin), retour URL Checkout
        → Redirection navigateur vers Stripe
        → Client paie sur Stripe
        → Stripe redirige vers notre page succès / échec
```

### Données à prévoir

- **Token de paiement** : après signature d’une **facture**, générer un token (ou réutiliser le sign token avec un usage « payment ») pour accéder à la page `/pay` et aux appels « créer session ». Ce token doit être lié à `invoiceId` + éventuellement expiration courte.
- **Config providers par Pro** : le Pro a configuré (dans zerok-billing) quels moyens de paiement sont activés et les clés associées. La page `/pay` ne montre que les icônes des providers activés pour ce Pro.
- **Montant et devise** : ils viennent de la facture (données côté Pro). Pour créer la session Stripe/Mollie, le backend devra soit recevoir le montant depuis le front (qui déchiffre la facture en local), soit stocker côté backend un résumé « facture X → montant Y » pour les factures envoyées en paiement (selon choix d’architecture zero-knowledge).

---

## 3. Récapitulatif : parcours complet avec paiement

| # | Acteur | Écran / action |
|---|--------|----------------|
| 1 | Pro | Envoie la facture pour signature (email avec lien + PDF). |
| 2 | Client | Reçoit l’email, ouvre le lien « Signer / Accepter le document ». |
| 3 | Client | Arrive sur la page backend : la signature est enregistrée, message « Document accepté ». Lien **« Régler maintenant »** affiché (facture uniquement). |
| 4 | Client | Clic « Régler maintenant » → page **choix du moyen de paiement** (icônes Stripe, Mollie, …). |
| 5 | Client | Clic sur une icône (ex. Stripe) → le plugin est utilisé, session créée, **redirection vers Stripe Checkout**. |
| 6 | Client | Paie sur Stripe (carte, etc.), puis redirection vers notre page « Paiement réussi » ou « Échec ». |

Aucune « connexion » ou configuration côté client : le client choisit seulement le moyen de paiement proposé par le Pro ; c’est l’application qui utilise les plugins (et les credentials du Pro) pour initier le flux de paiement.
