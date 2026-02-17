# Backend zerok-billing

## Structure

- **`server.js`** : Express, CORS, session, montage des routeurs.
- **`middleware/requireAuth.js`** : `requireAuth` (session + chargement user dans `req.user`).
- **`middleware/csrf.js`** : `ensureCsrfToken` (pour la route qui renvoie le token), `validateCsrf` (vérifie le header `X-CSRF-Token` sur POST/PUT/PATCH/DELETE).
- **`routes/auth.js`** : authentification — `GET /api/auth/csrf-token` (renvoie le token CSRF), `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` ; `GET /api/auth/me` protégé par `requireAuth`.
- **`routes/secure.js`** : routes sécurisées (toutes sous `requireAuth`). Monté sur `/api` : toute route ajoutée ici est accessible en `GET/POST /api/...` et exige une session valide. **`POST /api/proofs`** : enregistrement d’une preuve d’intégrité (hash + signature) pour un document.

## Sessions

- Si **`DATABASE_URL`** est défini : les sessions sont stockées en **PostgreSQL** (table `session`, créée automatiquement au démarrage via `connect-pg-simple`). Pas de perte de sessions au redémarrage.
- Sinon : store en mémoire (déconnexion à chaque redémarrage).

## CSRF

- **Récupérer le token** : `GET /api/auth/csrf-token` (créé ou réutilise un token en session, renvoie `{ csrfToken }`).
- **Envoyer le token** : sur chaque requête modifiante (POST, PUT, PATCH, DELETE), le client doit envoyer le header **`X-CSRF-Token`** avec la valeur reçue. Sans cela, le serveur répond 403.

## Ordre des routes dans `server.js`

1. `app.use('/api/auth', authRouter)` — tout ce qui est sous `/api/auth` (dont `/me` avec `requireAuth` dans le routeur).
2. `app.get('/api/health', ...)` — santé publique (avant le bloc sécurisé).
3. `app.use('/api', requireAuth, secureRouter)` — tout le reste sous `/api` exige une session.
