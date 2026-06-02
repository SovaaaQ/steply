#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}
COMPOSE_ENV_FILE=${COMPOSE_ENV_FILE:-}
SERVICE_NAME=${SERVICE_NAME:-backend}

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' "Docker is not available in PATH."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    printf '%s\n' "Docker Compose plugin is not available."
    exit 1
fi

printf 'Applying Alembic migrations with %s (%s)...\n' "$COMPOSE_FILE" "$SERVICE_NAME"
if [ -n "$COMPOSE_ENV_FILE" ]; then
    docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" run --rm "$SERVICE_NAME" alembic upgrade head
else
    docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE_NAME" alembic upgrade head
fi
