// Main entry point for Zig server
// Initializes database, runs migrations, and starts HTTP/WebSocket server
// CLI: selfhost-server diagnose homelab  — SSH to server and run agent diagnostics

const std = @import("std");
const database = @import("db/database.zig");
const server = @import("server.zig");
const router = @import("router.zig");
const realtime = @import("db/realtime.zig");
const websocket = @import("websocket.zig");
const dev_tunnel = @import("dev_tunnel.zig");
const api = @import("api.zig");
const cli_diagnose = @import("cli_diagnose.zig");
const logs_service = @import("services/logs.zig");

const log = std.log.scoped(.main);

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = std.process.argsAlloc(allocator) catch return;
    defer std.process.argsFree(allocator, args);
    if (args.len >= 2 and std.mem.eql(u8, args[1], "diagnose")) {
        const name_or_id: []const u8 = if (args.len >= 3) args[2] else "homelab";
        var db = try database.openFromEnv(allocator);
        defer db.deinit();
        const migrations_dir = std.process.getEnvVarOwned(allocator, "DRIZZLE_DIR") catch |err| blk: {
            if (err != error.EnvironmentVariableNotFound) return err;
            const dir = std.fs.cwd().openDir("drizzle", .{}) catch null;
            if (dir) |d| {
                @constCast(&d).close();
                break :blk try allocator.dupe(u8, "drizzle");
            }
            break :blk try allocator.dupe(u8, "../drizzle");
        };
        defer allocator.free(migrations_dir);
        try db.initialize(migrations_dir);
        cli_diagnose.run(allocator, db.getConnection(), name_or_id) catch |err| {
            log.err("diagnose: {any}", .{err});
            std.process.exit(1);
        };
        return;
    }

    log.info("Starting selfhost server...", .{});

    // Open database
    var db = try database.openFromEnv(allocator);
    defer db.deinit();

    // Initialize database and run migrations
    // Drizzle folder is at project root; when run from zig/ we need ../drizzle
    log.info("Initializing database...", .{});
    const migrations_dir = std.process.getEnvVarOwned(allocator, "DRIZZLE_DIR") catch |err| blk: {
        if (err != error.EnvironmentVariableNotFound) return err;
        // Try zig/drizzle first, then ../drizzle (when cwd is zig/)
        const dir = std.fs.cwd().openDir("drizzle", .{}) catch null;
        if (dir) |d| {
            @constCast(&d).close();
            break :blk try allocator.dupe(u8, "drizzle");
        }
        break :blk try allocator.dupe(u8, "../drizzle");
    };
    defer allocator.free(migrations_dir);
    try db.initialize(migrations_dir);
    log.info("Database initialized successfully", .{});

    // Open logging database (separate from main DB)
    log.info("Opening logging database...", .{});
    const logs_db_path = std.process.getEnvVarOwned(allocator, "LOGGING_DATABASE_URL") catch |err| blk: {
        if (err != error.EnvironmentVariableNotFound) return err;
        // Default: sqlite-logs.db in same directory as main DB
        // Resolve relative to DATABASE_URL directory if set
        const main_db_url = std.process.getEnvVarOwned(allocator, "DATABASE_URL") catch |e| {
            if (e != error.EnvironmentVariableNotFound) return e;
            break :blk try allocator.dupe(u8, "sqlite-logs.db");
        };
        defer allocator.free(main_db_url);
        // Strip file: prefix
        const main_path = if (std.mem.startsWith(u8, main_db_url, "file:")) main_db_url[5..] else main_db_url;
        // Find directory part
        if (std.mem.lastIndexOfScalar(u8, main_path, '/')) |last_slash| {
            break :blk try std.fmt.allocPrint(allocator, "{s}/sqlite-logs.db", .{main_path[0..last_slash]});
        }
        break :blk try allocator.dupe(u8, "sqlite-logs.db");
    };
    defer allocator.free(logs_db_path);
    // Strip file: prefix if present
    const effective_logs_path = if (std.mem.startsWith(u8, logs_db_path, "file:"))
        logs_db_path[5..]
    else
        logs_db_path;
    var logs_db = try database.Database.init(allocator, effective_logs_path);
    defer logs_db.deinit();
    logs_service.initializeLogsDb(logs_db.getConnection(), allocator);

    // Set up SQLite update hooks for real-time notifications
    log.info("Setting up real-time update hooks...", .{});
    try realtime.init(allocator, db.getConnection());
    defer realtime.deinit();

    // Initialize WebSocket connection pool
    log.info("Initializing WebSocket connection pool...", .{});
    try websocket.initPool(allocator);
    defer websocket.deinitPool();

    // Set router context
    router.setContext(&db, allocator);
    router.setLogsDb(&logs_db);

    // Initialize API settings
    api.init(allocator);

    // Static files: co-located zig/frontend/ (HTML + assets) or Svelte build dirs.
    const static_dir = std.process.getEnvVarOwned(allocator, "STATIC_DIR") catch |err| blk: {
        if (err != error.EnvironmentVariableNotFound) return err;
        // Prefer co-located frontend/ (zig/frontend) — HTML served by Zig
        var d = std.fs.cwd().openDir("frontend", .{}) catch null;
        if (d) |*dir| {
            dir.close();
            break :blk try allocator.dupe(u8, "frontend");
        }
        d = std.fs.cwd().openDir("zig/frontend", .{}) catch null;
        if (d) |*dir| {
            dir.close();
            break :blk try allocator.dupe(u8, "zig/frontend");
        }
        d = std.fs.cwd().openDir("frontend/build", .{}) catch null;
        if (d) |*dir| {
            dir.close();
            break :blk try allocator.dupe(u8, "frontend/build");
        }
        d = std.fs.cwd().openDir("../frontend/build", .{}) catch null;
        if (d) |*dir| {
            dir.close();
            break :blk try allocator.dupe(u8, "../frontend/build");
        }
        d = std.fs.cwd().openDir("build", .{}) catch null;
        if (d) |*dir| {
            dir.close();
            break :blk try allocator.dupe(u8, "build");
        }
        break :blk try allocator.dupe(u8, "frontend");
    };
    defer allocator.free(static_dir);
    router.setStaticDir(allocator, static_dir);
    log.info("Serving static files from {s}", .{static_dir});

    // Get port from environment or use default
    const port: u16 = if (std.process.getEnvVarOwned(allocator, "PORT")) |port_str| blk: {
        defer allocator.free(port_str);
        break :blk std.fmt.parseInt(u16, port_str, 10) catch 3000;
    } else |_| 3000;

    // Initialize and start server
    var srv = server.Server.init(allocator, &db, port);
    defer srv.deinit();

    log.info("Starting HTTP/WebSocket server on port {d}...", .{port});

    // Start server (blocks)
    try srv.start();

    // Clean up dev tunnel (kill cloudflared, free URL)
    dev_tunnel.clearUrl(allocator);

    // Clean up router-owned allocations so GPA reports no leak on exit
    router.deinit();

    // TODO: Set up SQLite update hooks for real-time notifications
    // TODO: Initialize worker pools for SSH, cloudflared, etc.
}
