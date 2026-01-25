import { db } from '../db/client';
import { servers } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface ProxyConfig {
    type: 'traefik' | 'caddy' | 'none';
    email?: string;
}

export function generateTraefikConfig(server: any) {
    const proxyPath = '/data/premo/proxy';
    
    return `
version: '3.8'
services:
  traefik:
    container_name: premo-proxy
    image: traefik:v3.6
    restart: always
    network_mode: host
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:80/ping"]
      interval: 4s
      timeout: 2s
      retries: 5
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ${proxyPath}:/traefik
    command:
      - "--ping=true"
      - "--ping.entrypoint=http"
      - "--api.dashboard=true"
      - "--api.insecure=true"
      - "--entrypoints.http.address=:80"
      - "--entrypoints.https.address=:443"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.file.directory=/traefik/dynamic/"
      - "--providers.file.watch=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http"
      - "--certificatesresolvers.letsencrypt.acme.storage=/traefik/acme.json"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.entrypoints=http"
      - "traefik.http.routers.traefik.service=api@internal"
      - "traefik.http.services.traefik.loadbalancer.server.port=8080"
      - "premo.managed=true"
      - "premo.proxy=true"
`;
}

export async function updateProxySettings(serverId: string, teamId: string, settings: ProxyConfig) {
    await db.update(servers)
        .set({
            proxyType: settings.type,
            updatedAt: new Date()
        })
        .where(eq(servers.id, serverId));
    
    return { success: true };
}

export async function getProxyStatus(serverId: string) {
    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    return server?.proxyStatus || 'stopped';
}
