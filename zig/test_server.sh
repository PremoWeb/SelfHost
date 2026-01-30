#!/bin/bash
# Test script for Zig server

set -e

PORT=${PORT:-3001}
DB_PATH=${DB_PATH:-sqlite.db}

echo "=== Building server ==="
zig build

echo ""
echo "=== Starting server on port $PORT ==="
cd "$(dirname "$0")"
PORT=$PORT DATABASE_URL=$DB_PATH ./zig-out/bin/selfhost-server &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "=== Testing health endpoint ==="
curl -s http://localhost:$PORT/api/health || echo "Health check failed"

echo ""
echo ""
echo "=== Testing servers endpoint (should require auth) ==="
curl -s http://localhost:$PORT/api/servers || echo "Servers endpoint test"

echo ""
echo "=== Stopping server ==="
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "Test complete!"
