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

read_env_value() {
    name=$1

    awk -F= -v name="$name" '
        $1 == name {
            sub(/^[^=]*=/, "")
            value = $0
        }
        END {
            print value
        }
    ' "$ENV_FILE"
}

is_private_ipv4() {
    case "$1" in
        10.* | 192.168.* | 172.16.* | 172.17.* | 172.18.* | 172.19.* | \
        172.20.* | 172.21.* | 172.22.* | 172.23.* | 172.24.* | 172.25.* | \
        172.26.* | 172.27.* | 172.28.* | 172.29.* | 172.30.* | 172.31.*)
            return 0
            ;;
    esac

    return 1
}

detect_lan_host() {
    candidate=""

    if command -v ip >/dev/null 2>&1; then
        candidate=$(ip route get 1.1.1.1 2>/dev/null | awk '
            {
                for (index = 1; index <= NF; index += 1) {
                    if ($index == "src") {
                        print $(index + 1)
                        exit
                    }
                }
            }
        ' || true)
        if is_private_ipv4 "$candidate"; then
            printf '%s\n' "$candidate"
            return
        fi
    fi

    if command -v ipconfig >/dev/null 2>&1; then
        for interface in en0 en1; do
            candidate=$(ipconfig getifaddr "$interface" 2>/dev/null || true)
            if is_private_ipv4 "$candidate"; then
                printf '%s\n' "$candidate"
                return
            fi
        done
    fi

    if command -v hostname >/dev/null 2>&1; then
        for candidate in $(hostname -I 2>/dev/null || true); do
            if is_private_ipv4 "$candidate"; then
                printf '%s\n' "$candidate"
                return
            fi
        done
    fi
}

configure_mobile_urls() {
    frontend_port=${FRONTEND_PORT:-$(read_env_value FRONTEND_PORT)}
    backend_port=${BACKEND_PORT:-$(read_env_value BACKEND_PORT)}
    public_app_url=${VITE_PUBLIC_APP_URL:-$(read_env_value VITE_PUBLIC_APP_URL)}
    lan_host=${STEPLY_LAN_HOST:-$(read_env_value STEPLY_LAN_HOST)}

    frontend_port=${frontend_port:-5173}
    backend_port=${backend_port:-8000}
    STEPLY_MOBILE_URL=""

    if [ -z "$public_app_url" ]; then
        if [ -z "$lan_host" ]; then
            lan_host=$(detect_lan_host)
        fi

        if [ -n "$lan_host" ]; then
            public_app_url="http://$lan_host:$frontend_port"
        fi
    fi

    if [ -n "$public_app_url" ]; then
        export VITE_PUBLIC_APP_URL="$public_app_url"
        STEPLY_MOBILE_URL="$public_app_url"
        export STEPLY_MOBILE_URL
        log "Mobile frontend URL for QR: $STEPLY_MOBILE_URL"
        return
    fi

    log "No private LAN address detected. QR will show setup help until VITE_PUBLIC_APP_URL or STEPLY_LAN_HOST is set."
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

configure_mobile_urls

log "Building and starting Steply containers..."
docker compose up --build -d

wait_for_service postgres
wait_for_service backend

log "Applying Alembic migrations..."
docker compose exec -T backend alembic upgrade head

wait_for_service frontend

log "Steply is ready."
log "frontend: http://localhost:$frontend_port"
log "backend: http://localhost:$backend_port"
log "health: http://localhost:$backend_port/api/health"
if [ -n "$STEPLY_MOBILE_URL" ]; then
    log "phone frontend: $STEPLY_MOBILE_URL"
fi
