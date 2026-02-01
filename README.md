# SelfHost.gg – Self-Hosting for the Greater Good

### by PremoWeb LLC

An open-source, full-stack application deployment platform built with Svelte, Zig, and Docker.

[![Svelte](https://img.shields.io/badge/Framework-Svelte%205-ff3e00?logo=svelte&logoColor=white)](https://svelte.dev/)
[![Zig](https://img.shields.io/badge/Backend-Zig%200.13.x-f7a41d?logo=zig&logoColor=white)](https://ziglang.org/)
[![LibSQL](https://img.shields.io/badge/Database-SQLite%2FLibSQL-003554?logo=sqlite&logoColor=white)](https://turso.tech/libsql)
[![License](https://img.shields.io/badge/License-O'Sassy-blue)](LICENSE)

---

> [!WARNING]
> **Early Preview Version**: This software is in active development and should be considered an **early alpha**.
>
> - Many features are currently broken or incomplete.
> - The UI is not finalized and is subject to major changes.
> - **Security Notice**: This software has not yet been audited and should not be considered "hardened" or secure for production use. Active work is being done to harden the stack.
> - **Production Readiness**: Do not use this for critical infrastructure yet.
>
> **Website Coming Soon**: We are working on a full marketing site and official documentation at [selfhost.gg](https://selfhost.gg).

## Overview

SelfHost.gg is a modern alternative to platforms like Heroku, Netlify, and Vercel. It allows you to manage your own servers, applications, and databases on your own hardware using our lightweight **SelfHost Agent** for secure, real-time server management.

> **Why Agent Instead of SSH?** The SelfHost Agent uses outbound WebSocket connections, eliminating the need for inbound SSH ports. It provides real-time monitoring, automatic reconnection, and works behind firewalls.

SelfHost.gg features a high-performance architecture separating a **Zig Backend** from a **Svelte Frontend** for superior performance, resource efficiency, and type safety.

## Key Features

- **Deployment Engine**: Deploy from GitHub, GitLab, or Bitbucket.
- **Server Management**: Manage VPS, Bare Metal, and Raspberry Pis.
- **SelfHost Agent**: Lightweight Bun-based agent for secure, outbound monitoring and control.
- **Database Management**: Automated provisioning and backups for SQLite.
- **DNS & Proxy**: Automatic SSL (via Traefik/Caddy) and DNS management for Cloudflare and Vultr.
- **Notifications**: Integrated alerts via Email, Discord, and Telegram.
- **Multi-tenant**: Full Team/Organization support with granular roles.
- **Built-in Tunnel Management**: Seamlessly manage WireGuard tunnels for secure networking.
- **Advanced Load Balancing**: Automatic load balancing configuration for applications.
- **Blue/Green Deployments**: Native support for zero-downtime updates.

## Tech Stack

- **Frontend**: Svelte 5 (Runes) + Bun
- **Backend**: Zig 0.13.x (Zap Web Server)
- **Agent**: Bun (Typescript)
- **Database**: SQLite/LibSQL (Managed by Zig)
- **Styling**: Tailwind CSS 4.x + Shadcn/Svelte
- **Icons**: Lucide-svelte
- **Real-time**: WebSockets

## Getting Started

### Prerequisites

- **Bun** 1.1.x or higher (recommended)
- **Zig** 0.13.x
- **Docker and Docker Compose** (for local development)

### Installation & Setup

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Setup environment variables**:

   ```bash
   cp .env.example .env
   ```

   _Edit `.env` as needed._

3. **Start the development services**:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

   This starts the Zig backend, frontend dev server, and other necessary services.

4. **Access the application**:

   The application will be available at [http://localhost:5173](http://localhost:5173).

## Project Structure

```
├── frontend/         # Svelte SPA (User Interface)
│   ├── src/          # Frontend source code
│   └── static/       # Static assets
├── zig/              # Zig Backend (API + WebSocket Server)
│   ├── src/          # Zig source code
│   └── build.zig     # Zig build configuration
├── agent/            # SelfHost Agent source code (Bun/TS)
├── docker-compose.dev.yml
└── package.json
```

## Available Scripts

- `bun run dev:all` - Start full stack (Frontend + Zig Backend)
- `bun run dev` - Start frontend only (requires running backend)
- `bun run build` - Build frontend for production
- `bun run check` - Run type checking
- `bun run lint` - Lint and format check
- `bun run test` - Run Vitest tests

## Project Lead

SelfHost.gg is led by **Nick Maietta**. You can follow the project's progress and reach out directly:

- **X (Twitter)**: [@maietta](https://x.com/maietta)
- **Email**: [nick@maietta.org](mailto:nick@maietta.org)

## Sponsorships & Getting Involved

We are currently in the early stages of development and will be looking for **sponsorships** soon. This is a great time to get in early and help shape the future of self-hosting. Whether you're interested in sponsoring the project, contributing code, or providing feedback, we'd love to hear from you.

Help us make SelfHost.gg the gold standard for open-source application deployment!

## License

This project is licensed under the O'Sassy License. See the [LICENSE](LICENSE) file for details.

---

Built with by [PremoWeb LLC](https://premoweb.com)
