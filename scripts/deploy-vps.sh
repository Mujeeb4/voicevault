#!/usr/bin/env bash
# Safe production deploy for the VPS (run on the server, from the repo root).
#   ./scripts/deploy-vps.sh            deploy current origin/main
#   ./scripts/deploy-vps.sh rollback   put the previous images back
# It keeps the previous images tagged ":rollback" and refuses to continue if the new
# containers are not healthy.
set -euo pipefail
cd "$(dirname "$0")/.."
# This server runs the stack with four compose files (database network, Traefik host and HTTPS
# overlays). Using only docker-compose.production.yml leaves the containers unable to reach the
# database or the proxy, so always use the same files the live stack was started with.
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.production.yml -f docker-compose.vps.yml -f docker-compose.traefik-host.yml -f docker-compose.traefik-https.yml}"
COMPOSE="docker compose $COMPOSE_FILES"

if [[ "${1:-}" == "rollback" ]]; then
  docker tag voicevault-backend:rollback voicevault-backend:production
  docker tag voicevault-frontend:rollback voicevault-frontend:production
  $COMPOSE up -d --no-build
  echo "Rolled back to the previous images."; exit 0
fi

echo "== 1. Back up current images and env files"
docker tag voicevault-backend:production voicevault-backend:rollback
docker tag voicevault-frontend:production voicevault-frontend:rollback
mkdir -p ../backups && cp -p backend/.env "../backups/backend.env.$(date +%F-%H%M)" 2>/dev/null || true
[ -f .env ] && cp -p .env "../backups/root.env.$(date +%F-%H%M)" || true

echo "== 2. Pull main (refuses if the server has local changes to tracked files)"
git diff --quiet && git diff --cached --quiet || { echo "Local changes found. Stop."; git status --short; exit 1; }
git fetch origin main
git merge --ff-only origin/main

echo "== 3. Build (old containers keep serving during the build)"
$COMPOSE build

echo "== 4. Restart with the new images"
$COMPOSE up -d

echo "== 5. Wait for health"
for i in $(seq 1 30); do
  s=$($COMPOSE ps --format '{{.Service}} {{.Health}}' | grep -E '^(backend|frontend) ' || true)
  if ! echo "$s" | grep -vq healthy && [ -n "$s" ]; then echo "$s"; echo "Healthy. Deploy done."; exit 0; fi
  sleep 5
done
echo "Not healthy after 150s. Rolling back."; "$0" rollback; exit 1
