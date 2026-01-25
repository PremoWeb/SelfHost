#!/bin/bash
# Migration script to copy existing SQLite databases to the volume mount
# Run this after first container creation to preserve existing data

set -e

WORKSPACE_ROOT="${1:-/workspace}"
SQLITE_VOLUME="${WORKSPACE_ROOT}/sqlite-data"

echo "🔄 Migrating SQLite databases to volume..."

# Create volume directory if it doesn't exist
mkdir -p "${SQLITE_VOLUME}"

# Copy databases if they exist in the workspace root and don't exist in volume
if [ -f "${WORKSPACE_ROOT}/sqlite.db" ] && [ ! -f "${SQLITE_VOLUME}/sqlite.db" ]; then
    echo "📦 Copying sqlite.db to volume..."
    cp "${WORKSPACE_ROOT}/sqlite.db" "${SQLITE_VOLUME}/sqlite.db"
fi

if [ -f "${WORKSPACE_ROOT}/sqlite-logs.db" ] && [ ! -f "${SQLITE_VOLUME}/sqlite-logs.db" ]; then
    echo "📦 Copying sqlite-logs.db to volume..."
    cp "${WORKSPACE_ROOT}/sqlite-logs.db" "${SQLITE_VOLUME}/sqlite-logs.db"
fi

if [ -f "${WORKSPACE_ROOT}/local.db" ] && [ ! -f "${SQLITE_VOLUME}/local.db" ]; then
    echo "📦 Copying local.db to volume..."
    cp "${WORKSPACE_ROOT}/local.db" "${SQLITE_VOLUME}/local.db"
fi

# Create symlinks from workspace root to volume
echo "🔗 Creating symlinks..."
ln -sf "${SQLITE_VOLUME}/sqlite.db" "${WORKSPACE_ROOT}/sqlite.db"
ln -sf "${SQLITE_VOLUME}/sqlite-logs.db" "${WORKSPACE_ROOT}/sqlite-logs.db"
ln -sf "${SQLITE_VOLUME}/local.db" "${WORKSPACE_ROOT}/local.db"

echo "✅ Migration complete! SQLite databases are now persisted in Docker volume."
echo "📍 Volume location: ${SQLITE_VOLUME}"
