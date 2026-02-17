# Zero-Knowledge Billing

Application de facturation **local-first** et **zero-knowledge** : le serveur ne stocke jamais le contenu des factures, uniquement les preuves cryptographiques (hash, signature, horodatage).

## Structure

- **frontend/** — PWA Svelte (Vite), IndexedDB, offline-first
- **backend/** — Node.js (Express), PostgreSQL, auth + registre de preuves

## Prérequis

- Node.js 18+ (dév local) ou Docker + Docker Compose

## Docker (comme vitalinfo / codeurbase)

Uniquement **backend + postgres** dans Docker. Le frontend tourne à part (dev ou hébergement externe).

```bash
cp .env.example .env
# Éditer .env : POSTGRES_PASSWORD, SESSION_SECRET
docker compose up -d --build
```

- Backend : http://localhost:3001
- Frontend : à lancer en dev avec `cd frontend && npm run dev` (http://localhost:5173) ou à déployer ailleurs.

## Dév local

**Backend**

```bash
cd backend
cp .env.example .env
# DATABASE_URL, SESSION_SECRET
npm install
npx prisma generate
npx prisma db push
npm run dev
```

API : http://localhost:3001  

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

PWA : http://localhost:5173 (définir `VITE_API_URL=http://localhost:3001` en .env si besoin)

**Auth** : `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (session HttpOnly)

## Plan

Voir le plan d’architecture (marquage cryptographique, identité triple, workflow) dans le document de spécification.
