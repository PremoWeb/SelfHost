---
title: Deployment Sources
description: Connect your code repositories to SelfHost
---

# Deployment Sources

Deployment Sources are the origin of your application's code. SelfHost integrates directly with major Git providers to automate the process of pulling, building, and deploying your software.

## Supported Sources

SelfHost supports the most popular Git hosting services as well as direct container image registries:

- **GitHub**: Full integration with public and private repositories.
- **GitLab**: Support for GitLab.com and self-hosted GitLab instances.
- **Docker Registry**: Deploy pre-built images from Docker Hub or private registries.

## Connecting a Source

To enable automatic deployments, you first need to authenticate with your code provider.

### GitHub Integration
1. Go to **Sources** in the sidebar.
2. Click **Add Source** and select **GitHub**.
3. You will be redirected to GitHub to authorize the SelfHost application.
4. Once authorized, you can select which organizations or repositories SelfHost has access to.

### GitLab Integration
For GitLab, SelfHost uses Personal Access Tokens (PAT):
1. Generate a token in GitLab with `api` and `read_repository` scopes.
2. Enter the token and your GitLab instance URL in the SelfHost source configuration.

## Automatic Deployments (Webhooks)

When you connect a Git source, SelfHost automatically configures **Webhooks**. This means every time you push code to a tracked branch (e.g., `main`), SelfHost will:

1. Detect the change immediately.
2. Pull the latest code to your build server.
3. Rebuild the container image.
4. Perform a zero-downtime rolling update of your application.

## Best Practices

### Monorepo Support
If your source code is part of a monorepo, you can specify the **Base Directory** in your application settings. SelfHost will only trigger builds when changes occur within that specific folder.

### Mirroring
For high-availability setups, you can connect multiple sources to a single project to ensure deployments can continue even if a specific Git provider is experiencing downtime.

> [!IMPORTANT]
> SelfHost never stores your Git credentials directly. We use OAuth or encrypted Access Tokens that are scoped to only the permissions required for deployment.
