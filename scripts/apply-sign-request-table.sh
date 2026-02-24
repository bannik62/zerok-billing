#!/bin/bash
# Crée la table sign_request si elle n'existe pas (correction état _prisma_migrations).
# À lancer depuis la racine du projet : ./scripts/apply-sign-request-table.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_SQL="$REPO_ROOT/backend/prisma/migrations/20260222120000_add_sign_request/migration.sql"

if [ ! -f "$MIGRATION_SQL" ]; then
  echo "Fichier non trouvé: $MIGRATION_SQL"
  exit 1
fi

cd "$REPO_ROOT"
echo "Application du SQL de la migration sign_request..."
cat "$MIGRATION_SQL" | docker compose --env-file .env exec -T postgres psql -U zerok -d zerok_billing
echo "Terminé."
