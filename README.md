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
cd /chemin/vers/zerok-billing   # racine du projet (pas backend/)
cp .env.example .env
# Éditer .env : POSTGRES_PASSWORD, SESSION_SECRET
docker compose up -d --build
```

Si le build Docker échoue avec une erreur du type « parent snapshot does not exist », utiliser le script de rebuild (ou les commandes manuelles) :

```bash
chmod +x rebuild-docker.sh   # une seule fois
./rebuild-docker.sh         # ou : sudo ./rebuild-docker.sh
```

Ou manuellement : `docker system prune -a` puis `docker compose build --no-cache` puis `docker compose up -d`.

- Backend : http://localhost:3011 (ou `BACKEND_PORT` dans .env)
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

PWA : http://localhost:5173


2. Si besoin, utiliser l’IP WSL : depuis Windows `

## Où sont les données ? (équivalent « BDD »)

- **Backend (PostgreSQL)** : uniquement comptes utilisateur (email, hash mot de passe, nom, prénom, adresse) et registre de preuves (hash + signature par document). **Aucun contenu de devis/facture.** Pour parcourir : pgAdmin, DBeaver, ou `psql` avec `DATABASE_URL`.
- **Frontend (navigateur)** : toute la donnée métier (clients, société, devis, factures, profils de mise en page) est dans **IndexedDB** (base `zerok-billing`), pas dans MySQL/PHP. Les devis et factures sont **chiffrés** (AES-GCM) : en base on voit `payload` + `iv`, pas le JSON en clair.

**Parcourir la « BDD » du front (IndexedDB) :**

1. **DevTools du navigateur** : F12 → onglet **Application** (Chrome/Edge) ou **Stockage** (Firefox) → **IndexedDB** → `zerok-billing` → stores `clients`, `societe`, `devis`, `factures`, `meta`, `layoutProfiles`. Les enregistrements devis/factures chiffrés s'affichent en brut (payload binaire illisible).
2. **Dans l'app** : menu **Explorer la base** ouvre une page qui liste les stores et leurs enregistrements ; si la clé est chargée, un aperçu déchiffré des devis/factures est proposé.

## Plan

Voir le plan d’architecture (marquage cryptographique, identité triple, workflow) dans le document de spécification.
