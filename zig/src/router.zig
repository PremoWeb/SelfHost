// Request routing and handling
// Maps HTTP routes to handler functions

const std = @import("std");
const zap = @import("zap");
const sqlite = @import("db/sqlite.zig").sqlite;
const database = @import("db/database.zig");
const api = @import("api.zig");
const websocket = @import("websocket.zig");
const agent_ws = @import("agent_ws.zig");

const log = std.log.scoped(.router);

// Global state (in real implementation, use proper context passing)
var global_db: ?*database.Database = null;
var global_allocator: ?std.mem.Allocator = null;
var global_static_dir: ?[]const u8 = null;

pub fn setContext(db: *database.Database, allocator: std.mem.Allocator) void {
    global_db = db;
    global_allocator = allocator;
}

pub fn setStaticDir(allocator: std.mem.Allocator, dir: []const u8) void {
    if (global_static_dir) |prev| {
        if (global_allocator) |a| a.free(prev);
    }
    global_static_dir = null;
    global_static_dir = allocator.dupe(u8, dir) catch null;
}

/// Free global_static_dir; call on shutdown so GPA reports no leak.
pub fn deinit() void {
    if (global_static_dir) |prev| {
        if (global_allocator) |a| a.free(prev);
        global_static_dir = null;
    }
}

pub fn getDatabase() ?*sqlite.sqlite3 {
    return if (global_db) |db| db.getConnection() else null;
}

pub fn getAllocator() ?std.mem.Allocator {
    return global_allocator;
}

pub fn getStaticDir() ?[]const u8 {
    return global_static_dir;
}

// Main API Endpoint - handles all HTTP requests
pub const ApiEndpoint = struct {
    path: []const u8 = "/",
    error_strategy: zap.Endpoint.ErrorStrategy = .log_to_console,

    pub fn get(self: *ApiEndpoint, r: zap.Request) !void {
        _ = self;
        try handleRequest(r);
    }

    pub fn post(self: *ApiEndpoint, r: zap.Request) !void {
        _ = self;
        try handleRequest(r);
    }

    pub fn put(self: *ApiEndpoint, r: zap.Request) !void {
        _ = self;
        try handleRequest(r);
    }

    pub fn patch(self: *ApiEndpoint, r: zap.Request) !void {
        _ = self;
        try handleRequest(r);
    }

    pub fn delete(self: *ApiEndpoint, r: zap.Request) !void {
        _ = self;
        try handleRequest(r);
    }
};

fn handleRequest(r: zap.Request) !void {
    const path = r.path orelse {
        r.setStatus(.bad_request);
        try r.sendBody("Missing path");
        return;
    };

    const method = r.methodAsEnum();

    log.debug("{s} {s}", .{ @tagName(method), path });

    // Health check (no auth required)
    if (std.mem.eql(u8, path, "/api/health") or std.mem.eql(u8, path, "/health")) {
        api.handleHealth(r);
        return;
    }

    // Agent WebSocket upgrade (requires agent headers)
    if (std.mem.eql(u8, path, "/api/agent")) {
        api.handleAgentWebSocketUpgrade(r);
        return;
    }

    // Auth endpoints (no auth required for login/register)
    if (std.mem.startsWith(u8, path, "/api/auth/")) {
        api.handleAuthRequest(r, path, method);
        return;
    }

    // Dev tunnel (no auth; only when SELFHOST_DEV=1)
    if (std.mem.eql(u8, path, "/api/dev/tunnel")) {
        api.handleDevTunnel(r, method);
        return;
    }

    // Dev install-agent log (no auth; only when SELFHOST_DEV=1)
    if (std.mem.eql(u8, path, "/api/dev/install-agent-log")) {
        api.handleDevInstallAgentLog(r, method);
        return;
    }

    // API routes (require authentication)
    if (std.mem.startsWith(u8, path, "/api/")) {
        api.handleApiRequest(r, path, method);
        return;
    }

    // Static file serving (Svelte SPA build) (SPA build from STATIC_DIR, e.g. build/)
    if (getStaticDir()) |static_dir| {
        api.tryServeStatic(r, path, static_dir);
        return;
    }

    // Default: serve index.html or API placeholder for SPA routing
    api.handleSpaFallback(r);
}

// WebSocket handlers
pub fn handleWebSocketOpen(context: ?*websocket.WsContext, handle: zap.WebSockets.WsHandle) anyerror!void {
    log.info("WebSocket connection opened", .{});

    // Store connection in connection pool
    const allocator = getAllocator() orelse return;

    // Get server_id from context if set during upgrade
    var server_id: ?[]const u8 = null;
    if (context) |ws_ctx| {
        server_id = allocator.dupe(u8, ws_ctx.server_id) catch null;
    }

    const conn = allocator.create(websocket.Connection) catch {
        log.err("Failed to allocate connection", .{});
        return;
    };

    // Generate ID from handle (UUID is an isize)
    const uuid = zap.fio.websocket_uuid(handle);
    const id = std.fmt.allocPrint(allocator, "ws-{d}", .{uuid}) catch {
        allocator.destroy(conn);
        return;
    };

    conn.* = websocket.Connection{
        .ws = handle,
        .id = id,
        .uuid = uuid,
        .server_id = server_id,
        .allocator = allocator,
    };

    websocket.addConnection(conn) catch |err| {
        log.err("Failed to add connection: {any}", .{err});
        conn.deinit();
        allocator.destroy(conn);
    };
}

pub fn handleWebSocketReady(context: ?*websocket.WsContext, handle: zap.WebSockets.WsHandle) anyerror!void {
    _ = context;
    _ = handle;
}

pub fn handleWebSocketMessage(context: ?*websocket.WsContext, handle: zap.WebSockets.WsHandle, message: []const u8, is_text: bool) anyerror!void {
    _ = context;
    _ = is_text;

    log.debug("WebSocket message: {s}", .{message});

    const conn = websocket.getConnectionByHandle(handle);
    if (conn) |c| {
        if (c.server_id != null) {
            agent_ws.handleMessage(handle, message);
            return;
        }
    }

    // Default: echo back using Zap's write function
    // We can use a generic handler here
    zap.WebSockets.Handler(void).write(handle, message, true) catch |err| {
        log.err("Failed to send WebSocket message: {any}", .{err});
    };
}

pub fn handleWebSocketClose(context: ?*websocket.WsContext, uuid: isize) anyerror!void {
    log.info("WebSocket connection closed: uuid={d}", .{uuid});

    // Remove from connection pool
    websocket.removeConnectionByUuid(uuid);

    // Free context if set
    if (context) |ws_ctx| {
        ws_ctx.deinit();
    }
}
