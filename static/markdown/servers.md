---
title: Servers
description: Provisioning and managing your servers
---

# Server Management

Servers are the backbone of your infrastructure. SelfHost works with any server that supports Docker and has the SelfHost Agent installed.

## Connecting a Server

There are two primary ways to add a server to SelfHost:

### 1. Script-based Registration
Run the installation script on your server and paste the registration token into the dashboard.

### 2. Cloud Provider Import
If you've connected a Cloud Provider like **Vultr**, you can import your existing instances directly. SelfHost will attempt to SSH into them and install the agent automatically.

## Server Health and Logs

Once connected, you can monitor your server's health in real-time:

- **CPU & RAM**: Live usage metrics.
- **Disk Usage**: Monitor free space and I/O.
- **Agent Logs**: View the low-level logs from the `selfhost-agent` service.

## Security

SelfHost handles SSH keys and terminal access securely:

- **SSH Keys**: Manage private keys in the **Security** section.
- **Terminal**: Open a secure, web-based terminal directly from the dashboard to troubleshoot any issues.

## Maintenance

You can perform common maintenance tasks directly:

- **Restart Agent**: Quickly bounce the agent service if it's misbehaving.
- **System Updates**: Some distributions support triggering package updates via the agent.
