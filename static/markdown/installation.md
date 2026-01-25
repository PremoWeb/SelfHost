# Installation Guide

Setting up SelfHost is straightforward. Follow this guide to get up and running in minutes.

## Prerequisites

Before installing the SelfHost agent, ensure your server meets the following requirements:

- **OS**: Ubuntu 22.04+, Debian 11+, or AlmaLinux 9+.
- **RAM**: Minimum 1GB (2GB recommended).
- **Disk**: 10GB of free space.
- **SSH Access**: Root or sudo privileges.

## Installation Steps

### 1. Prepare your server
Update your system packages and install basic dependencies:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git -y
```

### 2. Run the Installation Script
Execute the following command to download and run the SelfHost setup script:

> [!TIP]
> You can also run the agent in a Docker container if you prefer to keep your host system clean. Check the [Advanced Installation](/docs/advanced) section (Coming soon).

```bash
curl -fsSL https://get.selfhost.sh | bash
```

### 3. Register the Server
Once the script completes, you'll receive a **Registration Key**. Copy this key and head to your SelfHost dashboard:

1. Navigate to **Servers**.
2. Click **Register Server**.
3. Paste the key and give your server a name.

## Configuration

After installation, the agent configuration can be found at:

```bash
/etc/selfhost-agent/config.yaml
```

You can restart the service anytime using:

```bash
sudo systemctl restart selfhost-agent
```

## Troubleshooting

If the installation fails, check the logs:

```bash
journalctl -u selfhost-agent -f
```

Common issues include firewall blocks (ensure port 443 and 22 are open) and incompatible kernel versions.
