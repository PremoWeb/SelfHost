# Zig Migration System Proposal (Drizzle-like)

## Overview

A Zig-based migration system that provides Drizzle Kit-like functionality:
- **Schema definitions** in Zig using comptime
- **Automatic migration generation** from schema diffs
- **Migration tracking** via journal and snapshots
- **Type-safe** database operations

## Architecture

### 1. Schema Definition (Zig)

```zig
// src/db/schema.zig
const std = @import("std");
const db = @import("db");

pub const users = db.Table("users", .{
    .id = db.Column.text().primaryKey().defaultFn(uuid),
    .name = db.Column.text().notNull(),
    .email = db.Column.text().notNull().unique(),
    .email_verified = db.Column.integer(.boolean).default(false).notNull(),
    .image = db.Column.text().nullable(),
    .is_god = db.Column.integer(.boolean).default(false).notNull(),
    .created_at = db.Column.integer(.timestamp).default("unixepoch()").notNull(),
    .updated_at = db.Column.integer(.timestamp).default("unixepoch()").notNull(),
}, .{
    .indexes = &.{
        db.Index.unique("users_email_unique", &.{"email"}),
    },
});

pub const teams = db.Table("teams", .{
    .id = db.Column.text().primaryKey().defaultFn(uuid),
    .name = db.Column.text().notNull(),
    .description = db.Column.text().nullable(),
    .personal_team = db.Column.integer(.boolean).default(false).notNull(),
    .company_id = db.Column.text().nullable().references("companies", "id", .{ .on_delete = .set_null }),
    .created_at = db.Column.integer(.timestamp).default("unixepoch()").notNull(),
    .updated_at = db.Column.integer(.timestamp).default("unixepoch()").notNull(),
}, .{
    .foreign_keys = &.{
        db.ForeignKey("teams_company_id_companies_id_fk", "company_id", "companies", "id", .{ .on_delete = .set_null }),
    },
});
```

### 2. Migration Generator CLI

```zig
// tools/zig-migrate/main.zig
const std = @import("std");
const schema = @import("../../src/db/schema.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 2) {
        printUsage();
        return;
    }

    const command = args[1];
    
    if (std.mem.eql(u8, command, "generate")) {
        try generateMigration(allocator);
    } else if (std.mem.eql(u8, command, "migrate")) {
        try runMigrations(allocator);
    } else if (std.mem.eql(u8, command, "push")) {
        try pushSchema(allocator);
    } else {
        printUsage();
    }
}

fn generateMigration(allocator: std.mem.Allocator) !void {
    // 1. Load current schema snapshot (if exists)
    const current_snapshot = try loadSnapshot("drizzle/meta/latest_snapshot.json");
    
    // 2. Generate new snapshot from comptime schema
    const new_snapshot = try generateSnapshotFromSchema(allocator);
    
    // 3. Diff snapshots to generate SQL
    const diff = try diffSnapshots(allocator, current_snapshot, new_snapshot);
    
    // 4. Generate migration file
    const migration_name = try generateMigrationName();
    const sql = try generateSQL(diff);
    try writeMigrationFile(migration_name, sql);
    
    // 5. Update journal
    try updateJournal(migration_name, new_snapshot);
    
    std.log.info("Generated migration: {s}", .{migration_name});
}
```

### 3. Migration Runner (Runtime)

```zig
// src/db/migrate.zig
const std = @import("std");
const sqlite = @import("sqlite");

pub fn runMigrations(db_conn: *sqlite.Database) !void {
    // 1. Ensure migrations table exists
    try createMigrationsTable(db_conn);
    
    // 2. Get applied migrations
    const applied = try getAppliedMigrations(db_conn);
    
    // 3. Read migration files from drizzle/ directory
    const migrations = try readMigrationFiles();
    
    // 4. Apply pending migrations
    for (migrations) |migration| {
        if (applied.contains(migration.name)) continue;
        
        std.log.info("Applying migration: {s}", .{migration.name});
        try applyMigration(db_conn, migration);
        try recordMigration(db_conn, migration.name);
    }
}

fn applyMigration(db_conn: *sqlite.Database, migration: Migration) !void {
    // Split by statement-breakpoint (like Drizzle)
    const statements = try splitStatements(migration.sql);
    
    for (statements) |stmt| {
        try db_conn.exec(stmt);
    }
}
```

### 4. Comptime Schema Introspection

```zig
// src/db/schema.zig - Comptime helpers
pub fn Table(comptime name: []const u8, comptime columns: anytype, comptime options: anytype) type {
    return struct {
        pub const table_name = name;
        pub const table_columns = columns;
        pub const table_options = options;
        
        // Comptime SQL generation
        pub fn createTableSQL() []const u8 {
            // Generate CREATE TABLE statement at comptime
            // This is used by the migration generator
        }
        
        // Runtime struct for type safety
        pub const Row = struct {
            // Generated from columns definition
        };
    };
}
```

## Usage

### Generate Migration
```bash
zig build run -- tools/zig-migrate generate
# Creates: drizzle/0009_new_migration.sql
# Updates: drizzle/meta/_journal.json
# Creates: drizzle/meta/0009_snapshot.json
```

### Run Migrations
```bash
zig build run -- tools/zig-migrate migrate
# Or automatically on server startup
```

### Push Schema (dev only)
```bash
zig build run -- tools/zig-migrate push
# Directly applies schema without migration files
```

## Comparison to Drizzle

| Feature | Drizzle Kit | Zig Migrate |
|---------|-------------|-------------|
| Schema Definition | TypeScript | Zig (comptime) |
| Migration Generation | `drizzle-kit generate` | `zig-migrate generate` |
| Migration Execution | Runtime (TypeScript) | Runtime (Zig) |
| Type Safety | TypeScript types | Zig structs |
| Snapshot Tracking | JSON files | JSON files |
| Journal | `_journal.json` | `_journal.json` |

## Benefits

1. **Native Zig**: No TypeScript dependency for migrations
2. **Comptime Safety**: Schema validated at compile time
3. **Fast**: Zig's fast compilation and execution
4. **Cross-platform**: Works on all Zig-supported targets
5. **Familiar Workflow**: Similar to Drizzle Kit commands

## Alternative: Hybrid Approach

Keep using Drizzle Kit for migration generation (it's just a dev tool), but use Zig for:
- Migration execution (runtime)
- Schema definitions (for type safety in Zig code)

This gives you:
- ✅ Drizzle Kit's mature migration generation
- ✅ Zig-native runtime execution
- ✅ No need to reimplement Drizzle Kit
