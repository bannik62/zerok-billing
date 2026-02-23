# Spec : variables d’environnement centralisées (backend)

## Objectif

Une seule façon d’accéder aux variables d’environnement dans le backend : un module `config/env.js` qui lit et valide au chargement, puis exporte un objet `env`. Plus aucun `process.env` ailleurs dans le backend.

## Variables utilisées aujourd’hui

| Variable           | Utilisée dans   | Obligatoire        | Défaut / règle |
|--------------------|-----------------|--------------------|----------------|
| `NODE_ENV`         | server.js, logger.js | Non | aucune (string ou undefined) |
| `SESSION_SECRET`   | server.js       | Oui en production  | En dev : `'dev-secret-change-in-prod'` ; en prod : doit être défini et ≠ défaut |
| `PORT`             | server.js       | Non                | `3001` (number) |
| `FRONTEND_ORIGIN`  | server.js       | Non                | `'http://localhost:5173'` ; peut être une liste séparée par des virgules → tableau d’origines CORS |
| `COOKIE_SECURE`    | server.js       | Non                | `false` ; `true` uniquement si la valeur est la chaîne `'true'` |
| `DATABASE_URL`     | server.js       | Non                | `null` ; si défini, sessions PostgreSQL ; sinon MemoryStore |

Note : `BACKEND_PORT` dans le `.env` / docker-compose est le port **hôte** ; dans le container l’app lit `PORT` (défaut 3001). Pas de changement côté code.

## Module `backend/config/env.js`

- **Chargement** : s’exécute après `dotenv/config` (le fichier est importé après que `server.js` ait fait `import 'dotenv/config'`, ou on fait `import 'dotenv/config'` en première ligne de `env.js`).
- **Valeur exportée** : un objet unique `env` (frozen en lecture pour éviter les modifications) avec :
  - `env.NODE_ENV` : `process.env.NODE_ENV` (string ou undefined)
  - `env.isProduction` : `true` si `NODE_ENV === 'production'`
  - `env.PORT` : nombre, défaut 3001
  - `env.SESSION_SECRET` : string (défaut dev si pas en prod, voir ci‑dessous)
  - `env.allowedOrigins` : tableau de strings (origines CORS), toujours au moins `http://localhost:5173` et `http://127.0.0.1:5173` si pas déjà présents
  - `env.cookieSecure` : boolean
  - `env.DATABASE_URL` : string ou `null`
- **Validation au chargement** :
  - Si `NODE_ENV === 'production'` : exiger que `SESSION_SECRET` soit défini et différent de la chaîne de dev ; sinon `process.stderr.write` + `process.exit(1)`.
- **Aucun autre fichier backend** ne doit utiliser `process.env` ; tout passe par `import { env } from '../config/env.js'` (ou le chemin adapté).

## Fichiers à modifier

1. **Créer** `backend/config/env.js` (lecture + validation + export `env`).
2. **Modifier** `backend/server.js` : importer `env`, supprimer toute référence à `process.env`, utiliser `env.PORT`, `env.SESSION_SECRET`, `env.allowedOrigins`, `env.cookieSecure`, `env.DATABASE_URL` (et plus de `DEV_SESSION_SECRET` ni de bloc de vérification prod en tête de fichier).
3. **Modifier** `backend/lib/logger.js` : importer `env`, utiliser `env.isProduction` au lieu de `process.env.NODE_ENV === 'production'`.

## Ordre de chargement

Pour que `env.js` ait accès aux variables chargées par dotenv, soit :
- `server.js` garde `import 'dotenv/config'` en première ligne, puis importe `env` (et `env.js` ne fait pas dotenv),  
soit
- `env.js` fait lui‑même `import 'dotenv/config'` en première ligne et est importé par `server.js` avant toute autre config.

On choisit : **dotenv dans `server.js` en première ligne**, puis `import { env } from './config/env.js'` ; `env.js` ne fait pas dotenv et suppose qu’il est chargé après.

## `.env.example`

Mettre à jour (backend ou racine) pour lister les variables avec un court commentaire, sans changer les noms actuels (`PORT`, `SESSION_SECRET`, `FRONTEND_ORIGIN`, `COOKIE_SECURE`, `DATABASE_URL`, `NODE_ENV`).
