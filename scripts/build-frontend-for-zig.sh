#!/usr/bin/env bash
# Build the Svelte frontend into zig/frontend/ so the Zig server can serve it.
# Run from repo root. After this, run: cd zig && zig build run
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Syncing Svelte frontend from src/ to frontend/src/"
bash "$ROOT/scripts/sync-frontend-from-sveltekit.sh"

echo "==> Installing frontend deps (npm)"
cd "$ROOT/frontend"
npm install

echo "==> Building frontend into zig/frontend/"
BUILD_TO_ZIG=1 npm run build

echo "==> Done. Run: cd zig && zig build run"
echo "    Then open http://localhost:3000"
