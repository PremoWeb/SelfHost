#!/usr/bin/env bash
# Run Zig backend + Svelte dev server (UI) together. Ctrl+C stops both.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Clean up any lingering processes from previous runs
pkill -f "selfhost-server" 2>/dev/null || true
pkill -f "watch-zig.ts" 2>/dev/null || true
sleep 1

ZIG_PID=
cleanup() {
  if [[ -n "$ZIG_PID" ]]; then
    kill "$ZIG_PID" 2>/dev/null || true
    wait "$ZIG_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Start Zig backend with file watcher (rebuild + restart on .zig changes; HMR-like)
export DATABASE_URL="${DATABASE_URL:-$ROOT/sqlite.db}"
export ROOT="$ROOT"
# Enable dev-only features: Magic Tunnel, etc. (no need to set manually)
export SELFHOST_DEV=1
bun run scripts/watch-zig.ts &
ZIG_PID=$!

# Give Zig a moment to bind
sleep 2

# Check if frontend/src exists
if [ ! -d "frontend/src" ]; then
  echo "⚠️ frontend/src not found. Running sync script..."
  bash scripts/sync-frontend-from-sveltekit.sh
fi

# Start Svelte dev server from the ported frontend directory
echo "Starting Svelte dev server (frontend/)..."
cd frontend && exec bun run dev
