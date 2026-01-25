---
title: Cloudflare Integration
description: Securely manage servers behind firewalls using Cloudflare Tunnels and Access.
---

# Cloudflare Integration

SelfHost integrates deeply with Cloudflare to provide secure, frictionless management of your infrastructure, even when servers are located behind strict firewalls or NAT.

## Cloudflare Tunnels (Argo)

Cloudflare Tunnels allow you to connect your servers to the Cloudflare network without opening any inbound ports on your firewall. This is the recommended way to manage "hidden" infrastructure like home labs, internal office servers, or private cloud VPCs.

### Benefits
- **No Inbound Ports**: You don't need to open port 80, 443, or 22 to the public internet.
- **DDoS Protection**: Your server IP remains hidden; all traffic goes through Cloudflare's edge.
- **Simplified Networking**: Works seamlessly behind NAT and CGNAT (Commonly used by home ISPs and mobile networks).

## SSH over Tunnels

One of the most powerful features of SelfHost's Cloudflare integration is the ability to perform the initial **Agent Installation** over a Cloudflare Tunnel.

### How it Works
When you provide a Cloudflare Tunnel hostname (e.g., `ssh.example.com`) and a Service Token ID, SelfHost performs the following:

1. **Proxy Stream**: SelfHost uses the `cloudflared` binary on the control panel server to create a local proxy stream.
2. **End-to-End Encryption**: The SSH connection is wrapped inside a secure tunnel, authenticated by your Cloudflare Access Service Token.
3. **Agent Bootstrapping**: The SelfHost Agent is uploaded and installed over this secure tunnel.
4. **WebSocket Handover**: Once installed, the Agent establishes its own outbound WebSocket connection back to the control panel.

### Requirements
To use SSH over Tunnels, you must:
1. Have `cloudflared` installed on your server and configured as a Tunnel.
2. Create a **Self-Hosted Application** in Cloudflare Access for your SSH hostname.
3. Create a **Service Token** in Cloudflare Access.
4. Add the **Service Token ID** and **Access Client Secret** to your SelfHost settings or the specific server configuration.

## Zero-Trust Access

By using Cloudflare Access, you can ensure that only your SelfHost control panel can reach the SSH port of your servers. 

### Configuration Steps
1. **Cloudflare Dashboard**: Navigate to Zero Trust > Access > Applications.
2. **Add Application**: Select "Self-hosted".
3. **Policies**: Create a policy that allows access based on the "Service Token" you created.
4. **SelfHost Dashboard**: When adding a server, select "Cloudflare Tunnel" as the connection type and provide the hostname and Token IDs.

## Automatic Agent Updates

Even if your server is behind a firewall, once the initial installation is complete, the SelfHost Agent uses its own persistent WebSocket connection for all management tasks. This means you get real-time logs, health metrics, and one-click deployments without ever needing to touch your firewall settings again.
