// WebSocket Connection Pool and Broadcasting
// Manages active WebSocket connections and broadcasts messages to all clients

const std = @import("std");
const zap = @import("zap");

const log = std.log.scoped(.websocket);

pub const Connection = struct {
    ws: zap.WebSockets.WsHandle,
    id: []const u8,
    uuid: isize,
    server_id: ?[]const u8 = null,
    allocator: std.mem.Allocator,

    pub fn deinit(self: *Connection) void {
        self.allocator.free(self.id);
        if (self.server_id) |s| self.allocator.free(s);
    }
};

pub const WsContext = struct {
    server_id: []const u8,
    allocator: std.mem.Allocator,

    pub fn deinit(self: *WsContext) void {
        self.allocator.free(self.server_id);
        self.allocator.destroy(self);
    }
};

// Global connection pool
var connections: std.ArrayList(*Connection) = undefined;
var connections_mutex: std.Thread.Mutex = .{};
var pool_initialized: bool = false;
var global_allocator: ?std.mem.Allocator = null;

/// Initialize WebSocket connection pool
pub fn initPool(allocator: std.mem.Allocator) !void {
    global_allocator = allocator;
    connections = std.ArrayList(*Connection).initCapacity(allocator, 0) catch return;
    pool_initialized = true;
    log.info("WebSocket connection pool initialized", .{});
}

/// Add a connection to the pool
pub fn addConnection(conn: *Connection) !void {
    if (!pool_initialized) {
        return error.PoolNotInitialized;
    }
    
    connections_mutex.lock();
    defer connections_mutex.unlock();

    const allocator = global_allocator orelse return error.NoAllocator;
    try connections.append(allocator, conn);
    log.info("WebSocket connection added: {s} (total: {d})", .{ conn.id, connections.items.len });
}

/// Remove a connection from the pool
pub fn removeConnection(conn: *Connection) void {
    if (!pool_initialized) return;
    
    connections_mutex.lock();
    defer connections_mutex.unlock();
    
    for (connections.items, 0..) |c, i| {
        if (c.id.ptr == conn.id.ptr) {
            _ = connections.swapRemove(i);
            log.info("WebSocket connection removed: {s} (total: {d})", .{ conn.id, connections.items.len });
            return;
        }
    }
}

/// Broadcast a message to all connected WebSocket clients
pub fn broadcast(message: []const u8) !void {
    if (!pool_initialized) return;
    
    connections_mutex.lock();
    defer connections_mutex.unlock();
    
    var failed: usize = 0;
    for (connections.items) |conn| {
        zap.WebSockets.Handler(void).write(conn.ws, message, true) catch |err| {
            log.warn("Failed to send to connection {s}: {any}", .{ conn.id, err });
            failed += 1;
        };
    }
    
    if (failed > 0) {
        log.warn("Failed to send to {d} connection(s)", .{failed});
    } else {
        log.debug("Broadcasted to {d} connection(s)", .{connections.items.len});
    }
}

/// Get connection count
pub fn getConnectionCount() usize {
    if (!pool_initialized) return 0;
    
    connections_mutex.lock();
    defer connections_mutex.unlock();
    
    return connections.items.len;
}

/// Remove a connection from the pool by UUID
pub fn removeConnectionByUuid(uuid: isize) void {
    if (!pool_initialized) return;

    connections_mutex.lock();
    defer connections_mutex.unlock();

    for (connections.items, 0..) |c, i| {
        if (c.uuid == uuid) {
            const conn = connections.swapRemove(i);
            conn.deinit();
            conn.allocator.destroy(conn);
            log.info("WebSocket connection removed: {s} (total: {d})", .{ conn.id, connections.items.len });
            return;
        }
    }
}

/// Set the server ID for a connection
pub fn setConnectionServerId(handle: zap.WebSockets.WsHandle, server_id: []const u8) !void {
    if (!pool_initialized) return error.PoolNotInitialized;

    connections_mutex.lock();
    defer connections_mutex.unlock();

    const allocator = global_allocator orelse return error.NoAllocator;

    for (connections.items) |conn| {
        if (conn.ws == handle) {
            if (conn.server_id) |old| allocator.free(old);
            conn.server_id = try allocator.dupe(u8, server_id);
            return;
        }
    }
    return error.ConnectionNotFound;
}

/// Find a connection by handle
pub fn getConnectionByHandle(handle: zap.WebSockets.WsHandle) ?*Connection {
    if (!pool_initialized) return null;

    connections_mutex.lock();
    defer connections_mutex.unlock();

    for (connections.items) |conn| {
        if (conn.ws == handle) return conn;
    }
    return null;
}

/// Deinitialize connection pool
pub fn deinitPool() void {
    if (!pool_initialized) return;
    
    const allocator = global_allocator orelse return;
    
    connections_mutex.lock();
    defer connections_mutex.unlock();
    
    for (connections.items) |conn| {
        conn.deinit();
    }
    connections.deinit(allocator);
    pool_initialized = false;
    log.info("WebSocket connection pool deinitialized", .{});
}
