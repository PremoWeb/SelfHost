// SQLite Database Connection Management
// Provides a simple wrapper around SQLite for the Zig port

const std = @import("std");
const sqlite = @import("sqlite.zig").sqlite;
const migrate = @import("migrate.zig");

const log = std.log.scoped(.database);

pub const DatabaseError = error{
    OpenFailed,
    CloseFailed,
    MigrationFailed,
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

pub const Database = struct {
    db: *sqlite.sqlite3,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, path: []const u8) DatabaseError!Database {
        var db: ?*sqlite.sqlite3 = null;
        
        const path_z = try std.fmt.allocPrint(allocator, "{s}\x00", .{path});
        defer allocator.free(path_z);
        
        const rc = sqlite.sqlite3_open(path_z.ptr, &db);
        if (rc != sqlite.SQLITE_OK) {
            const err_msg = if (db) |d| sqlite.sqlite3_errmsg(d) else @as([*c]const u8, "Unknown error");
            log.err("Failed to open database '{s}': {s}", .{ path, err_msg });
            if (db) |d| _ = sqlite.sqlite3_close(d);
            return DatabaseError.OpenFailed;
        }
        
        log.info("Opened database: {s}", .{path});
        
        return Database{
            .db = db.?,
            .allocator = allocator,
        };
    }
    
    pub fn deinit(self: *Database) void {
        const rc = sqlite.sqlite3_close(self.db);
        if (rc != sqlite.SQLITE_OK) {
            log.err("Error closing database: {s}", .{sqlite.sqlite3_errmsg(self.db)});
        } else {
            log.debug("Database closed", .{});
        }
    }
    
    /// Initialize database and run migrations
    pub fn initialize(self: *Database, migrations_dir: []const u8) DatabaseError!void {
        log.info("Initializing database with migrations from: {s}", .{migrations_dir});
        // Now that we use shared sqlite module, types match directly
        try migrate.runMigrations(self.allocator, self.db, migrations_dir);
    }
    
    /// Get the underlying SQLite connection
    pub fn getConnection(self: *const Database) *sqlite.sqlite3 {
        return self.db;
    }
};

/// Open database from environment variable or default path
pub fn openFromEnv(allocator: std.mem.Allocator) DatabaseError!Database {
    // Try to get DATABASE_URL from environment
    // For now, default to sqlite.db (can be enhanced to read env vars)
    const path = std.process.getEnvVarOwned(allocator, "DATABASE_URL") catch |err| {
        if (err == error.EnvironmentVariableNotFound) {
            log.info("DATABASE_URL not set, using default: sqlite.db", .{});
            return try Database.init(allocator, "sqlite.db");
        }
        return switch (err) {
            error.EnvironmentVariableNotFound => DatabaseError.OpenFailed,
            error.InvalidWtf8 => DatabaseError.OpenFailed,
            error.OutOfMemory => DatabaseError.OpenFailed,
        };
    };
    defer allocator.free(path);
    
    // Handle libsql:// URLs (from current setup) - extract file path
    if (std.mem.startsWith(u8, path, "file:")) {
        const file_path = path[5..]; // Skip "file:" prefix
        return try Database.init(allocator, file_path);
    }
    
    // Assume it's a file path
    return try Database.init(allocator, path);
}
