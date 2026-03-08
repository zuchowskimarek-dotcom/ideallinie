#!/usr/bin/env bash
# ============================================================
# RN Ideallinie — stop-all.sh
# Kills all running services by PID file, then sweeps ports.
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
LOGS="$ROOT/.logs"

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

log()  { echo -e "${GREEN}[stop-all]${NC} $*"; }
warn() { echo -e "${RED}[stop-all]${NC} $*"; }

PORTS=(3000 5173 8001 8002 8003 8004)
SERVICES=(api-gateway frontend solver-service track-service trajectory-service rnz-importer)

# --- 1. kill by PID files ------------------------------------
if [[ -d "$LOGS" ]]; then
  for svc in "${SERVICES[@]}"; do
    pidfile="$LOGS/$svc.pid"
    if [[ -f "$pidfile" ]]; then
      pid=$(cat "$pidfile")
      if kill -0 "$pid" 2>/dev/null; then
        log "Stopping $svc  (PID $pid)"
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$pidfile"
    fi
  done
fi

# --- 2. sweep ports (catches turbo-started processes too) ----
for port in "${PORTS[@]}"; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "Killing processes on port $port  (PIDs: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done

sleep 1

# --- 3. verify -----------------------------------------------
any_left=false
for port in "${PORTS[@]}"; do
  if lsof -ti :"$port" &>/dev/null; then
    warn "Port $port still in use"
    any_left=true
  fi
done

if [[ "$any_left" == false ]]; then
  log "All services stopped. Ports 3000 5173 8001 8002 8003 8004 are free."
fi
