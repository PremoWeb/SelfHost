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
// Event queue for buffering updates
var event_queue: std.ArrayList(UpdateEvent) = undefined;
var queue_mutex: std.Thread.Mutex = .{};
var queue_cond: std.Thread.Condition = .{};
var allocator_global: ?std.mem.Allocator = null;
var realtime_enabled: bool = false;
var update_thread: ?std.Thread = null;

/// Initialize real-time update hooks
pub fn init(alloc: std.mem.Allocator, db: *sqlite.sqlite3) !void {
    allocator_global = alloc;
    event_queue = std.ArrayList(UpdateEvent).initCapacity(alloc, 8) catch return;
    realtime_enabled = true;

    // Register update hook callback
    _ = sqlite.sqlite3_update_hook(
        db,
        updateHookCallback,
        null, // user data
    );

    log.info("SQLite update hooks registered", .{});

    // Start background thread to process events
    update_thread = try std.Thread.spawn(.{}, processEvents, .{});
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

    // Push to queue protected by mutex
    queue_mutex.lock();
    event_queue.append(allocator_global.?, event) catch |err| {
        log.err("Failed to append event to queue: {any}", .{err});
        allocator_global.?.free(table_owned);
    };
    queue_mutex.unlock();

    // Signal processing thread
    queue_cond.signal();
}

/// Background thread to process update events and broadcast via WebSocket
fn processEvents() void {
    if (!realtime_enabled) return;
    const alloc = allocator_global orelse return;

    var local_queue = std.ArrayList(UpdateEvent).initCapacity(alloc, 8) catch return;
    defer local_queue.deinit(alloc);

    while (realtime_enabled) {
        queue_mutex.lock();

        // Wait for events
        while (event_queue.items.len == 0 and realtime_enabled) {
            queue_cond.wait(&queue_mutex);
        }

        if (!realtime_enabled) {
            queue_mutex.unlock();
            break;
        }

        // Swap queues to minimize lock time
        local_queue.appendSlice(alloc, event_queue.items) catch {};
        event_queue.clearRetainingCapacity();

        queue_mutex.unlock();

        // Process events
        for (local_queue.items) |event| {
            // Only broadcast updates for relevant tables
            if (std.mem.eql(u8, event.table, "servers") or
                std.mem.eql(u8, event.table, "projects") or
                std.mem.eql(u8, event.table, "deployments"))
            {
                broadcastUpdate(event) catch |err| {
                    log.err("Failed to broadcast update: {any}", .{err});
                };
            }

            // Free memory (use local alloc; allocator_global may be null during shutdown)
            alloc.free(event.table);
        }
        local_queue.clearRetainingCapacity();
    }
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
    queue_mutex.lock();
    queue_cond.signal(); // Wake up thread to exit
    queue_mutex.unlock();

    // Join thread
    if (update_thread) |th| {
        th.join();
        update_thread = null;
    }

    if (allocator_global) |alloc| {
        queue_mutex.lock();
        // Free remaining items
        for (event_queue.items) |event| {
            alloc.free(event.table);
        }
        event_queue.deinit(alloc);
        queue_mutex.unlock();
        allocator_global = null;
    }
}
