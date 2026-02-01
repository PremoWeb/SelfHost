# 🎯 SelfHost Project Summary

## 📁 Project Structure

```
├── frontend/            # Svelte SPA (Frontend)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/     # Zig API Client
│   │   │   └── components/
│   │   └── routes/      # Application Pages
│   └── static/          # Public assets
├── zig/                 # Zig Backend
│   ├── src/
│   │   ├── api.zig      # API Endpoints
│   │   ├── db/          # SQLite Logic
│   │   └── main.zig     # Server Entry
├── agent/               # SelfHost Agent (Bun/TS)

└── package.json
```

## 🔧 Key Configuration

### Package Manager: Bun

We use Bun for all JavaScript/TypeScript tooling.

### Backend: Zig (Zap)

The backend is a high-performance HTTP/WebSocket server written in Zig using the Zap framework.

### Database: SQLite

We use embedded SQLite (via Zig) for data storage, replacing the previous PostgreSQL setup.

## 📦 Tech Stack

### Frontend

- **Framework**: Svelte 5
- **UI**: Svelte 5 (Runes) + Shadcn-Svelte
- **Styling**: Tailwind CSS 4.x
- **Build**: Vite

### Backend

- **Language**: Zig 0.13.x
- **Web Server**: Zap (facil.io wrapper)
- **Database**: SQLite
- **Auth**: Custom Session Auth (Zig)

## 🌐 Service URLs

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

## 🔐 Environment Variables

### `.env`

```bash
# Public
PUBLIC_API_URL=http://localhost:3000/api
PUBLIC_WS_HOST=localhost
PUBLIC_WS_PORT=3000

# Private (Zig Backend)
DATABASE_PATH=sqlite.db
PORT=3000
```

## ✅ Setup Status

- [x] Svelte SPA configured
- [x] Zig Backend operational
- [x] SQLite integration working
- [x] Agent WebSocket protocol established
- [x] Docker Multi-stage build (In Progress)

## 🎯 Next Steps

1.  **Fix Docker Build**: Resolve dependency issues in the multi-stage build.
2.  **Port Remaining Routes**: Move remaining logic from legacy SvelteKit backend to Zig.
3.  **UI Polish**: Finalize the dashboard and project views.

---

**Project Status**: 🚧 Active Development (Migration to Zig)
**Maintainer**: SelfHost Team
