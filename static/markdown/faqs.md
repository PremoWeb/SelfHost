---
title: Frequently Asked Questions
description: Common questions about SelfHost.gg
---

# Frequently Asked Questions

## What is SelfHost.gg?

SelfHost.gg is an open-source, self-hosted application deployment platform that gives you full control over your infrastructure. Think of it as a self-hosted alternative to platforms like Heroku, Netlify, or Vercel, but with the flexibility to run on your own servers across multiple cloud providers or bare-metal hardware.

Built with modern technologies (SvelteKit, Drizzle ORM, SQLite, and Docker), SelfHost.gg provides a unified dashboard for deploying, managing, and monitoring applications, databases, and services across your infrastructure.

## What can SelfHost.gg do?

SelfHost.gg provides a comprehensive suite of features for managing your infrastructure:

### Application Deployment
- **Git-based Deployments**: Deploy from GitHub, GitLab, or Bitbucket with automatic build-pack detection
- **Docker Support**: Full Docker containerization out of the box
- **Zero-Config Deployments**: Automatic detection of application types (Node.js, Python, PHP, etc.)
- **Built-in Git Hosting**: Each project can have its own Git repository with HTTP and SSH support

### Server Management
- **Multi-Cloud Support**: Connect with Vultr, DigitalOcean, AWS, or bring your own servers
- **Real-time Monitoring**: CPU, memory, and disk usage tracking via the SelfHost Agent
- **Web-based Terminal**: SSH access through your browser
- **Server Health Monitoring**: Automatic health checks and status reporting

### Security & Access Control
- **SSH Key Management**: Secure storage and management of SSH keys
- **Team-based Access Control**: Multi-tenant architecture with role-based permissions
- **API Token Management**: Generate and manage API tokens for programmatic access
- **Comprehensive Audit Logging**: Track every action with detailed logs

### Networking & DNS
- **Vanity DNS**: Custom domain management
- **Cloudflare Integration**: Secure tunnel support for servers behind firewalls
- **Reverse DNS Management**: Configure PTR records for Vultr-managed servers

### Database Management
- **Database Provisioning**: Create and manage databases on your servers
- **Database Backups**: Automated backup scheduling

## Who is SelfHost.gg for?

SelfHost.gg is designed for:

### Developers & DevOps Engineers
- Developers who want to deploy applications without vendor lock-in
- Teams looking for a self-hosted alternative to managed platforms
- DevOps engineers managing multi-cloud infrastructure

### Organizations
- Companies wanting to reduce cloud costs by eliminating "platform tax"
- Organizations requiring full data ownership and control
- Teams needing to comply with data residency requirements

### Hobbyists & Enthusiasts
- Self-hosting enthusiasts who want a modern deployment platform
- Developers learning infrastructure management
- Anyone who values open-source and self-hosting

### Use Cases
- **Personal Projects**: Deploy your side projects on your own infrastructure
- **Small Teams**: Manage infrastructure for small development teams
- **Enterprise**: Scale to enterprise needs with multi-tenant support
- **Education**: Learn modern deployment practices with a real platform

## How can SelfHost.gg be hosted?

SelfHost.gg is designed to be self-hosted, meaning you run it on your own infrastructure. Here are the hosting options:

### Self-Hosted Deployment
You can deploy SelfHost.gg on:
- **VPS Providers**: Vultr, DigitalOcean, Linode, Hetzner, etc. (even the cheapest options work!)
- **Cloud Providers**: AWS EC2, Google Cloud Compute, Azure VMs
- **Bare Metal**: Your own physical servers
- **Home Lab**: Run it on your home server or NAS
- **Raspberry Pi**: Even a Raspberry Pi Zero W can run SelfHost.gg thanks to its minimal resource requirements

> **No Static IP?** If you don't have access to a static IP address, consider using a Cloudflare Argo tunnel or similar tunneling solution. This allows you to run SelfHost.gg behind a dynamic IP or NAT, making it accessible from anywhere. See our [Cloudflare Integration](/docs/cloudflare) guide for details.

### System Requirements
Since SelfHost.gg is built with SvelteKit, it has minimal resource requirements:

- **Operating System**: Any system that can run Bun or Node.js:
  - **Linux**: Debian, Ubuntu, RHEL, AlmaLinux, Alpine, Arch, and other distributions
  - **macOS**: Intel and Apple Silicon (M1/M2/M3)
  - **Windows**: Windows 10/11 (via WSL2 recommended, or native)
  - **Unix/BSD**: FreeBSD, OpenBSD, NetBSD, and other Unix-like systems
- **Memory**: Very minimal - can run on systems with as little as 512MB RAM (1GB+ recommended for better performance)
- **CPU**: Any modern CPU architecture (x86_64, ARM64, ARMv7)
- **Storage**: Minimal - just a few hundred MB for the application and database
- **Network**: Internet connection for agent communication

### Installation Methods
1. **Manual Installation**: Follow the [installation guide](/docs/installation) to set up SelfHost.gg manually
2. **Docker Deployment**: Deploy using Docker (documentation coming soon)
3. **Cloud-init Scripts**: Automated deployment scripts (coming soon)

### High Availability
SelfHost.gg can be deployed in a high-availability configuration:
- **Database**: SQLite (single instance) or PostgreSQL (for multi-instance)
- **Load Balancing**: Use a reverse proxy (nginx, Caddy) for multiple instances
- **Backup**: Regular database backups are recommended

## How can people help?

SelfHost.gg is an open-source project, and we welcome contributions from the community! Here are ways you can help:

### Code Contributions
- **Bug Fixes**: Help us fix bugs and improve stability
- **Feature Development**: Implement new features from our roadmap
- **Documentation**: Improve documentation and add examples
- **Testing**: Test new features and report issues

### Non-Code Contributions
- **Feedback**: Share your experience and suggest improvements
- **Community Support**: Help other users in discussions and forums
- **Sponsorship**: Support the project financially (see [Sponsors](/sponsors))
- **Promotion**: Share SelfHost.gg with others who might benefit

### Getting Started Contributing
1. **Fork the Repository**: Fork [selfhost.gg on GitHub](https://github.com/premoweb/selfhost)
2. **Read the Codebase**: Familiarize yourself with the architecture
3. **Pick an Issue**: Check our issue tracker for good first issues
4. **Submit a PR**: Create a pull request with your changes

### Reporting Issues
- **GitHub Issues**: Report bugs and feature requests on GitHub
- **Discord Community**: Join our [Discord](https://discord.gg/6xPHaRGB95) for real-time discussions
- **Security Issues**: Report security vulnerabilities responsibly

## Technical Questions

### Why use the SelfHost Agent instead of SSH?

The SelfHost Agent uses outbound WebSocket connections instead of traditional SSH for several reasons:

- **Firewall Friendly**: No need to open inbound SSH ports
- **Real-time Monitoring**: Continuous health metrics and status updates
- **Auto-reconnection**: Automatically reconnects if the connection drops
- **Security**: Reduces attack surface by eliminating inbound SSH access
- **Efficiency**: Lower overhead than maintaining persistent SSH connections

[Learn more about the Agent architecture →](/docs/agent)

### What databases are supported?

Currently, SelfHost.gg uses SQLite for the control panel database. For managed databases on your servers, you can provision:
- PostgreSQL
- MySQL/MariaDB
- MongoDB
- Redis

More database types are being added based on community feedback.

### Can I use SelfHost.gg with existing infrastructure?

Yes! SelfHost.gg can connect to existing servers:
- **Existing Servers**: Add servers that are already running
- **Existing Applications**: Deploy new applications alongside existing ones
- **Hybrid Setup**: Mix SelfHost-managed and manually-managed services

### Is SelfHost.gg production-ready?

SelfHost.gg is currently in **active development** and should be considered an early alpha:

- ⚠️ Many features are still being developed
- ⚠️ Security audits are ongoing
- ⚠️ The UI is subject to changes
- ⚠️ Use at your own risk for production workloads

We recommend testing thoroughly in a non-production environment first.

### What license is SelfHost.gg released under?

SelfHost.gg is released under the **O'Sassy License** (see [LICENSE](https://github.com/premoweb/selfhost/blob/main/LICENSE) file). This is a permissive open-source license that allows commercial use.

### How does SelfHost.gg compare to other platforms?

| Feature | SelfHost.gg | Heroku | Netlify | Vercel |
|---------|-------------|--------|---------|--------|
| Self-hosted | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Multi-cloud | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Git Hosting | ✅ Built-in | ❌ No | ❌ No | ❌ No |
| Cost | Free (self-hosted) | $$$ | $$ | $$ |
| Data Ownership | ✅ Full | ❌ No | ❌ No | ❌ No |
| Vendor Lock-in | ✅ None | ❌ High | ❌ High | ❌ High |

### Can I migrate from other platforms?

Migration support is being developed. Currently, you can:
- **Import Applications**: Deploy applications from GitHub/GitLab/Bitbucket
- **Import Servers**: Add existing servers to SelfHost.gg
- **Manual Migration**: Manually migrate applications and databases

Automated migration tools are planned for future releases.

## Support & Community

### Where can I get help?

- **Documentation**: Check our [documentation](/docs) for guides and tutorials
- **Discord**: Join our [Discord community](https://discord.gg/6xPHaRGB95) for real-time support
- **GitHub Issues**: Report bugs and request features
- **Email**: Contact support@selfhost.gg for direct inquiries

### Is there commercial support available?

Commercial support and consulting services are available through [PremoWeb LLC](https://premoweb.com). Contact us for enterprise deployments, custom development, or managed hosting options.

### How can I stay updated?

- **GitHub**: Star and watch the repository for updates
- **Discord**: Join our [Discord](https://discord.gg/6xPHaRGB95) for announcements
- **X (Twitter)**: Follow [@maietta](https://x.com/maietta) (lead developer) for updates
- **Newsletter**: Sign up for updates (coming soon)

---

Have more questions? [Join our Discord](https://discord.gg/6xPHaRGB95) or [open an issue on GitHub](https://github.com/premoweb/selfhost/issues).
