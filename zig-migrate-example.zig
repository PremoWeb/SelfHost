// Example: Zig Migration System Implementation
// This demonstrates how a Drizzle-like migration system could work in Zig

const std = @import("std");
const sqlite = @cImport({
    @cInclude("sqlite3.h");
});

// ============================================================================
// Schema Definition (Comptime)
// ============================================================================

pub const Table = struct {
    name: []const u8,
    columns: []const Column,
    indexes: []const Index = &.{},
    foreign_keys: []const ForeignKey = &.{},
};

pub const Column = struct {
    name: []const u8,
    type: ColumnType,
    primary_key: bool = false,
    not_null: bool = false,
    unique: bool = false,
    default_value: ?[]const u8 = null,
    auto_increment: bool = false,
};

pub const ColumnType = enum {
    text,
    integer,
    real,
    blob,
};

pub const Index = struct {
    name: []const u8,
    columns: []const []const u8,
    unique: bool = false,
};

pub const ForeignKey = struct {
    name: []const u8,
    column: []const u8,
    references_table: []const u8,
    references_column: []const u8,
    on_delete: OnDelete = .no_action,
};

pub const OnDelete = enum {
    no_action,
    cascade,
    set_null,
    restrict,
};

// Example schema definition
pub const users_table = Table{
    .name = "users",
    .columns = &.{
        Column{ .name = "id", .type = .text, .primary_key = true, .not_null = true },
        Column{ .name = "name", .type = .text, .not_null = true },
        Column{ .name = "email", .type = .text, .not_null = true, .unique = true },
        Column{ .name = "email_verified", .type = .integer, .not_null = true, .default_value = "0" },
        Column{ .name = "created_at", .type = .integer, .not_null = true, .default_value = "(unixepoch())" },
    },
    .indexes = &.{
        Index{ .name = "users_email_unique", .columns = &.{"email"}, .unique = true },
    },
};

// ============================================================================
// SQL Generation (Comptime)
// ============================================================================

pub fn generateCreateTableSQL(comptime table: Table) []const u8 {
    // This would generate SQL at comptime
    // For now, just a placeholder showing the concept
    _ = table;
    return "CREATE TABLE users (...)";
}

// ============================================================================
// Migration Runner (Runtime)
// ============================================================================

pub const Migration = struct {
    name: []const u8,
    sql: []const u8,
};

pub fn runMigrations(allocator: std.mem.Allocator, db: *sqlite.sqlite3) !void {
    // 1. Ensure migrations table exists
    try createMigrationsTable(db);
    
    // 2. Get applied migrations
    const applied = try getAppliedMigrations(allocator, db);
    defer applied.deinit();
    
    // 3. Read migration files from drizzle/ directory
    const migrations = try readMigrationFiles(allocator);
    defer {
        for (migrations) |m| {
            allocator.free(m.name);
            allocator.free(m.sql);
        }
        allocator.free(migrations);
    }
    
    // 4. Apply pending migrations
    for (migrations) |migration| {
        if (applied.contains(migration.name)) {
            std.log.info("Skipping already applied migration: {s}", .{migration.name});
            continue;
        }
        
        std.log.info("Applying migration: {s}", .{migration.name});
        try applyMigration(db, migration);
        try recordMigration(allocator, db, migration.name);
    }
    
    std.log.info("All migrations applied successfully");
}

fn createMigrationsTable(db: *sqlite.sqlite3) !void {
    const sql =
        \\CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
        \\    hash TEXT NOT NULL,
        \\    created_at INTEGER DEFAULT (unixepoch())
        \\)
    ;
    
    var err_msg: ?[*:0]u8 = null;
    const rc = sqlite.sqlite3_exec(db, sql.ptr, null, null, &err_msg);
    
    if (rc != sqlite.SQLITE_OK) {
        std.log.err("Failed to create migrations table: {s}", .{err_msg.?});
        sqlite.sqlite3_free(err_msg);
        return error.MigrationError;
    }
}

fn getAppliedMigrations(allocator: std.mem.Allocator, db: *sqlite.sqlite3) !std.StringHashMap(void) {
    var applied = std.StringHashMap(void).init(allocator);
    errdefer applied.deinit();
    
    const sql = "SELECT hash FROM __drizzle_migrations ORDER BY created_at";
    var stmt: ?*sqlite.sqlite3_stmt = null;
    
    const rc = sqlite.sqlite3_prepare_v2(db, sql.ptr, @intCast(sql.len), &stmt, null);
    if (rc != sqlite.SQLITE_OK) {
        return error.PrepareFailed;
    }
    defer sqlite.sqlite3_finalize(stmt);
    
    while (sqlite.sqlite3_step(stmt) == sqlite.SQLITE_ROW) {
        const hash = sqlite.sqlite3_column_text(stmt, 0);
        const hash_len = sqlite.sqlite3_column_bytes(stmt, 0);
        const hash_str = try allocator.dupe(u8, hash[0..hash_len]);
        try applied.put(hash_str, {});
    }
    
    return applied;
}

fn readMigrationFiles(allocator: std.mem.Allocator) ![]Migration {
    const migrations_dir = "drizzle";
    var dir = try std.fs.cwd().openDir(migrations_dir, .{ .iterate = true });
    defer dir.close();
    
    var migrations = std.ArrayList(Migration).init(allocator);
    errdefer {
        for (migrations.items) |m| {
            allocator.free(m.name);
            allocator.free(m.sql);
        }
        migrations.deinit();
    }
    
    var iterator = dir.iterate();
    while (try iterator.next()) |entry| {
        if (!std.mem.endsWith(u8, entry.name, ".sql")) continue;
        if (std.mem.startsWith(u8, entry.name, "meta")) continue;
        
        const file = try dir.openFile(entry.name, .{});
        defer file.close();
        
        const content = try file.readToEndAlloc(allocator, std.math.maxInt(usize));
        const name = try allocator.dupe(u8, entry.name[0..(entry.name.len - 4)]); // Remove .sql
        
        try migrations.append(Migration{
            .name = name,
            .sql = content,
        });
    }
    
    // Sort migrations by name (which includes timestamp prefix)
    std.mem.sort(Migration, migrations.items, {}, struct {
        fn lessThan(_: void, a: Migration, b: Migration) bool {
            return std.mem.order(u8, a.name, b.name) == .lt;
        }
    }.lessThan);
    
    return try migrations.toOwnedSlice();
}

fn applyMigration(db: *sqlite.sqlite3, migration: Migration) !void {
    // Split by statement-breakpoint (like Drizzle)
    var statements = std.mem.splitSequence(u8, migration.sql, "--> statement-breakpoint");
    
    while (statements.next()) |stmt| {
        const cleaned = std.mem.trim(u8, stmt, " \n\r\t");
        if (cleaned.len == 0 or std.mem.startsWith(u8, cleaned, "--")) continue;
        
        var err_msg: ?[*:0]u8 = null;
        const rc = sqlite.sqlite3_exec(db, cleaned.ptr, null, null, &err_msg);
        
        if (rc != sqlite.SQLITE_OK) {
            // Some statements might fail if already applied (e.g., CREATE TABLE IF NOT EXISTS)
            if (std.mem.indexOf(u8, err_msg.?.ptr, "already exists") != null or
                std.mem.indexOf(u8, err_msg.?.ptr, "duplicate") != null)
            {
                continue; // Silently skip
            }
            
            std.log.err("Migration failed: {s}\nError: {s}", .{ migration.name, err_msg.? });
            sqlite.sqlite3_free(err_msg);
            return error.MigrationFailed;
        }
        
        if (err_msg) |msg| sqlite.sqlite3_free(msg);
    }
}

fn recordMigration(allocator: std.mem.Allocator, db: *sqlite.sqlite3, name: []const u8) !void {
    const sql = "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, unixepoch())";
    var stmt: ?*sqlite.sqlite3_stmt = null;
    
    const rc = sqlite.sqlite3_prepare_v2(db, sql.ptr, @intCast(sql.len), &stmt, null);
    if (rc != sqlite.SQLITE_OK) {
        return error.PrepareFailed;
    }
    defer sqlite.sqlite3_finalize(stmt);
    
    const name_z = try std.fmt.allocPrintZ(allocator, "{s}", .{name});
    defer allocator.free(name_z);
    
    _ = sqlite.sqlite3_bind_text(stmt, 1, name_z.ptr, @intCast(name_z.len), sqlite.SQLITE_TRANSIENT);
    
    const step_rc = sqlite.sqlite3_step(stmt);
    if (step_rc != sqlite.SQLITE_DONE) {
        return error.InsertFailed;
    }
}

// ============================================================================
// Usage Example
// ============================================================================

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // Open database
    var db: ?*sqlite.sqlite3 = null;
    const db_path = "sqlite.db";
    const rc = sqlite.sqlite3_open(db_path.ptr, &db);
    if (rc != sqlite.SQLITE_OK) {
        std.log.err("Failed to open database: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.DatabaseOpenFailed;
    }
    defer sqlite.sqlite3_close(db);
    
    // Run migrations
    try runMigrations(allocator, db.?);
}
