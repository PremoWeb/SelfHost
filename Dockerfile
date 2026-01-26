ARG BUN_VERSION=latest
FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /app
ENV NODE_ENV=production
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

RUN bun --bun run build

FROM oven/bun:${BUN_VERSION} AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PROTOCOL_HEADER=x-forwarded-proto
ENV HOST_HEADER=x-forwarded-host

# Set database paths to use volume mount
ENV DATABASE_URL=file:/data/sqlite.db
ENV LOGGING_DATABASE_URL=file:/data/sqlite-logs.db
# Set Git repositories root to use volume mount
ENV GIT_REPOS_ROOT=/data/git-repos

COPY --link package.json bun.lock* ./
RUN bun install --ci --production

COPY --from=builder --chown=bun:bun /app/build ./build
COPY --link healthcheck.ts ./

# Create data directory for SQLite databases and Git repos
# This will be mounted as a volume at runtime
RUN mkdir -p /data /data/git-repos && \
    chown -R bun:bun /data

EXPOSE 3000/tcp

# Create volume mount point for persistent data
VOLUME ["/data"]

USER bun

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
    CMD bun /app/healthcheck.ts || exit 1

CMD ["bun", "--bun", "build/index.js"]
