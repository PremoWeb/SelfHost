#!/usr/bin/env bash
# Copy client-side Svelte code from src/ to frontend/src/, remove server-only code, add stubs.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
DST="$ROOT/frontend/src"

echo "Syncing Svelte frontend from $SRC to $DST ..."

rm -rf "$DST"
mkdir -p "$DST"

# Copy lib (then remove server)
cp -r "$SRC/lib" "$DST/"
rm -rf "$DST/lib/server"

# Copy routes (then remove api and [namespace])
cp -r "$SRC/routes" "$DST/"
rm -rf "$DST/routes/api" "$DST/routes/[namespace]"

# Remove hooks.server.ts
rm -f "$DST/hooks.server.ts"

# Copy app files
cp "$SRC/app.css" "$SRC/app.html" "$SRC/app.d.ts" "$DST/" 2>/dev/null || true

# Sync static directory
mkdir -p "$ROOT/frontend/static"
cp -r "$ROOT/static/." "$ROOT/frontend/static/"

# Overwrite all .remote.ts with API-based stubs (Zig backend)
STUBS="$ROOT/frontend/stubs"
cp "$STUBS/layout.remote.ts"   "$DST/routes/(app)/layout.remote.ts"
cp "$STUBS/servers.remote.ts" "$DST/routes/(app)/servers.remote.ts"
cp "$STUBS/git.remote.ts"     "$DST/routes/(app)/git.remote.ts"
cp "$STUBS/ssh.remote.ts"     "$DST/routes/(app)/ssh.remote.ts"
cp "$STUBS/vps.remote.ts"     "$DST/routes/(app)/vps.remote.ts"
cp "$STUBS/github.remote.ts"  "$DST/routes/(app)/github.remote.ts"
mkdir -p "$DST/routes/(app)/servers/[id]"
cp "$STUBS/server.remote.ts"   "$DST/routes/(app)/servers/[id]/server.remote.ts"

# Stub: root +layout.server.ts
mkdir -p "$DST/routes"
cat > "$DST/routes/+layout.server.ts" << 'STUB'
import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async () => ({});
STUB

# Stub: (app) +layout.server.ts — minimal data so UI doesn't crash
mkdir -p "$DST/routes/(app)"
cat > "$DST/routes/(app)/+layout.server.ts" << 'STUB'
import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async () => ({
	user: null,
	team: null,
	activeCompany: null,
	teams: [],
	companies: [],
	users: [],
	isSuperAdmin: false,
	isGod: false,
	isImpersonating: false,
	impersonatedBy: null,
	impersonationType: null,
	impersonationEntity: null,
	websiteMode: false
});
STUB

# Stub every +page.server.ts (and any +*.server.ts that isn't a layout we already stubbed)
find "$DST/routes" -type f -name '+*.server.ts' 2>/dev/null | while read -r f; do
	case "$f" in
		*/+layout.server.ts) ;;
		*)
			echo 'export const load = async () => ({});' > "$f"
			;;
	esac
done

# Ensure every +page.svelte has a +page.ts for SPA mode
# If it doesn't have one from stubs, create a minimal one
find "$DST/routes" -type f -name '+page.svelte' 2>/dev/null | while read -r f; do
	DIR=$(dirname "$f")
	if [ ! -f "$DIR/+page.ts" ]; then
		# Construct a likely data key based on directory name (e.g. "domains" -> "domains: []")
		KEY=$(basename "$DIR" | sed 's/\[//g' | sed 's/\]//g')
		# Use quoted key to avoid syntax errors with hyphens
		echo "import type { PageLoad } from './\$types'; export const load: PageLoad = async () => ({ '$KEY': [] });" > "$DIR/+page.ts"
	fi
done

# Root +layout.ts: SPA (ssr false, prerender true)
cat > "$DST/routes/+layout.ts" << 'STUB'
export const ssr = false;
export const prerender = true;
STUB

# Root +page.ts: client load that fetches servers/projects from Zig API
cp "$ROOT/frontend/stubs/+page.ts" "$DST/routes/+page.ts"

# (app) list/detail pages: client loads that fetch from Zig API
mkdir -p "$DST/routes/(app)/servers" "$DST/routes/(app)/projects" "$DST/routes/(app)/servers/[id]" "$DST/routes/(app)/cloud-providers"
cp "$ROOT/frontend/stubs/(app)-servers+page.ts"           "$DST/routes/(app)/servers/+page.ts"
cp "$ROOT/frontend/stubs/(app)-projects+page.ts"          "$DST/routes/(app)/projects/+page.ts"
cp "$ROOT/frontend/stubs/(app)-servers-[id]+page.ts"      "$DST/routes/(app)/servers/[id]/+page.ts"
cp "$ROOT/frontend/stubs/(app)-layout.ts"               "$DST/routes/(app)/+layout.ts"
cp "$ROOT/frontend/stubs/(app)-cloud-providers+page.ts" "$DST/routes/(app)/cloud-providers/+page.ts"

# Copy additional remote stubs that might be imported relatively
cp "$ROOT/frontend/stubs/servers.remote.ts" "$DST/routes/(app)/servers/servers.remote.ts"
cp "$ROOT/frontend/stubs/server.remote.ts"  "$DST/routes/(app)/servers/[id]/server.remote.ts"
cp "$ROOT/frontend/stubs/git.remote.ts"     "$DST/routes/(app)/projects/git.remote.ts"

echo "Done. Run 'cd frontend && bun install && bun run build' to build."
echo "Zig: use STATIC_DIR=../frontend/build when running from zig/."
