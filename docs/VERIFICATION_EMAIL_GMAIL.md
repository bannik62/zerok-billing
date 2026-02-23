# Où obtenir le token Gmail (mot de passe d’application)

Pour envoyer les emails de vérification (code à 6 chiffres), le backend utilise **Nodemailer** avec Gmail. On n’utilise **pas** le mot de passe de ton compte Google, mais un **mot de passe d’application** (App Password).

## Étapes

1. **Activer la validation en 2 étapes** (si ce n’est pas déjà fait)  
   - Va sur [https://myaccount.google.com/security](https://myaccount.google.com/security)  
   - Section « Connexion à Google » → **Validation en 2 étapes** → active-la.

2. **Créer un mot de passe d’application**  
   - Sur la même page Sécurité : **Validation en 2 étapes** → en bas, **Mots de passe des applications** (ou cherche “App password”).  
   - Choisir « Courrier » (ou « Autre » et nommer par ex. « zerok-billing »).  
   - Google affiche un **mot de passe de 16 caractères** (souvent en blocs de 4, sans espaces).

3. **Configurer le backend**  
   Dans ton fichier `.env` (à la racine du projet ou dans `backend/`) :

   ```env
   GMAIL_USER=ton-adresse@gmail.com
   GMAIL_APP_PASSWORD=les16caracteres
   ```

   - `GMAIL_USER` : l’adresse Gmail qui envoie les mails (souvent la même que ton compte).  
   - `GMAIL_APP_PASSWORD` : les 16 caractères **sans espaces** (ex. `abcd efgh ijkl mnop` → `abcdefghijklmnop`).

Si ces variables ne sont pas définies, le backend démarre quand même mais **n’envoie pas** d’email de vérification (un message est écrit dans les logs).

## Rappel

- Ne commite jamais ton `.env` (il doit rester dans `.gitignore`).  
- En production, utilise les variables d’environnement de ton hébergeur pour `GMAIL_USER` et `GMAIL_APP_PASSWORD`.
