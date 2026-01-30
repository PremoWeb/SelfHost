#!/bin/bash
# Simple API testing script for Zig server

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Testing Zig Server API at $BASE_URL"
echo "======================================"
echo ""

# Health check
echo "1. Health Check:"
curl -s "$BASE_URL/api/health" | jq '.' || echo "Failed"
echo ""
echo ""

# Servers (will fail without auth)
echo "2. Get Servers (requires auth):"
curl -s "$BASE_URL/api/servers" | jq '.' || echo "Failed - likely 401 Unauthorized"
echo ""
echo ""

# Companies (will fail without auth)
echo "3. Get Companies (requires auth):"
curl -s "$BASE_URL/api/companies" | jq '.' || echo "Failed - likely 401 Unauthorized"
echo ""
echo ""

# Projects (will fail without auth)
echo "4. Get Projects (requires auth):"
curl -s "$BASE_URL/api/projects" | jq '.' || echo "Failed - likely 401 Unauthorized"
echo ""
echo ""

echo "======================================"
echo "Note: Most endpoints require authentication."
echo "Auth system is partially implemented."
echo ""
echo "To test with auth, you'll need to:"
echo "1. Implement header extraction in auth middleware"
echo "2. Get a valid session token"
echo "3. Include token in Authorization header"
