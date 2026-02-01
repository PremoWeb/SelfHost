# Stage 1: Build Frontend
FROM oven/bun:latest AS frontend-builder

WORKDIR /app

# Setup directories to match the structure expected by build scripts
RUN mkdir -p frontend zig

# Install Frontend Dependencies
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install

# Copy Frontend Source
COPY frontend/ ./

# Build Frontend
# This runs "vite build" with BUILD_TO_ZIG=1.
# vite.config.ts outputs to ../zig/frontend (which is /app/zig/frontend)
RUN bun run build:zig


# Get Zig compiler toolchain from reliable community image
FROM kassany/alpine-ziglang:0.15.1 AS zig-toolchain


# Stage 2: Build Backend (Zig)
FROM debian:bookworm-slim AS backend-builder

WORKDIR /app

# Install system dependencies required for zig build/fetch/linking
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsqlite3-dev \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Zig toolchain from the actual locations in kassany/alpine-ziglang:0.15.1
# Binary + lib dir are under /zig/0.15.1/files/
COPY --from=zig-toolchain /zig/0.15.1/files/zig          /usr/local/bin/zig
COPY --from=zig-toolchain /zig/0.15.1/files/lib          /usr/local/lib/zig/

# Optional: if you get linker errors later (missing compiler-rt, libc++, etc.), add these
# COPY --from=zig-toolchain /zig/0.15.1/files/lib/libc     /usr/local/lib/libc/     || true
# COPY --from=zig-toolchain /zig/0.15.1/files/lib/libcxx   /usr/local/lib/libcxx/   || true
# COPY --from=zig-toolchain /zig/0.15.1/files/lib/compiler-rt /usr/local/lib/compiler-rt/ || true

# Add zig to PATH
ENV PATH="/usr/local/bin:${PATH}"

# Debug: uncomment during troubleshooting to confirm Zig works and paths are correct
# RUN zig version || echo "Zig binary not found or not executable" && \
#     ls -la /usr/local/bin/zig && \
#     ls -la /usr/local/lib/zig || echo "Lib dir missing"

# Copy Frontend Build from Stage 1 for embedding
COPY --from=frontend-builder /app/zig/frontend /app/frontend/build

# Copy Your Zig source code
COPY zig/ ./zig/

# Build the Zig binary
WORKDIR /app/zig

# Fetch deps + build (add -v for verbose output if debugging)
# Also ensure libfacil.io.so is copied to a known location
RUN zig build -Doptimize=ReleaseSafe 2>&1 | tee /tmp/build.log || true
RUN mkdir -p /tmp/lib && find /root/.cache/zig/p -name "libfacil.io.so" -exec cp {} /tmp/lib/ \; 2>/dev/null || true
RUN ls -la /tmp/lib/ 2>/dev/null || echo "Library not in cache"


# Stage 3: Final Runtime
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create persistent data directories
RUN mkdir -p /data/git-repos /app/frontend /app/drizzle

# Copy built backend binary
COPY --from=backend-builder /app/zig/zig-out/bin/selfhost-server /app/selfhost-server

# Copy libfacil.io.so from build cache if available
COPY --from=backend-builder /tmp/lib/libfacil.io.so /usr/local/lib/libfacil.io.so 2>/dev/null || true
RUN ldconfig 2>/dev/null || true

# Copy and setup entrypoint script for library loading
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Frontend assets are now embedded in the binary.
# COPY --from=frontend-builder /app/zig/frontend /app/frontend

# Copy drizzle migrations from build context (source files)
COPY drizzle/ /app/drizzle/

# Set permissions for non-root user
RUN chown -R www-data:www-data /data /app

# Environment variables
ENV DATABASE_URL=file:/data/sqlite.db \
    LOGGING_DATABASE_URL=file:/data/sqlite-logs.db \
    STATIC_DIR=/app/frontend \
    DRIZZLE_DIR=/app/drizzle \
    PORT=3000 \
    GIT_REPOS_ROOT=/data/git-repos

# Persistent volume for sqlite DBs + git repos
VOLUME ["/data"]

EXPOSE 3000

# Run as non-root user
USER www-data

# Start the server with entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/app/selfhost-server"]