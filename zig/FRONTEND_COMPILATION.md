# Frontend Compilation and Binary Embedding

This document outlines how the Svelte frontend is compiled and embedded into the final Zig binary, covering both development and production workflows.

## Architecture Overview

The SelfHost project uses a hybrid architecture:

- **Zig backend**: Serves API and handles business logic
- **Svelte frontend**: Built as a static SPA and embedded directly into the Zig binary
- **Development mode**: Vite dev server proxies API calls to Zig backend
- **Production mode**: Zig serves the embedded static files directly

## Frontend Build Process

### Development Mode

During development, the frontend runs as a separate Vite dev server:

```bash
bun run dev:ui          # Starts Svelte dev server on port 5173
bun run dev:all          # Starts both Zig (port 3000) and Svelte (port 5173)
```

**Key development features:**

- Vite dev server runs on `http://localhost:5173`
- API requests (`/api/*`) and WebSocket connections (`/ws`) are proxied to Zig backend on port 3000
- Hot module replacement (HMR) for instant frontend updates
- `ZIG_BACKEND=true` environment variable enables proxy configuration
- Frontend rebuilds automatically on file changes

### Production Build Process

The frontend is built as a static SPA and embedded into the Zig binary:

#### Step 1: Build Frontend as Static Assets

```bash
bun run build            # Builds frontend with BUILD_FOR_ZIG=true
```

**Build configuration:**

- `BUILD_FOR_ZIG=true` environment variable triggers static SPA build
- Output directory: `frontend/build/` (static files only, no SvelteKit server)
- All assets are optimized and minified
- API calls are configured to hit the same domain (no proxy needed)

#### Step 2: Embed Assets in Zig Binary

```bash
cd zig && zig build      # Compiles Zig server with embedded frontend
```

**Embedding mechanism:**

- Zig reads the `frontend/build/` directory contents at compile time
- Static files are embedded as byte arrays using `@embedFile`
- Files are stored in a compressed format within the binary
- No external file dependencies required for deployment

## File Structure and Flow

### Development

```
frontend/src/           # Svelte source files
       ↓
Vite dev server         # Runs on :5173, proxies /api/* to :3000
       ↓
Zig backend            # Runs on :3000, handles API/WebSocket
```

### Production

```
frontend/src/           # Svelte source files
       ↓
bun run build          # Static build to frontend/build/
       ↓
zig build              # Embeds frontend/build/ into binary
       ↓
Single binary          # Contains both backend and embedded frontend
```

## Runtime Behavior

### Development Runtime

1. **Frontend**: Vite dev server serves Svelte SPA on `:5173`
2. **Backend**: Zig server runs on `:3000` handling API/WebSocket
3. **Proxy**: Vite configuration forwards:
   - `/api/*` → `http://localhost:3000/api/*`
   - `/ws` → `ws://localhost:3000/ws`
4. **HMR**: Frontend updates automatically on code changes

### Production Runtime

1. **Single Binary**: Zig executable contains embedded frontend
2. **Static Serving**: Zig serves frontend files from embedded data:
   - Root paths (`/`, `/dashboard/*`, etc.) → `index.html`
   - Static assets (`/assets/*`) → embedded files
3. **API Routes**: Zig handles `/api/*` routes directly
4. **WebSocket**: Zig handles `/ws` connections directly
5. **No External Dependencies**: Everything is self-contained

## Key Environment Variables

| Variable        | Development | Production | Purpose                                           |
| --------------- | ----------- | ---------- | ------------------------------------------------- |
| `ZIG_BACKEND`   | `true`      | Not set    | Enables Vite proxy to Zig backend                 |
| `BUILD_FOR_ZIG` | Not set     | `true`     | Builds frontend as static SPA for embedding       |
| `SELFHOST_DEV`  | `1`         | Not set    | Enables development features (Magic Tunnel, etc.) |

## Build Commands Reference

### Development Commands

```bash
bun run dev              # Start Vite dev server with Zig proxy
bun run dev:ui           # Frontend only (Vite dev server)
bun run dev:zig          # Backend only (Zig with hot reload)
bun run dev:all          # Both frontend and backend
```

### Build Commands

```bash
bun run build            # Build frontend as static SPA
cd zig && zig build      # Build Zig binary with embedded frontend
cd zig && zig build run  # Build and run production binary
```

### Code Quality

```bash
bun run check            # Type check frontend
bun run lint             # Lint frontend
bun run format           # Format frontend code
```

## Advantages of This Architecture

1. **Single Binary Deployment**: No need to manage separate frontend/backend deployments
2. **No CDN Required**: Frontend assets are served directly from the binary
3. **Fast Development**: HMR and separate dev servers for rapid iteration
4. **Zero External Dependencies**: Production binary is completely self-contained
5. **Consistent Environment**: Same Zig backend handles both dev and production
6. **Optimized Loading**: Static assets are compressed and embedded efficiently

## Troubleshooting

### Frontend Not Updating in Development

- Ensure Vite dev server is running (`bun run dev:ui`)
- Check that `ZIG_BACKEND=true` is set in environment
- Verify proxy configuration in `vite.config.ts`

### Production Build Issues

- Run `bun run build` first to generate static assets
- Ensure `frontend/build/` directory exists before `zig build`
- Check that all necessary files are in the build output

### Binary Size Concerns

- Frontend assets are compressed during embedding
- Use build analysis tools to identify large assets
- Consider lazy loading for large frontend modules

## Migration from Original SvelteKit Full-Stack

The original architecture (`src/`) used SvelteKit for both frontend and backend. The new Zig+Svelte architecture separates these concerns:

- **Old**: SvelteKit handled both UI and API routes
- **New**: Svelte SPA handles UI only, Zig handles all API and WebSocket routes
- **Benefit**: More efficient binary deployment, better separation of concerns, improved performance

This migration enables true single-binary deployment while maintaining the excellent developer experience of the Svelte ecosystem.
