# SelfHost.gg – Self-Hosting for the Greater Good

### by PremoWeb LLC

An open-source, full-stack application deployment platform built with SvelteKit, Drizzle ORM, and Docker.

[![SvelteKit](https://img.shields.io/badge/Framework-SvelteKit%202.x-ff3e00?logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-c5f74f?logo=drizzle)](https://orm.drizzle.team/)
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
> 🌐 **Website Coming Soon**: We are working on a full marketing site and official documentation at [selfhost.gg](https://selfhost.gg).

## 🚀 Overview

SelfHost.gg is a modern alternative to platforms like Heroku, Netlify, and Vercel. It allows you to manage your own servers, applications, and databases on your own hardware using our lightweight **SelfHost Agent** for secure, real-time server management.

> **Why Agent Instead of SSH?** The SelfHost Agent uses outbound WebSocket connections, eliminating the need for inbound SSH ports. It provides real-time monitoring, automatic reconnection, and works behind firewalls. [Learn more →](/docs/agent)

SelfHost.gg features a high-performance **Full-Stack SvelteKit** architecture designed for a superior developer experience and real-time responsiveness.

## ✨ Key Features

- **🚀 Deployment Engine**: Deploy from GitHub, GitLab, or Bitbucket with automatic build-pack detection.
- **🖥️ Server Management**: Manage VPS, Bare Metal, and Raspberry Pis.
- **🛡️ SelfHost Agent**: Lightweight Bun-based agent for secure, outbound monitoring and control.
- **🗄️ Database Management**: Automated provisioning and backups for PostgreSQL, MySQL, MariaDB, MongoDB, and Redis.
- **🌐 DNS & Proxy**: Automatic SSL (via Traefik/Caddy) and DNS management for Cloudflare and Vultr.
- **🔔 Notifications**: Integrated alerts via Email, Discord, and Telegram.
- **👥 Multi-tenant**: Full Team/Organization support with granular roles.
- **Built-in Tunnel Management**: Seamlessly manage WireGuard tunnels for secure networking.
- **Advanced Load Balancing**: Automatic load balancing configuration for applications.
- **Blue/Green Deployments**: Native support for zero-downtime updates.

## �️ Tech Stack

- **Framework**: SvelteKit 2.x (Svelte 5 Runes)
- **Runtime**: Bun 1.1.x
- **Database**: SQLite/LibSQL + Drizzle ORM
- **Styling**: Tailwind CSS 4.x + Shadcn/Svelte
- **Icons**: Lucide-svelte
- **Real-time**: WebSockets & Server-Sent Events (SSE)
- **Terminal**: XTerm.js
- **Authentication**: Better Auth

## � Getting Started

### Prerequisites

- **Bun** 1.1.x or higher (recommended)
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

3. **Start the development services (PostgreSQL, Redis, etc.)**:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

4. **Run the development server**:
   ```bash
   bun run dev
   ```

The application will be available at [http://localhost:5173](http://localhost:5173).

## 🏗️ Project Structure

```
├── src/
│   ├── lib/          # Shared components, utilities, and state
│   │   ├── api/      # API client and resource endpoints
│   │   ├── components/ # Reusable UI components
│   │   └── websocket/ # WebSocket logic
│   ├── routes/       # SvelteKit file-based routing
│   └── app.html      # HTML template
├── static/           # Static assets
├── agent/            # SelfHost Agent source code
├── drizzle/          # Database migrations and schema
├── scripts/          # Utility scripts
├── docker-compose.dev.yml
└── package.json
```

## 🛠️ Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run check` - Run type checking
- `bun run lint` - Lint and format check
- `bun run test` - Run Vitest tests
- `bun run db:generate` - Generate Drizzle migrations
- `bun run db:push` - Push schema changes to database

## � License

This project is licensed under the O'Sassy License. See the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by [PremoWeb LLC](https://premoweb.com)
