# SelfHost Platform - Feature Documentation

> A modern, self-hosted application deployment platform built with SvelteKit, PostgreSQL, and Docker.

## 🎯 Overview

SelfHost is a comprehensive platform for deploying and managing web applications, databases, and services across your own infrastructure. Built with security, performance, and developer experience as top priorities.

---

## 🔐 Authentication & Authorization

### User Management

- **User Registration & Login** - Secure authentication with bcrypt password hashing
- **Session Management** - 7-day session duration with automatic cleanup
- **Email Verification** - Support for email verification workflows
- **Password Security** - Industry-standard bcrypt with configurable salt rounds

### Team Management

- **Multi-tenant Architecture** - Full team/organization support
- **Personal Teams** - Automatic personal team creation on registration
- **Team Switching** - Seamless switching between multiple teams
- **Role-based Access Control** - Owner, admin, and member roles
- **Team Invitations** - Invite users to join teams

---

## 🔑 Security Features

### SSH Key Management

- **Private Key Storage** - Secure storage of SSH private keys
- **Key Enrollment** - Easy enrollment of new SSH keys
- **Key Assignment** - Assign keys to specific servers
- **Key Descriptions** - Organize keys with names and descriptions

### API Token Management

- **Token Generation** - Create API tokens for programmatic access
- **Token Scoping** - Team-scoped tokens for security
- **Token Revocation** - Instantly revoke compromised tokens
- **Last Used Tracking** - Monitor token usage
- **Copy to Clipboard** - Secure one-time token display

---

## 🖥️ Server Management

### Server Configuration

- **Multi-server Support** - Manage unlimited servers
- **Connection Types** - SSH and agent-based connections
- **IPv4/IPv6 Support** - Full dual-stack networking
- **Custom Ports** - Configure non-standard SSH ports
- **Server Tags** - Organize servers with tags
- **Server Descriptions** - Document server purposes

### Server Monitoring

- **Health Metrics** - CPU, memory, and disk usage tracking
- **Connection Status** - Real-time online/offline status
- **Health Dashboard** - Visual health indicators
- **Last Updated Tracking** - Monitor metric freshness

### Proxy Management

- **Traefik Integration** - Automatic reverse proxy setup
- **Caddy Support** - Alternative proxy option
- **Proxy Status Tracking** - Monitor proxy health
- **Automatic Configuration** - Zero-config proxy deployment

---

## 🚀 Application Deployment

### Application Management

- **Git Integration** - Deploy from GitHub, GitLab, Bitbucket
- **Branch Selection** - Deploy specific branches
- **Build Pack Detection** - Automatic framework detection
- **Custom Domains** - FQDN configuration
- **Environment Variables** - Build-time and runtime variables
- **Application Status** - Running, stopped, restarting states

### Deployment Features

- **Deployment History** - Track all deployments
- **Commit Tracking** - Link deployments to commits
- **Deployment Status** - Queued, in progress, finished, failed
- **Rollback Support** - Revert to previous deployments
- **Build Logs** - Real-time build output

---

## 🗄️ Database Management

### Supported Databases

- **PostgreSQL** - Full PostgreSQL support
- **MySQL** - MySQL/MariaDB support
- **MongoDB** - NoSQL database support
- **Redis** - In-memory data store

### Database Features

- **Automated Backups** - S3-compatible backup storage
- **Database Status** - Monitor database health
- **Connection Strings** - Easy connection management
- **Resource Limits** - Configure memory and CPU limits

---

## 🔗 Git Source Integration

### GitHub App Integration

- **OAuth Registration** - Streamlined GitHub App setup
- **Webhook Support** - Automatic deployment triggers
- **Installation Tracking** - Monitor app installations
- **Repository Access** - Browse accessible repositories
- **JWT Authentication** - Secure GitHub API access
- **Real-time Events** - Push, pull request, installation events

### Personal Access Tokens

- **PAT Support** - Alternative to GitHub Apps
- **Multi-provider** - GitHub, GitLab, Bitbucket support
- **Custom Git URLs** - Self-hosted Git servers
- **API URL Configuration** - Custom API endpoints

### Repository Browser

- **Repository Listing** - View all accessible repos
- **Search Functionality** - Filter repositories by name/description
- **Branch Information** - See default branches
- **Privacy Indicators** - Public/private badges
- **Direct Links** - Quick access to GitHub

---

## 🌐 Domain & DNS Management

### Domain Management

- **Custom Domains** - Manage multiple domains
- **DNS Provider Integration** - Vultr, Cloudflare support
- **Nameserver Profiles** - Reusable NS configurations
- **Default Profiles** - Team-wide defaults

### DNS Records

- **Record Types** - A, AAAA, CNAME, MX, TXT, NS, SRV
- **TTL Configuration** - Custom time-to-live settings
- **Priority Support** - MX and SRV record priorities
- **Tag-based Sync** - Automatic DNS updates
- **Server Sync** - Auto-update DNS for server IPs

---

## 📦 Storage & Backups

### S3 Storage

- **S3-compatible Storage** - Any S3-compatible provider
- **Backup Storage** - Application and database backups
- **Custom Endpoints** - Self-hosted S3 support
- **Region Configuration** - Multi-region support
- **Access Control** - Secure credential management

---

## 🏗️ Infrastructure Provisioning

### VPS Provider Integration

- **Vultr Integration** - Automated VPS provisioning
- **Template System** - Reusable VPS configurations
- **Region Selection** - Deploy to any region
- **Plan Selection** - Choose instance sizes
- **OS Selection** - Multiple operating systems
- **SSH Key Injection** - Automatic key deployment

---

## 📊 Project & Environment Management

### Project Organization

- **Multi-project Support** - Organize applications by project
- **Client Assignment** - Link projects to clients (CRM)
- **Environment Isolation** - Dev, staging, production
- **Project Descriptions** - Document project details
- **Team Sharing** - Share projects across teams

### Environment Management

- **Multiple Environments** - Unlimited environments per project
- **Environment Variables** - Scoped to environments
- **Resource Grouping** - Apps and databases per environment

---

## 👥 Client Management (CRM)

### Client Features

- **Client Profiles** - Store client information
- **Contact Details** - Email, phone, company
- **Project Association** - Link projects to clients
- **Client Dashboard** - View all client projects
- **Team Scoping** - Clients belong to teams

---

## 🔔 Notifications

### Notification Channels

- **Email Notifications** - SMTP, Resend, SendGrid
- **Discord Integration** - Webhook notifications
- **Telegram Integration** - Bot notifications
- **Event Triggers** - Deployment success/failure
- **Channel Management** - Enable/disable channels
- **Multi-channel Support** - Multiple channels per team

---

## 🔄 Real-time Features

### Live Activity Feed

- **Push Event Notifications** - Real-time push alerts
- **Server-Sent Events (SSE)** - Live event streaming
- **Event History** - Last 50 events cached
- **Expandable Widget** - Lower-left corner widget
- **Event Details** - Repo, branch, commit, author, timestamp
- **Team Filtering** - Only see your team's events

### Webhook Processing

- **GitHub Webhooks** - Push, PR, installation events
- **Signature Validation** - HMAC-SHA256 verification
- **Event Broadcasting** - Real-time event distribution
- **Installation Tracking** - Auto-update installation IDs

---

## 🎨 User Interface

### Design System

- **Shadcn/UI Components** - Modern, accessible components
- **Dark Mode** - Full dark mode support with system detection
- **Theme Switcher** - Light, dark, system preferences
- **Responsive Design** - Mobile-first approach
- **View Transitions** - Smooth page transitions
- **Toast Notifications** - User feedback system

### Navigation

- **Sidebar Navigation** - Persistent navigation
- **Breadcrumbs** - Context-aware navigation
- **Quick Actions** - Keyboard shortcuts
- **Search** - Global search functionality

---

## 🛠️ Developer Experience

### Development Tools

- **Cloudflare Tunnel Integration** - Local webhook testing
- **Environment Detection** - Dev/prod configurations
- **Hot Module Replacement** - Fast development iteration
- **TypeScript** - Full type safety
- **Drizzle ORM** - Type-safe database queries

### API Features

- **RESTful API** - Standard REST endpoints
- **Type-safe Clients** - Generated TypeScript clients
- **Error Handling** - Consistent error responses
- **Request Validation** - Input validation

---

## 📱 Quick Deploy

### Simplified Deployment

- **One-click Deploy** - Deploy apps without projects
- **Status Tracking** - Monitor deployment status
- **Health Checks** - Automatic health monitoring
- **Server Assignment** - Deploy to specific servers

---

## 🔐 Security Best Practices

### Security Features

- **CSRF Protection** - SameSite cookie policies
- **SQL Injection Prevention** - Parameterized queries
- **XSS Protection** - Content Security Policy
- **Secure Sessions** - HttpOnly, Secure cookies
- **Password Hashing** - Bcrypt with salt rounds
- **API Token Security** - Cryptographically secure tokens
- **Webhook Signatures** - HMAC verification
- **Environment-based Security** - Stricter prod settings

---

## 📈 Performance

### Optimization

- **Database Indexing** - Optimized queries
- **Connection Pooling** - Efficient database connections
- **Caching** - Strategic caching layers
- **Lazy Loading** - On-demand resource loading
- **Code Splitting** - Optimized bundle sizes

---

## 🔄 Shared Resources

### Shared Variables

- **Environment Variables** - Team-wide variables
- **Public/Private** - Control variable visibility
- **Variable Reuse** - Share across applications
- **Secure Storage** - Encrypted sensitive data

---

## 📋 Deployment Tracking

### Deployment Features

- **Deployment Queue** - Manage deployment queue
- **Status Monitoring** - Track deployment progress
- **Commit Linking** - Link to source commits
- **Time Tracking** - Start and finish timestamps
- **Failure Handling** - Error capture and reporting

---

## 🎯 Upcoming Features

### Planned Enhancements

- Automatic deployments on push
- PR preview environments
- Deployment status updates to GitHub
- Container registry integration
- Kubernetes support
- Advanced monitoring and alerting
- Cost tracking and optimization
- Multi-cloud support
- CI/CD pipeline builder
- Application templates
- One-click app marketplace

---

## 🏗️ Technical Stack

### Frontend

- **SvelteKit** - Modern web framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Component library
- **Lucide Icons** - Icon system

### Backend

- **Node.js/Bun** - JavaScript runtime
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Database toolkit
- **Docker** - Containerization
- **Traefik/Caddy** - Reverse proxy

### Infrastructure

- **SSH** - Secure server access
- **Git** - Version control integration
- **S3** - Object storage
- **Cloudflare Tunnel** - Development webhooks

---

## 📄 License

O'Sassy License - Copyright © 2026 PremoWeb LLC

---

**Built with ❤️ for developers who value control, security, and performance.**
