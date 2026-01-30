# Zig Backend Implementation

This directory contains the Zig port of the selfhost backend server.

## Migration System (Option 1: Hybrid Approach)

We use a **hybrid approach** for database migrations:

- **Migration Generation**: Continue using Drizzle Kit (`drizzle-kit generate`) to generate SQL migration files
- **Migration Execution**: Zig-based migration runner that reads and executes the SQL files from `drizzle/` directory

### How It Works

1. **Generate migrations** (using existing TypeScript tooling):
   ```bash
   npm run db:generate  # or: drizzle-kit generate
   ```
   This creates SQL files in `../drizzle/` directory.

2. **Run migrations** (Zig server automatically runs them on startup):
   ```zig
   var db = try database.openFromEnv(allocator);
   try db.initialize("drizzle");  // Reads from drizzle/ and applies pending migrations
   ```

### Migration Runner Features

- ✅ Reads SQL files from `drizzle/` directory
- ✅ Tracks applied migrations in `__drizzle_migrations` table
- ✅ Handles Drizzle's `--> statement-breakpoint` format
- ✅ Skips already-applied migrations
- ✅ Gracefully handles "already exists" errors (for idempotent migrations)
- ✅ Sorts migrations by name (timestamp prefix ensures correct order)

### File Structure

```
zig/
├── build.zig              # Build configuration
├── src/
│   ├── main.zig           # Server entry point
│   └── db/
│       ├── migrate.zig    # Migration runner
│       └── database.zig   # Database connection wrapper
└── README.md              # This file
```

## Building

```bash
cd zig
zig build
```

## Running

```bash
zig build run
```

The server will:
1. Open the database (from `DATABASE_URL` env var or default `sqlite.db`)
2. Automatically run pending migrations from `../drizzle/` directory
3. Start the HTTP/WebSocket server (when implemented)

## Development Workflow

1. **Make schema changes** in `../src/lib/server/db/schema.ts` (TypeScript)
2. **Generate migration**: `npm run db:generate`
3. **Test migration**: `zig build run` (migrations run automatically on startup)

## Migration Files

Migration files are stored in `../drizzle/` (shared with TypeScript codebase):
- `0000_many_human_cannonball.sql`
- `0001_clear_wither.sql`
- etc.

The Zig migration runner reads these files and executes them in order.

## Compatibility

The migration system is **100% compatible** with:
- Existing Drizzle migration files
- Drizzle Kit migration generation
- The `__drizzle_migrations` tracking table
- Drizzle's statement-breakpoint format

You can continue using all existing Drizzle tooling while the Zig server executes the migrations.
