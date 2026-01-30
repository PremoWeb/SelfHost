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
    listener: zap.Endpoint.Listener,
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

        // Initialize endpoint listener
        self.listener = zap.Endpoint.Listener.init(
            self.allocator,
            .{
                .port = self.port,
                .on_request = null, // We use endpoints instead
                .log = true,
                .max_clients = 100000,
                .max_body_size = 100 * 1024 * 1024, // 100MB
            },
        );
        
        // Register the API endpoint
        // Listener.register expects a pointer to the endpoint
        try self.listener.register(&self.endpoint);
        
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
        self.listener.deinit();
    }
};
