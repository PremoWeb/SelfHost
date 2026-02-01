---
title: Applications
description: Deploying and scaling your services
---

# Application Deployment

Applications are the containers and services that run on your servers. SelfHost makes it easy to go from source code to a running container.

## Supported Frameworks

SelfHost automatically detects and configures many popular frameworks:

- **Node.js**: Next.js, SvelteKit, Express.
- **Python**: Django, Flask, FastAPI.
- **Go**: Standard binaries and fiber.
- **Static**: plain HTML, React/Vue/Svelte build outputs.

## Deployment Sources

You can deploy applications from several sources:

### 1. Git Repositories
Connect your **GitHub** or **GitLab** account. SelfHost will pull the code, build a Docker image, and deploy it.

### 2. Docker Registry
Deploy an existing image directly from Docker Hub or a private registry.

## Build Packs

If your project doesn't have a `Dockerfile`, SelfHost uses **Nixpacks** or **Buildpacks** to automatically determine the environment and build the image for you.

## Configuration

### Environment Variables
Manage application secrets and config values securely. These are injected into the container at runtime.

### FQDN and SSL
SelfHost integrates with reverse proxies like **Caddy** or **Traefik** to automatically provision SSL certificates for your domain names.

## Monitoring

- **Application Logs**: View real-time output from your container's `stdout` and `stderr`.
- **Resource Usage**: Monitor how much memory and CPU your specific app is consuming.
- **Deploy History**: Roll back to a previous version with a single click if a deployment goes wrong.
