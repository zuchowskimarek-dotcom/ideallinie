#!/usr/bin/env bash
# ============================================================
# RN Ideallinie — start-all.sh
# Starts all services in background and tails their logs.
# Logs are written to .logs/ in the project root.
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
LOGS="$ROOT/.logs"

mkdir -p "$LOGS"

# --- colours -------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log() { echo -e "${GREEN}[start-all]${NC} $*"; }
warn() { echo -e "${YELLOW}[start-all]${NC} $*"; }

# --- check .venv ---------------------------------------------
if [[ ! -f "$ROOT/.venv/bin/uvicorn" ]]; then
  warn ".venv not found — run:  python3.11 -m venv .venv && .venv/bin/pip install -r packages/solver/requirements.txt"
  exit 1
fi

# --- helper: start a service ---------------------------------
start_service() {
  local name="$1"; shift
  local logfile="$LOGS/$name.log"
  log "Starting $name  →  $logfile"
  # shellcheck disable=SC2068
  "$@" > "$logfile" 2>&1 &
  echo $! > "$LOGS/$name.pid"
}

# --- services ------------------------------------------------

# 1. Solver service (Python / FastAPI)
start_service "solver-service" \
  "$ROOT/.venv/bin/uvicorn" main:app \
  --reload \
  --reload-dir "$ROOT/services/solver-service" \
  --reload-dir "$ROOT/packages/solver" \
  --port 8001 --host 0.0.0.0 \
  --app-dir "$ROOT/services/solver-service"

# 2. API Gateway (TypeScript / tsx)
start_service "api-gateway" \
  npx tsx watch "$ROOT/services/api-gateway/src/index.ts"

# 3. Track service (TypeScript / tsx)
start_service "track-service" \
  npx tsx watch "$ROOT/services/track-service/src/index.ts"

# 4. Trajectory service (TypeScript / tsx)
start_service "trajectory-service" \
  npx tsx watch "$ROOT/services/trajectory-service/src/index.ts"

# 5. RNZ Importer service (TypeScript / tsx)
start_service "rnz-importer" \
  npx tsx watch "$ROOT/services/rnz-importer/src/index.ts"

# 6. Frontend (Vite)
start_service "frontend" \
  bash -c "cd '$ROOT/frontend' && npx vite"

# --- wait & report -------------------------------------------
sleep 2
echo ""
log "All services started. Ports:"
printf "  %-25s %s\n" "Frontend (Vite)"        "http://localhost:5173"
printf "  %-25s %s\n" "API Gateway"             "http://localhost:3000/health"
printf "  %-25s %s\n" "Solver (FastAPI + docs)" "http://localhost:8001/docs"
printf "  %-25s %s\n" "Track Service"           "http://localhost:8002/health"
printf "  %-25s %s\n" "Trajectory Service"      "http://localhost:8003/health"
printf "  %-25s %s\n" "RNZ Importer"           "http://localhost:8004/health"
echo ""
log "Logs: .logs/  |  Stop: npm run stop"
