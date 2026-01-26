# Installation Guide

Setting up SelfHost is straightforward. Follow this guide to get up and running in minutes.

## Prerequisites

Before installing SelfHost.gg, ensure your server meets the following requirements:

- **Operating System**: Any system that can run Bun or Node.js:
  - **Linux**: Debian, Ubuntu, RHEL, AlmaLinux, Alpine, Arch, and other distributions
  - **macOS**: Intel and Apple Silicon (M1/M2/M3)
  - **Windows**: Windows 10/11 (via WSL2 recommended, or native)
  - **Unix/BSD**: FreeBSD, OpenBSD, NetBSD, and other Unix-like systems
- **Memory**: Very minimal - can run on systems with as little as 512MB RAM (1GB+ recommended for better performance)
- **CPU**: Any modern CPU architecture (x86_64, ARM64, ARMv7)
- **Storage**: Minimal - just a few hundred MB for the application and database
- **Network**: Internet connection for agent communication
- **SSH Access**: Root or sudo privileges (for initial agent installation only)

## Installation Steps

> **Note**: SelfHost.gg is lightweight enough to run on a Raspberry Pi Zero W or the cheapest VPS options. If you don't have a static IP address, you can use a Cloudflare Argo tunnel or similar tunneling solution to make your installation accessible. See our [Cloudflare Integration](/docs/cloudflare) guide for details.

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
curl -fsSL https://selfhost.gg | bash
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
