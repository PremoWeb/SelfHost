// Database Migration Runner for Zig
// Reads and executes Drizzle-generated SQL migration files
// Compatible with existing drizzle/ directory structure

const std = @import("std");
const sqlite = @import("sqlite.zig").sqlite;

const log = std.log.scoped(.migrate);

pub const MigrationError = error{
    OutOfMemory,
    DatabaseOpenFailed,
    PrepareFailed,
    ExecuteFailed,
    InsertFailed,
    FileReadFailed,
    InvalidMigration,
    AccessDenied,
    InvalidUtf8,
    PermissionDenied,
    SystemResources,
    Unexpected,
};

pub const Migration = struct {
    name: []const u8,
    sql: []const u8,
    
    pub fn deinit(self: *const Migration, allocator: std.mem.Allocator) void {
        allocator.free(self.name);
        allocator.free(self.sql);
    }
};

pub const Migrator = struct {
    db: *sqlite.sqlite3,
    migrations_dir: []const u8,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, db: *sqlite.sqlite3, migrations_dir: []const u8) Migrator {
        return .{
            .db = db,
            .migrations_dir = migrations_dir,
            .allocator = allocator,
        };
    }
    
    /// Run all pending migrations
    pub fn run(self: *Migrator) MigrationError!void {
        log.info("Starting database migrations...", .{});
        
        // 1. Ensure migrations table exists
        try self.createMigrationsTable();
        
        // 2. Get applied migrations (list of owned hash slices)
        var applied = try self.getAppliedMigrations();
        defer {
            for (applied.items) |h| self.allocator.free(h);
            applied.deinit(self.allocator);
        }
        
        // 3. Read migration files
        const migrations = try self.readMigrationFiles();
        defer {
            for (migrations) |m| {
                m.deinit(self.allocator);
            }
            self.allocator.free(migrations);
        }
        
        if (migrations.len == 0) {
            log.info("No migration files found", .{});
            return;
        }
        
        // 4. Filter and apply pending migrations
        var pending_count: usize = 0;
        for (migrations) |migration| {
            const already_applied = blk: {
                for (applied.items) |h| {
                    if (std.mem.eql(u8, h, migration.name)) break :blk true;
                }
                break :blk false;
            };
            if (already_applied) {
                log.debug("Skipping already applied migration: {s}", .{migration.name});
                continue;
            }
            
            pending_count += 1;
            log.info("Applying migration: {s}", .{migration.name});
            try self.applyMigration(migration);
            try self.recordMigration(migration.name);
        }
        
        if (pending_count == 0) {
            log.info("All migrations are up to date", .{});
        } else {
            log.info("Applied {d} migration(s)", .{pending_count});
        }
    }
    
    fn createMigrationsTable(self: *Migrator) MigrationError!void {
        const sql =
            \\CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\    hash TEXT NOT NULL,
            \\    created_at INTEGER DEFAULT (unixepoch())
            \\)
        ;
        
        var err_msg: [*c][*c]u8 = null;
        const rc = sqlite.sqlite3_exec(self.db, sql.ptr, null, null, @ptrCast(&err_msg));
        
        if (rc != sqlite.SQLITE_OK) {
            const err = if (err_msg != null) blk: {
                const msg = err_msg.?;
                const err_str = std.mem.span(@as([*c]const u8, @ptrCast(msg)));
                sqlite.sqlite3_free(@as(?*anyopaque, @ptrCast(msg)));
                break :blk err_str;
            } else "Unknown error";
            
            log.err("Failed to create migrations table: {s}", .{err});
            return MigrationError.ExecuteFailed;
        }
    }
    
    fn getAppliedMigrations(self: *Migrator) MigrationError!std.ArrayList([]const u8) {
        var list = std.ArrayList([]const u8).initCapacity(self.allocator, 0) catch return MigrationError.OutOfMemory;
        errdefer {
            for (list.items) |h| self.allocator.free(h);
            list.deinit(self.allocator);
        }
        
        const sql = "SELECT hash FROM __drizzle_migrations ORDER BY created_at";
        var stmt: ?*sqlite.sqlite3_stmt = null;
        
        const rc = sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null);
        if (rc != sqlite.SQLITE_OK) {
            log.err("Failed to prepare query: {s}", .{sqlite.sqlite3_errmsg(self.db)});
            return MigrationError.PrepareFailed;
        }
        defer _ = sqlite.sqlite3_finalize(stmt);
        
        while (true) {
            const step_rc = sqlite.sqlite3_step(stmt);
            if (step_rc == sqlite.SQLITE_DONE) break;
            if (step_rc != sqlite.SQLITE_ROW) {
                log.err("Failed to step query: {s}", .{sqlite.sqlite3_errmsg(self.db)});
                return MigrationError.ExecuteFailed;
            }
            
            const hash_text = sqlite.sqlite3_column_text(stmt, 0);
            const hash_len_bytes = sqlite.sqlite3_column_bytes(stmt, 0);
            const hash_len: usize = @intCast(hash_len_bytes);
            const hash = try self.allocator.dupe(u8, hash_text[0..hash_len]);
            
            try list.append(self.allocator, hash);
        }
        
        return list;
    }
    
    fn readMigrationFiles(self: *Migrator) MigrationError![]Migration {
        var migrations = std.ArrayList(Migration).initCapacity(self.allocator, 10) catch {
            return MigrationError.DatabaseOpenFailed;
        };
        errdefer {
            for (migrations.items) |m| {
                m.deinit(self.allocator);
            }
            migrations.deinit(self.allocator);
        }
        
        // Open migrations directory
        const cwd = std.fs.cwd();
        var dir = cwd.openDir(self.migrations_dir, .{ .iterate = true }) catch |err| {
            log.err("Failed to open migrations directory '{s}': {any}", .{ self.migrations_dir, err });
            return MigrationError.FileReadFailed;
        };
        defer dir.close();
        
        var iterator = dir.iterate();
        while (try iterator.next()) |entry| {
            // Skip non-SQL files and meta directory
            if (!std.mem.endsWith(u8, entry.name, ".sql")) continue;
            if (std.mem.startsWith(u8, entry.name, "meta")) continue;
            
            // Read migration file
            const file = dir.openFile(entry.name, .{}) catch |err| {
                log.warn("Failed to open migration file '{s}': {any}", .{ entry.name, err });
                continue;
            };
            defer file.close();
            
            const content = file.readToEndAlloc(self.allocator, std.math.maxInt(usize)) catch |err| {
                log.warn("Failed to read migration file '{s}': {any}", .{ entry.name, err });
                continue;
            };
            
            // Extract migration name (remove .sql extension)
            const name = try self.allocator.dupe(u8, entry.name[0..(entry.name.len - 4)]);
            
            try migrations.append(self.allocator, Migration{
                .name = name,
                .sql = content,
            });
        }
        
        // Sort migrations by name (which includes timestamp prefix like "0000_...")
        std.mem.sort(Migration, migrations.items, {}, struct {
            fn lessThan(_: void, a: Migration, b: Migration) bool {
                return std.mem.order(u8, a.name, b.name) == .lt;
            }
        }.lessThan);
        
        return try migrations.toOwnedSlice(self.allocator);
    }
    
    fn applyMigration(self: *Migrator, migration: Migration) MigrationError!void {
        // Split by statement-breakpoint (Drizzle format)
        var statements = std.mem.splitSequence(u8, migration.sql, "--> statement-breakpoint");
        
        while (statements.next()) |stmt| {
            const cleaned = std.mem.trim(u8, stmt, " \n\r\t");
            
            // Skip empty statements and comments
            if (cleaned.len == 0) continue;
            if (std.mem.startsWith(u8, cleaned, "--")) continue;
            
            // Copy statement: null-terminate for sqlite3_exec, and convert MySQL backticks to SQLite double quotes
            var sql_buf = try self.allocator.alloc(u8, cleaned.len + 1);
            defer self.allocator.free(sql_buf);
            @memcpy(sql_buf[0..cleaned.len], cleaned);
            sql_buf[cleaned.len] = 0;
            for (sql_buf[0..cleaned.len]) |*c| {
                if (c.* == '`') c.* = '"';
            }
            
            var err_msg: [*c][*c]u8 = null;
            const rc = sqlite.sqlite3_exec(self.db, sql_buf.ptr, null, null, @ptrCast(&err_msg));
            
            if (rc != sqlite.SQLITE_OK) {
                const err = if (err_msg != null) blk: {
                    const msg = err_msg.?;
                    const err_str = std.mem.span(@as([*c]const u8, @ptrCast(msg)));
                    sqlite.sqlite3_free(@as(?*anyopaque, @ptrCast(msg)));
                    break :blk err_str;
                } else "Unknown error";
                
                // Some statements might fail if already applied (e.g., CREATE TABLE IF NOT EXISTS)
                // or if object doesn't exist (e.g., DROP TABLE when table was never created)
                // Skip errors that indicate object already exists or change not applicable
                const skip = std.mem.indexOf(u8, err, "already exists") != null or
                    std.mem.indexOf(u8, err, "duplicate") != null or
                    std.mem.indexOf(u8, err, "UNIQUE constraint") != null or
                    std.mem.indexOf(u8, err, "no such table") != null or
                    std.mem.indexOf(u8, err, "no such column") != null or
                    std.mem.indexOf(u8, err, "column name") != null; // "duplicate column name" or "no such column name"
                if (skip)
                {
                    log.debug("Skipping already-applied or non-applicable statement (expected): {s}", .{err});
                    continue;
                }
                
                log.err("Migration '{s}' failed on statement:\n{s}\nError: {s}", .{
                    migration.name,
                    cleaned,
                    err,
                });
                return MigrationError.ExecuteFailed;
            }
            
            if (err_msg) |msg| sqlite.sqlite3_free(@as(?*anyopaque, @ptrCast(msg)));
        }
    }
    
    fn recordMigration(self: *Migrator, name: []const u8) MigrationError!void {
        const sql = "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, unixepoch())";
        var stmt: ?*sqlite.sqlite3_stmt = null;
        
        const rc = sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null);
        if (rc != sqlite.SQLITE_OK) {
            log.err("Failed to prepare migration record query: {s}", .{sqlite.sqlite3_errmsg(self.db)});
            return MigrationError.PrepareFailed;
        }
        defer _ = sqlite.sqlite3_finalize(stmt);
        
        // Bind migration name as hash
        const name_z = try std.fmt.allocPrint(self.allocator, "{s}", .{name});
        defer self.allocator.free(name_z);
        
        _ = sqlite.sqlite3_bind_text(stmt, 1, name_z.ptr, @intCast(name_z.len), sqlite.SQLITE_TRANSIENT);
        
        const step_rc = sqlite.sqlite3_step(stmt);
        if (step_rc != sqlite.SQLITE_DONE) {
            log.err("Failed to record migration: {s}", .{sqlite.sqlite3_errmsg(self.db)});
            return MigrationError.InsertFailed;
        }
    }
};

/// Convenience function to run migrations on a database
pub fn runMigrations(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    migrations_dir: []const u8,
) MigrationError!void {
    var migrator = Migrator.init(allocator, db, migrations_dir);
    try migrator.run();
}

// ============================================================================
// Example Usage
// ============================================================================

test "migration system" {
    // This would be used in your main server initialization:
    // 
    // const db = try openDatabase("sqlite.db");
    // defer sqlite.sqlite3_close(db);
    // 
    // try runMigrations(allocator, db, "drizzle");
}
