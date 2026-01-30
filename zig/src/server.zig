// HTTP/WebSocket Server using Zap
// Handles routing, middleware, and WebSocket connections

const std = @import("std");
const zap = @import("zap");
const database = @import("db/database.zig");
const router = @import("router.zig");

const log = std.log.scoped(.server);

pub const Server = struct {
    allocator: std.mem.Allocator,
    db: *database.Database,
    endpoint: router.ApiEndpoint,
    listener: zap.HttpListener,
    port: u16,

    pub fn init(allocator: std.mem.Allocator, db: *database.Database, port: u16) Server {
        return .{
            .allocator = allocator,
            .db = db,
            .endpoint = router.ApiEndpoint{},
            .listener = undefined,
            .port = port,
        };
    }

    pub fn start(self: *Server) !void {
        log.info("Starting HTTP server on port {d}...", .{self.port});

        // Initialize raw HTTP listener
        self.listener = zap.HttpListener.init(
            .{
                .port = self.port,
                .on_request = onRequest,
                .on_upgrade = onUpgrade,
                .log = true,
                .max_clients = 100000,
                .max_body_size = 100 * 1024 * 1024, // 100MB
            },
        );

        log.info("Server listening on http://localhost:{d}", .{self.port});

        // Register the listener with facil.io (does not block)
        try self.listener.listen();

        // Start the event loop - this blocks until zap.stop() is called
        zap.start(.{
            .threads = 2,
            .workers = 0,
        });
    }

    pub fn deinit(self: *Server) void {
        // self.listener.deinit(); // HttpListener does not have deinit
        _ = self;
    }
};

fn onUpgrade(r: zap.Request, target_protocol: []const u8) !void {
    _ = target_protocol;
    if (r.path) |p| {
        log.info("ZAP: onUpgrade {s}", .{p});
    }
    try onRequest(r);
}

fn onRequest(r: zap.Request) !void {
    const method = if (r.method) |m| m else "GET";
    const path = if (r.path) |p| p else "NULL";
    log.info("ZAP: onRequest {s} {s}", .{ method, path });

    var ep = router.ApiEndpoint{};

    if (std.mem.eql(u8, method, "GET")) {
        try ep.get(r);
    } else if (std.mem.eql(u8, method, "POST")) {
        try ep.post(r);
    } else if (std.mem.eql(u8, method, "PUT")) {
        try ep.put(r);
    } else if (std.mem.eql(u8, method, "DELETE")) {
        try ep.delete(r);
    } else if (std.mem.eql(u8, method, "PATCH")) {
        try ep.patch(r);
    } else {
        try ep.get(r);
    }
}
