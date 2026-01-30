#!/bin/bash
# Simple script to start the Zig server with visible output

cd "$(dirname "$0")"

echo "Building server..."
zig build || exit 1

echo ""
echo "Starting server on port ${PORT:-3001}..."
echo "Press Ctrl+C to stop"
echo ""

PORT=${PORT:-3001} ./zig-out/bin/selfhost-server
