#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"
WAIT_TIMEOUT_SECONDS=${STEPLY_START_TIMEOUT_SECONDS:-180}

log() {
    printf '%s\n' "$*"
}

fail_with_logs() {
    service=$1
    message=$2

    log "$message"
    log "Last $service logs:"
    docker compose logs --tail=80 "$service"
    exit 1
}

service_state() {
    service=$1
    container_id=$(docker compose ps -q "$service")

    if [ -z "$container_id" ]; then
        printf 'missing\n'
        return
    fi

    docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id"
}

wait_for_service() {
    service=$1
    elapsed_seconds=0

    log "Waiting for $service healthcheck..."

    while :; do
        state=$(service_state "$service")

        case "$state" in
            healthy)
                log "$service is healthy."
                return
                ;;
            running)
                log "$service is running."
                return
                ;;
            unhealthy | exited | dead)
                fail_with_logs "$service" "$service entered state: $state"
                ;;
        esac

        if [ "$elapsed_seconds" -ge "$WAIT_TIMEOUT_SECONDS" ]; then
            fail_with_logs "$service" "Timed out waiting for $service. Last state: $state"
        fi

        sleep 2
        elapsed_seconds=$((elapsed_seconds + 2))
    done
}

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
    log "Docker is not available in PATH."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    log "Docker Compose plugin is not available."
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    if [ ! -f "$ENV_EXAMPLE_FILE" ]; then
        log "Cannot create .env: .env.example is missing."
        exit 1
    fi

    cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    log "Created .env from .env.example."
fi

log "Building and starting Steply containers..."
docker compose up --build -d

wait_for_service postgres
wait_for_service backend

log "Applying Alembic migrations..."
docker compose exec -T backend alembic upgrade head

wait_for_service frontend

cat <<'EOF'
Steply is ready.
frontend: http://localhost:5173
backend: http://localhost:8000
health: http://localhost:8000/api/health
EOF
