---
title: Git Hosting
description: Built-in lightweight Git repository hosting for your projects
---

# Git Repository Hosting

SelfHost includes built-in Git repository hosting capabilities, allowing each project to have its own Git repository. This provides an alternative to external services like GitHub, GitLab, or Gitea, keeping your code and infrastructure management in one place.

## Overview

Every project in SelfHost can have an associated Git repository. These repositories support:

- **Full Git Operations**: Clone, push, pull, branch, and tag management
- **HTTP/HTTPS Access**: Standard Git operations over HTTP using the Smart HTTP protocol
- **SSH Access**: Secure Git operations over SSH (requires server setup)
- **Access Control**: Fine-grained permissions for users and teams
- **Private Repositories**: Keep your code private or make it public

## Creating a Repository

When you create a project, you can optionally create a Git repository for it. The repository will be:

- Linked to your project
- Stored on the filesystem in the `data/git-repos` directory
- Accessible via both HTTP and SSH (once configured)

## Repository Storage

Git repositories are stored as bare repositories on the filesystem. The default location is:

```
data/git-repos/{projectId}/{repositoryName}.git
```

You can configure a custom location using the `GIT_REPOS_ROOT` environment variable:

```bash
GIT_REPOS_ROOT=/path/to/your/git/repos
```

> **Important**: Git hosting requires a persistent filesystem and will **NOT** work on serverless platforms like Vercel, Netlify, or Cloudflare Pages.

## HTTP Git Access

Git operations over HTTP work automatically once repositories are created. No additional configuration is required.

SelfHost uses a user-friendly URL format based on namespaces (derived from team names). For example, if your team is "John Doe's Team", your repository URLs will use the namespace `johndoe`.

### Cloning a Repository

Repositories can be cloned using the friendly namespace format:

```bash
git clone https://your-domain.com/johndoe/my-repository.git
```

Or using the project UUID format (for backward compatibility):

```bash
git clone https://your-domain.com/api/git/{projectId}/{repositoryName}.git
```

### Adding a Remote

```bash
git remote add origin https://your-domain.com/johndoe/my-repository.git
```

### Pushing to a Repository

```bash
git push origin main
```

### Pulling from a Repository

```bash
git pull origin main
```

### Git Protocol Support

SelfHost also supports the `git://` protocol (requires additional server configuration):

```bash
git clone git://your-domain.com/johndoe/my-repository.git
```

> **Note**: The git:// protocol is less commonly used today and requires special server configuration. HTTP/HTTPS is recommended for most use cases.

## SSH Git Access

SSH access provides a more secure and convenient way to work with Git repositories, especially for frequent operations. Setting up SSH access requires server configuration.

### Prerequisites

- Linux server (VPS or dedicated server)
- Root or sudo access
- `curl` and `jq` installed
- SSH service running

### Setup Instructions

For detailed SSH setup instructions, see the `GIT_SETUP.md` file in the project root. The setup process involves:

1. Creating a `git` system user
2. Installing helper scripts
3. Configuring SSHD
4. Restarting the SSH service

**Quick Setup Summary:**

1. Create a `git` system user
2. Install helper scripts (`gitpremo-shell.sh` and `gitpremo-keys.sh`)
3. Configure SSHD to use the helper scripts
4. Restart SSH service

Once configured, users can clone and push using SSH with the friendly namespace format:

```bash
# Clone
git clone git@your-server:johndoe/my-repository.git

# Push
git remote add origin git@your-server:johndoe/my-repository.git
git push origin main
```

> **Note**: SSH URLs use the same namespace format as HTTP URLs. The namespace is automatically derived from your team name.

## SSH Key Management

To use SSH Git access, users need to add their SSH public keys to their SelfHost account.

### Adding an SSH Key

1. Navigate to your profile settings
2. Go to the SSH Keys section
3. Click "Add SSH Key"
4. Provide a title (e.g., "My Laptop") and paste your public key
5. Save the key

### Supported Key Types

- `ssh-rsa`
- `ssh-ed25519`
- `ecdsa-sha2-nistp256`
- `ecdsa-sha2-nistp384`
- `ecdsa-sha2-nistp521`

### Viewing Your Keys

You can view all your SSH keys, including when they were last used, in your profile settings.

## Repository URLs

SelfHost uses a user-friendly URL format that makes repositories easy to identify and share. URLs are structured as:

```
https://your-domain.com/{namespace}/{repository-name}.git
```

### Namespace Format

The namespace is automatically derived from your team name:
- **Personal Teams**: "John Doe's Team" → `johndoe`
- **Regular Teams**: "My Team" → `my-team`

Namespaces are automatically created from team names, converting them to lowercase slugs with hyphens.

### Example URLs

- **HTTP/HTTPS**: `https://your-domain.com/johndoe/my-project.git`
- **Git Protocol**: `git://your-domain.com/johndoe/my-project.git`
- **SSH**: `git@your-server:johndoe/my-project.git`

All three protocols use the same namespace format, making it easy to switch between them.

## Repository Permissions

Repositories support three permission levels:

- **Read**: Clone and pull from the repository
- **Write**: Push to the repository
- **Admin**: Manage repository settings and collaborators

### Default Permissions

- **Project Owner**: Full admin access
- **Team Members**: Read access (can be upgraded)
- **Public Repositories**: Read access for all authenticated users

### Managing Collaborators

Repository owners can add collaborators (users or teams) with specific permissions:

1. Navigate to the project's repository settings
2. Go to the Collaborators section
3. Add users or teams with appropriate permissions
4. Save changes

## Repository Settings

Each repository has configurable settings:

- **Name**: Repository identifier (slug)
- **Description**: Optional repository description
- **Privacy**: Public or private
- **Default Branch**: Default branch name (usually `main`)
- **HTTP Push**: Enable/disable push over HTTP
- **SSH Push**: Enable/disable push over SSH

## Repository Statistics

SelfHost tracks repository statistics:

- **Size**: Total repository size in bytes
- **Commit Count**: Number of commits
- **Branch Count**: Number of branches
- **Tag Count**: Number of tags
- **Last Commit**: Information about the most recent commit

These statistics are updated automatically after each push operation.

## Best Practices

### Repository Naming

- Use lowercase names with hyphens: `my-project`, `api-server`
- Keep names descriptive but concise
- Avoid special characters

### Branch Management

- Use `main` or `master` as your default branch
- Create feature branches for new work
- Use tags for releases

### Access Control

- Keep sensitive code in private repositories
- Grant write access only to trusted collaborators
- Regularly review collaborator permissions

### Backup

While SelfHost stores repositories on the filesystem, you should:

- Regularly backup the `data/git-repos` directory
- Consider using automated backup solutions
- Test your backup and restore procedures

## Troubleshooting

### HTTP Git Issues

**Problem**: Cannot clone or push over HTTP

**Solutions**:
- Verify the repository exists in the database
- Check that the filesystem path is correct
- Ensure the application has read/write permissions
- Check application logs for git command errors

### SSH Git Issues

**Problem**: SSH connection fails

**Solutions**:
- Verify SSH keys are added to your account
- Check SSH server logs: `sudo tail -f /var/log/auth.log`
- Ensure helper scripts are installed and executable
- Verify SSHD configuration is correct

**Problem**: Permission denied

**Solutions**:
- Check that you have the required permissions for the repository
- Verify your SSH key is associated with your account
- Ensure the repository exists and is accessible

### Repository Not Found

**Problem**: Repository appears to not exist

**Solutions**:
- Verify the project ID and repository name are correct
- Check that a repository was created for the project
- Ensure the repository hasn't been deleted

## Limitations

- **Serverless Platforms**: Git hosting requires a persistent filesystem and will NOT work on serverless platforms
- **Repository Size**: Very large repositories (>1GB) may impact performance
- **Concurrent Operations**: Multiple simultaneous operations may require additional server resources
- **No Web UI**: Currently, repository browsing must be done via Git commands (web UI coming soon)

## Related Features

- [Projects](/docs/projects) - Learn about project management
- [SSH Setup](/git-setup) - Detailed SSH configuration guide
- [Security](/security) - Security and access control
