// Main entry point for Zig server
// Initializes database, runs migrations, and starts HTTP/WebSocket server

const std = @import("std");
const database = @import("db/database.zig");
const server = @import("server.zig");
const router = @import("router.zig");
const realtime = @import("db/realtime.zig");
const websocket = @import("websocket.zig");
const dev_tunnel = @import("dev_tunnel.zig");
const api = @import("api.zig");

const log = std.log.scoped(.main);

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

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
