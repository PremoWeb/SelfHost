# Co-located frontend (HTML served by Zig)

This directory holds the **built** Svelte UI (HTML, JS, CSS) so the Zig server can serve it directly. The source lives in the repo root `frontend/`; building with `build:zig` outputs here.

## Build and run

1. **Sync and build into zig/frontend/** (from repo root):
   ```bash
   cd frontend && npm run sync && npm install && npm run build:zig
   ```
   Output: **`zig/frontend/`** (index.html + assets).

2. **Run the Zig server** (from repo root or `zig/`):
   ```bash
   cd zig && zig build run
   ```
   Zig serves static files from **`zig/frontend/`** when that directory exists (or from `frontend` when cwd is `zig/`). The HTML files are co-located with the Zig server and served by it.

## Static dir order

Zig looks for static files in this order:

- `STATIC_DIR` (if set)
- `frontend` (when run from `zig/` → zig/frontend/)
- `zig/frontend` (when run from repo root)
- `frontend/build`, `../frontend/build`, `build`
- Fallback: `frontend`

## Override

- `STATIC_DIR=/path/to/dir` — force Zig to serve a specific directory.
