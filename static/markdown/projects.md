---
title: Projects
description: Organizing your infrastructure with Projects
---

# Managing Projects

Projects are the top-level organizational unit in SelfHost. They allow you to group related environments, applications, and servers together.

## Creating a Project

To create a new project:

1. Click on **Projects** in the main sidebar.
2. Click the **Create Project** button.
3. Provide a name and optional description.

## Environments

Inside each project, you can define multiple environments. Typically, these represent the stages of your software development lifecycle:

| Environment | Purpose | Access Level |
| :--- | :--- | :--- |
| **Production** | Live site / core traffic | Highly Restricted |
| **Staging** | Final QA / Pre-release | Team Only |
| **Development** | Feature testing / R&D | Developers |

- **Production**: Live user-facing applications.
- **Staging**: A mirror of production for final testing.
- **Development**: Shared environment for active feature development.

### Environment Management

Each environment can have its own:
- **Servers**: Dedicated compute resources.
- **Applications**: Individual services running in containers.
- **Variables**: Environment-specific configuration (e.g., API keys).

## Shared Projects

SelfHost supports team collaboration. You can share a project with another team to allow them to manage applications or view logs without giving them access to your entire infrastructure.

> **Note**: Only the project owner can delete a project or manage its sharing settings.

## Git Repositories

Each project can have an associated Git repository for version control. This provides built-in Git hosting as an alternative to external services like GitHub or GitLab.

### Features

- **Full Git Support**: Clone, push, pull, branch, and tag management
- **HTTP/HTTPS Access**: Standard Git operations over HTTP
- **SSH Access**: Secure Git operations over SSH (requires setup)
- **Access Control**: Fine-grained permissions for collaborators
- **Private Repositories**: Keep your code private or make it public

For detailed information about Git hosting, see the [Git Hosting documentation](/docs/git-hosting).
