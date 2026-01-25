#!/bin/bash
# GitPremo AuthorizedKeysCommand
# This script is called by SSH to get authorized keys for the 'git' user
# Based on GitPremo's implementation: https://github.com/maietta/gitpremo

# Load configuration if available
if [ -f /etc/gitpremo/config ]; then
    source /etc/gitpremo/config
fi

# Configuration
API_URL="${GITPREMO_API_URL:-http://localhost:5173/api/ssh/keys}"

# Get the username (should be 'git')
USERNAME="$1"

if [ "$USERNAME" != "git" ]; then
    exit 0
fi

# Fetch SSH keys from API
KEYS=$(curl -s "$API_URL" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$KEYS" ]; then
    exit 1
fi

# Output keys in SSH authorized_keys format
# Each key should include a command restriction pointing to gitpremo-shell
# Also set SSH_PUBLIC_KEY environment variable so gitpremo-shell can access it
echo "$KEYS" | jq -r '.[] | "command=\"SSH_PUBLIC_KEY=\\\"" + .publicKey + "\\\" /usr/bin/gitpremo-shell\",restrict " + .publicKey' 2>/dev/null

exit 0
