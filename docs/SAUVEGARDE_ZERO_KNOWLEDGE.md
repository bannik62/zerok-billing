# Sauvegarde serveur et Zero Knowledge

Ce document décrit le mécanisme de sauvegarde des données sur le serveur et explique pourquoi il conserve le modèle **zero knowledge** : le serveur ne peut jamais lire le contenu des devis, factures, clients ou société.

---

## 1. Pourquoi une sauvegarde serveur ?

Les données (coffre fort + documents) sont stockées **côté client** (IndexedDB), chiffrées avec une clé dérivée du mot de passe. Si l’utilisateur vide le cache ou change d’appareil, tout est perdu. La sauvegarde serveur permet de **récupérer** ces données après restauration ou sur un autre appareil, sans que le serveur ait accès au contenu.

En **mode privé / navigation privée**, IndexedDB est souvent indisponible ou vidé à la fermeture du navigateur. La sauvegarde serveur améliore la situation : à la prochaine ouverture, l’app détecte une BDD locale vide, récupère le blob chiffré et le restaure après déverrouillage — les données ne sont pas perdues malgré l’absence de persistance locale fiable.

---

## 2. Principe : archive chiffrée, serveur « aveugle »

- L’**archive** (devis, factures, clients, société) est construite et **chiffrée côté client** avec le mot de passe de l’utilisateur (même schéma que l’export manuel `.zerok-archive`).
- Seul le **blob chiffré** est envoyé au serveur. Le serveur stocke ce blob tel quel.
- La **clé de déchiffrement** ne quitte jamais le client (dérivée du mot de passe en local). Le serveur ne la connaît pas et **ne peut pas déchiffrer** l’archive.

Donc : **zero knowledge** — le serveur ne « sait » rien du contenu ; il ne fait que stocker et renvoyer un bloc de données illisibles pour lui.

---

## 3. Sync à l’ouverture de session

Après déverrouillage du coffre, le front sait si la BDD locale est **vide** ou **pleine**.

### 3.1 BDD locale vide

- **GET /api/backup** (sans paramètre).
- Si 404 : pas de sauvegarde → rien à faire.
- Si 200 + blob : le client déchiffre le blob et **restaure** en local (comme un import d’archive).

### 3.2 BDD locale pleine

- Le client calcule un **hash** de l’état local (représentation canonique de devis, factures, clients, société).
- **GET /api/backup?hash=xxx** en envoyant ce hash.
- **404** : pas de sauvegarde → **PUT /api/backup** avec l’archive actuelle + hash (première sauvegarde).
- **200 { "unchanged": true }** (sans blob) : serveur et local identiques → **rien à faire**, pas de téléchargement.
- **200 + blob** : état serveur différent du hash envoyé → le **serveur fait foi** ; le client déchiffre le blob et **restaure** en local (écrase l’état local).

Le hash permet d’éviter de télécharger le blob quand local et serveur sont déjà identiques.

---

## 4. Événements qui déclenchent un envoi (PUT /api/backup)

Pour que le serveur reste à jour, le client envoie une nouvelle archive (blob + hash) en arrière-plan à chaque **modification** des données :

| Événement | Action |
|----------|--------|
| Création d’un devis | Après enregistrement local → PUT /api/backup |
| Création d’une facture | Idem |
| Modification / suppression d’un devis | Idem |
| Modification / suppression d’une facture | Idem |
| Modification du coffre (clients, société) | Idem |

Optionnel : bouton « Sauvegarder maintenant » dans Sauvegarder / Restaurer qui fait aussi un PUT.

---

## 5. Pourquoi ça reste Zero Knowledge ?

| Élément | Côté client | Côté serveur |
|--------|-------------|--------------|
| Mot de passe | Saisi et utilisé pour dériver la clé | Jamais envoyé (hors auth session) |
| Clé de déchiffrement | Dérivée en local, gardée en mémoire | Ne la reçoit jamais |
| Données en clair | Déchiffrées uniquement dans le navigateur | Ne les voit jamais |
| Blob sauvegarde | Chiffré avant envoi | Reçu et stocké tel quel, illisible |

Le serveur ne peut pas :
- déchiffrer l’archive (pas de clé),
- lire le contenu des devis, factures, clients ou société,
- ni déduire d’informations sur le contenu à partir du blob (chiffrement fort).

Seul le **titulaire du mot de passe**, sur un client où il déverrouille le coffre, peut déchiffrer et voir les données. La sauvegarde serveur ne change donc pas le modèle zero knowledge : elle ajoute uniquement une **copie de secours chiffrée** que le serveur stocke sans pouvoir la lire.
