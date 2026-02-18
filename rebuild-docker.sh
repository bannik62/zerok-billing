#!/usr/bin/env bash
# Rebuild Docker après erreur "parent snapshot does not exist".
# À lancer depuis la racine du projet : ./rebuild-docker.sh (ou sudo ./rebuild-docker.sh)

set -e
cd "$(dirname "$0")"

echo "=== Nettoyage du cache Docker (images, build cache) ==="
docker system prune -af

echo "=== Build sans cache ==="
docker compose build --no-cache

echo "=== Démarrage des conteneurs ==="
docker compose up -d

echo "=== Terminé. Vérifier avec : docker compose ps ==="
