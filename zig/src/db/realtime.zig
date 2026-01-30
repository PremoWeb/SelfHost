// SQLite Update Hooks for Real-time Notifications
// Registers callbacks with SQLite to detect database changes and broadcast via WebSocket

const std = @import("std");
const sqlite = @import("sqlite.zig").sqlite;
const websocket = @import("../websocket.zig");

const log = std.log.scoped(.realtime);

pub const UpdateEvent = struct {
    operation: Operation,
    table: []const u8,
    rowid: i64,

    pub const Operation = enum {
        insert,
        update,
        delete,
    };
};

// Global event channel for broadcasting updates
// TODO: Replace with proper channel implementation for Zig 0.15.2
// For now, using a simple flag to disable realtime features
var allocator_global: ?std.mem.Allocator = null;
var realtime_enabled: bool = false;

/// Initialize real-time update hooks
pub fn init(alloc: std.mem.Allocator, db: *sqlite.sqlite3) !void {
    allocator_global = alloc;
    // TODO: Implement proper channel for Zig 0.15.2
    // For now, realtime is disabled until we implement the channel
    realtime_enabled = false;

    // Register update hook callback
    _ = sqlite.sqlite3_update_hook(
        db,
        updateHookCallback,
        null, // user data
    );

    log.info("SQLite update hooks registered", .{});

    // Start background thread to process events
    const thread = try std.Thread.spawn(.{}, processEvents, .{});
    thread.detach();
}

/// SQLite update hook callback
/// Called by SQLite whenever a row is inserted, updated, or deleted
fn updateHookCallback(
    user_data: ?*anyopaque,
    operation: c_int,
    db_name: [*c]const u8,
    table_name: [*c]const u8,
    rowid: i64,
) callconv(.c) void {
    _ = user_data;
    _ = db_name;

    if (!realtime_enabled) return;

    const op: UpdateEvent.Operation = switch (operation) {
        sqlite.SQLITE_INSERT => .insert,
        sqlite.SQLITE_UPDATE => .update,
        sqlite.SQLITE_DELETE => .delete,
        else => return,
    };

    const table = std.mem.sliceTo(table_name, 0);
    const table_owned = allocator_global.?.dupe(u8, table) catch return;

    const event = UpdateEvent{
        .operation = op,
        .table = table_owned,
        .rowid = rowid,
    };

    // TODO: Send to channel when implemented
    _ = event;
    allocator_global.?.free(table_owned);
}

/// Background thread to process update events and broadcast via WebSocket
/// TODO: Re-implement when channel is available
fn processEvents() void {
    // Disabled until channel is implemented
    _ = realtime_enabled;
}

/// Broadcast update event to all WebSocket connections
fn broadcastUpdate(event: UpdateEvent) !void {
    // Create JSON message
    const op_str = switch (event.operation) {
        .insert => "insert",
        .update => "update",
        .delete => "delete",
    };

    // Format JSON message
    const json = try std.fmt.allocPrint(
        allocator_global.?,
        \\{{"type":"db_update","operation":"{s}","table":"{s}","rowid":{d}}}
    ,
        .{ op_str, event.table, event.rowid },
    );
    defer allocator_global.?.free(json);

    // Broadcast via WebSocket pool
    try websocket.broadcast(json);

    log.debug("Broadcasted update: {s} on {s} (rowid: {d})", .{ op_str, event.table, event.rowid });
}

/// Deinitialize real-time hooks
pub fn deinit() void {
    realtime_enabled = false;
    allocator_global = null;
}
