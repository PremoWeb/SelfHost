#!/bin/bash
# GitPremo Shell - Restricted shell for git operations
# This script is called by SSH when a user connects as the 'git' user
# Based on GitPremo's implementation: https://github.com/maietta/gitpremo

# Load configuration if available
if [ -f /etc/gitpremo/config ]; then
    source /etc/gitpremo/config
fi

# Configuration
API_URL="${GITPREMO_API_URL:-http://localhost:5173/api/ssh}"
AUTH_API_URL="${GITPREMO_AUTH_API_URL:-http://localhost:5173/api/ssh/authorize}"

# Get the SSH command from SSH_ORIGINAL_COMMAND
COMMAND="${SSH_ORIGINAL_COMMAND}"

if [ -z "$COMMAND" ]; then
    echo "Interactive shell not allowed."
    exit 1
fi

# Parse the command
# Expected format: git-upload-pack 'projectId/repoName.git' or git-receive-pack 'projectId/repoName.git'
if [[ "$COMMAND" =~ ^git-(upload-pack|receive-pack)\ '([^']+)'\.git$ ]]; then
    OPERATION="${BASH_REMATCH[1]}"
    REPO_PATH="${BASH_REMATCH[2]}"
    
    # Extract projectId and repoName from path (format: projectId/repoName)
    if [[ "$REPO_PATH" =~ ^([^/]+)/(.+)$ ]]; then
        PROJECT_ID="${BASH_REMATCH[1]}"
        REPO_NAME="${BASH_REMATCH[2]}"
        
        # Get the SSH public key from the environment (set by AuthorizedKeysCommand)
        SSH_KEY="${SSH_PUBLIC_KEY}"
        
        if [ -z "$SSH_KEY" ]; then
            echo "SSH key not found in environment"
            exit 1
        fi
        
        # Authorize the operation
        AUTH_RESPONSE=$(curl -s -X POST "$AUTH_API_URL" \
            -H "Content-Type: application/json" \
            -d "{\"projectId\":\"$PROJECT_ID\",\"repoName\":\"$REPO_NAME\",\"operation\":\"$OPERATION\",\"publicKey\":\"$SSH_KEY\"}")
        
        AUTH_SUCCESS=$(echo "$AUTH_RESPONSE" | jq -r '.authorized // false')
        
        if [ "$AUTH_SUCCESS" != "true" ]; then
            echo "Access denied"
            exit 1
        fi
        
        # Get repository path from API
        REPO_FS_PATH=$(echo "$AUTH_RESPONSE" | jq -r '.repositoryPath // ""')
        
        if [ -z "$REPO_FS_PATH" ]; then
            echo "Repository not found"
            exit 1
        fi
        
        # Execute the git operation
        exec git "$OPERATION" "$REPO_FS_PATH"
    else
        echo "Invalid repository path format"
        exit 1
    fi
else
    echo "Invalid command: $COMMAND"
    echo "Only git-upload-pack and git-receive-pack are allowed"
    exit 1
fi
