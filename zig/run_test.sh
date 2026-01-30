#!/bin/bash
set -e

cd "$(dirname "$0")"
PORT=3001

echo "=== Building server ===" > /tmp/test_results.txt
zig build >> /tmp/test_results.txt 2>&1 || {
    echo "Build failed!" >> /tmp/test_results.txt
    cat /tmp/test_results.txt
    exit 1
}

echo "" >> /tmp/test_results.txt
echo "=== Starting server ===" >> /tmp/test_results.txt
PORT=$PORT ./zig-out/bin/selfhost-server >> /tmp/test_results.txt 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 5

echo "" >> /tmp/test_results.txt
echo "=== Testing health endpoint ===" >> /tmp/test_results.txt
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:$PORT/api/health 2>&1)
echo "$HEALTH_RESPONSE" >> /tmp/test_results.txt

echo "" >> /tmp/test_results.txt
echo "=== Testing servers endpoint (no auth) ===" >> /tmp/test_results.txt
SERVERS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:$PORT/api/servers 2>&1)
echo "$SERVERS_RESPONSE" >> /tmp/test_results.txt

echo "" >> /tmp/test_results.txt
echo "=== Testing POST servers (no auth) ===" >> /tmp/test_results.txt
POST_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST http://localhost:$PORT/api/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Server","ip":"192.168.1.100"}' 2>&1)
echo "$POST_RESPONSE" >> /tmp/test_results.txt

# Stop server
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "" >> /tmp/test_results.txt
echo "=== Test complete ===" >> /tmp/test_results.txt

cat /tmp/test_results.txt
