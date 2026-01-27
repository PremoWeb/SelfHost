ARG BUN_VERSION=latest
FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /app
# Better Auth requires a URL during build for validation/prerendering
ENV BETTER_AUTH_URL=http://localhost:3000
ENV BETTER_AUTH_SECRET=placeholder_secret_for_build
ENV DATABASE_URL=file:local.db

COPY --link package.json bun.lock* ./
RUN bun install --ci

COPY --link src/ ./src/
COPY --link svelte.config.js tsconfig.json vite.config.ts agent-websocket-plugin.ts ./
COPY --link static/ ./static/
COPY --link drizzle/ ./drizzle/

# Build the SvelteKit application
RUN bun run build && mkdir -p build/prerendered

# Compile the adapter's production output into a single binary
# This includes the server and asset handling logic
RUN bun build ./build/index.js --compile --outfile selfhost-server

# Final production stage
FROM oven/bun:latest AS runtime
WORKDIR /app

# Non-interactive shell for some operations
ENV DEBIAN_FRONTEND=noninteractive
# Better Auth environment variables
ENV BETTER_AUTH_URL=http://localhost:3000
ENV BETTER_AUTH_SECRET=changeme_in_production
ENV NODE_ENV=production

# Set Git repositories root to use volume mount
ENV GIT_REPOS_ROOT=/data/git-repos

# Copy dependency files
COPY --link package.json bun.lock* ./
# Install production dependencies (includes building native modules for the runtime environment)
RUN bun install --ci --production

# Copy the compiled binary from builder
COPY --from=builder /app/selfhost-server ./selfhost-server
# Copy the client assets and prerendered files
# svelte-adapter-bun expects these folders in the same directory as the server
COPY --from=builder /app/build/client ./client
COPY --from=builder /app/build/prerendered ./prerendered
# Copy migrations for automatic DB initialization
COPY --from=builder /app/drizzle ./drizzle
COPY --link healthcheck.ts ./

# Create data directory for SQLite databases and Git repos
RUN mkdir -p /data /data/git-repos && \
    touch /data/sqlite.db && \
    chown -R bun:bun /data /app

EXPOSE 3000/tcp

# Create volume mount point for persistent data
VOLUME ["/data"]

USER bun

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
    CMD bun /app/healthcheck.ts || exit 1

# Run the compiled binary
CMD ["./selfhost-server"]
