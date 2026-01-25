# Git Repository Hosting Setup

SelfHost includes built-in Git repository hosting capabilities, allowing projects to have their own Git repositories as an alternative to external services like GitHub, GitLab, or Gitea.

## Features

- **Git Repository Management**: Each project can have an associated Git repository
- **HTTP Git Access**: Clone and push over HTTP/HTTPS using Git Smart HTTP protocol
- **SSH Git Access**: Clone and push over SSH (requires server setup)
- **SSH Key Management**: Users can add SSH keys for authentication
- **Repository Privacy**: Public and private repository support
- **Access Control**: Fine-grained permissions (read, write, admin)

## Database Setup

The Git repository tables are automatically created when you run migrations:

```bash
bun run db:push
```

Or generate a migration:

```bash
bun run db:generate
bun run db:migrate
```

## Repository Storage

Git repositories are stored in the `data/git-repos` directory by default. You can configure this with the `GIT_REPOS_ROOT` environment variable:

```bash
GIT_REPOS_ROOT=/path/to/git/repos
```

**Important**: This directory must be persistent and accessible to the application. It will NOT work on serverless platforms.

## HTTP Git Access

Git operations over HTTP work automatically once repositories are created. Users can clone and push using:

```bash
# Clone
git clone https://your-domain.com/api/git/{projectId}/{repoName}.git

# Push
git remote add origin https://your-domain.com/api/git/{projectId}/{repoName}.git
git push origin main
```

## SSH Git Access Setup

SSH access requires additional server configuration. This setup is based on [GitPremo's approach](https://github.com/maietta/gitpremo).

### Prerequisites

- Linux server (VPS or dedicated server)
- Root or sudo access
- `curl` and `jq` installed
- SSH service running

### Step 1: Create the `git` User

Create a system user that will handle all Git connections:

```bash
sudo useradd -r -m -s /bin/bash git
```

### Step 2: Install Dependencies

**Debian/Ubuntu:**
```bash
sudo apt-get update && sudo apt-get install -y curl jq
```

**Arch Linux:**
```bash
sudo pacman -Sy curl jq
```

**RHEL/CentOS/Fedora:**
```bash
sudo dnf install -y curl jq
```

### Step 3: Configure GitPremo Scripts

1. **Create Config Directory:**
```bash
sudo mkdir -p /etc/gitpremo
```

2. **Create Config File** (`/etc/gitpremo/config`):
```bash
sudo tee /etc/gitpremo/config > /dev/null <<EOF
GITPREMO_API_URL="http://localhost:5173/api/ssh"
GITPREMO_AUTH_API_URL="http://localhost:5173/api/ssh/authorize"
GIT_REPOS_ROOT="/path/to/selfhost/data/git-repos"
EOF
```

Adjust the URLs and paths to match your environment:
- `GITPREMO_API_URL`: The base URL of your SelfHost API
- `GITPREMO_AUTH_API_URL`: The authorization endpoint
- `GIT_REPOS_ROOT`: Must match where your app stores git repositories (default: `./data/git-repos`)

3. **Install Scripts:**
```bash
# Copy scripts from your SelfHost project
sudo cp scripts/gitpremo-keys.sh /usr/local/bin/gitpremo-keys
sudo cp scripts/gitpremo-shell.sh /usr/bin/gitpremo-shell

# Make executable
sudo chmod +x /usr/local/bin/gitpremo-keys /usr/bin/gitpremo-shell
```

**Important**: `gitpremo-shell` MUST be at `/usr/bin/gitpremo-shell` as specified in the application code.

4. **Update Scripts with Config:**
Edit `/usr/local/bin/gitpremo-keys` and `/usr/bin/gitpremo-shell` to source the config file:

```bash
# Add at the top of both scripts (after the shebang)
if [ -f /etc/gitpremo/config ]; then
    source /etc/gitpremo/config
fi
```

### Step 4: Configure SSHD

Edit `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Add the following block at the end:

```
Match User git
    AuthorizedKeysCommand /usr/local/bin/gitpremo-keys
    AuthorizedKeysCommandUser nobody
```

**Note**: The `Match User git` block ensures that this dynamic key lookup **only** applies to the `git` user. Normal administrative SSH access for other users (e.g., `root`, `ubuntu`) will continue to work using standard `~/.ssh/authorized_keys` files, even if the SelfHost service is down.

### Step 5: Restart SSH

**Debian/Ubuntu:**
```bash
sudo systemctl restart ssh
```

**Arch/RHEL/Fedora:**
```bash
sudo systemctl restart sshd
```

### Step 6: Test SSH Access

Users can now clone and push using SSH:

```bash
# Clone
git clone git@your-server:projectId/repoName.git

# Push
git remote add origin git@your-server:projectId/repoName.git
git push origin main
```

## User SSH Key Management

Users can add SSH keys through the SelfHost UI (once implemented) or via API:

```bash
POST /api/ssh/keys
{
  "title": "My Laptop",
  "publicKey": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ..."
}
```

## Repository Management

Repositories are created and managed through the project interface. Each project can have one Git repository associated with it.

## Troubleshooting

### SSH Connection Issues

1. **Check SSH logs:**
```bash
sudo tail -f /var/log/auth.log  # Debian/Ubuntu
sudo journalctl -u sshd -f      # Systemd systems
```

2. **Verify script permissions:**
```bash
ls -l /usr/local/bin/gitpremo-keys /usr/bin/gitpremo-shell
```

3. **Test script manually:**
```bash
sudo -u nobody /usr/local/bin/gitpremo-keys git
```

### HTTP Git Issues

1. **Check repository exists:**
   - Verify the repository was created in the database
   - Check the filesystem path exists

2. **Check permissions:**
   - Ensure the application has read/write access to `GIT_REPOS_ROOT`
   - Verify repository permissions

3. **Check logs:**
   - Review application logs for git command errors
   - Verify git is installed on the server

## Security Considerations

- **SSH Keys**: Stored securely in the database with SHA256 fingerprints
- **Repository Access**: Controlled through the `repository_collaborators` table
- **Private Repositories**: Only accessible to authorized users/teams
- **Command Restrictions**: SSH keys are restricted to git operations only

## Limitations

- **Serverless Platforms**: Git hosting requires a persistent filesystem and will NOT work on serverless platforms (Vercel, Netlify, Cloudflare Pages)
- **Repository Size**: Large repositories may impact performance
- **Concurrent Operations**: Multiple simultaneous git operations may require additional server resources

## Future Enhancements

- Web UI for repository browsing
- Branch and tag management
- Pull request system
- Webhooks for repository events
- Repository statistics and analytics
