const std = @import("std");
const zap = @import("zap");
const websocket = @import("websocket.zig");
const servers_service = @import("services/servers.zig");
const router = @import("router.zig");

const log = std.log.scoped(.agent_ws);

pub fn handleMessage(handle: zap.WebSockets.WsHandle, message: []const u8) void {
    const allocator = router.getAllocator() orelse return;
    const db = router.getDatabase() orelse return;

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, message, .{}) catch |err| {
        log.err("Failed to parse agent message: {any}", .{err});
        return;
    };
    defer parsed.deinit();

    const root = parsed.value;
    if (root != .object) return;

    const msg_type = root.object.get("type") orelse return;
    if (msg_type != .string) return;

    if (std.mem.eql(u8, msg_type.string, "hello")) {
        handleHello(handle, allocator, db, root.object.get("payload"));
    } else if (std.mem.eql(u8, msg_type.string, "health")) {
        handleHealth(handle, allocator, db, root.object.get("payload"));
    } else if (std.mem.eql(u8, msg_type.string, "execute_result")) {
        log.debug("Agent execute result received", .{});
    }
}

fn handleHello(handle: zap.WebSockets.WsHandle, allocator: std.mem.Allocator, db: *anyopaque, payload_opt: ?std.json.Value) void {
    const conn = websocket.getConnectionByHandle(handle) orelse return;
    const server_id = conn.server_id orelse return;

    if (payload_opt == null or payload_opt.? != .object) return;
    const payload = payload_opt.?.object;

    const hostname = if (payload.get("hostname")) |v| if (v == .string) v.string else null else null;
    const version = if (payload.get("version")) |v| if (v == .string) v.string else null else null;
    const checksum = if (payload.get("checksum")) |v| if (v == .string) v.string else null else null;
    const installed_at_val = if (payload.get("installedAt")) |v| if (v == .integer) v.integer else if (v == .float) @as(i64, @intFromFloat(v.float)) else null else null;

    log.info("Agent hello from server {s} (hostname: {?s}, version: {?s})", .{ server_id, hostname, version });

    servers_service.updateServerHealth(allocator, @ptrCast(db), server_id, .{
        .status = "online",
        .agent_version = version,
        .agent_checksum = checksum,
        .agent_installed_at = installed_at_val,
    }) catch |err| {
        log.err("Failed to update server status: {any}", .{err});
    };
}

fn handleHealth(handle: zap.WebSockets.WsHandle, allocator: std.mem.Allocator, db: *anyopaque, payload_opt: ?std.json.Value) void {
    const conn = websocket.getConnectionByHandle(handle) orelse return;
    const server_id = conn.server_id orelse return;

    if (payload_opt == null or payload_opt.? != .object) return;
    const payload = payload_opt.?.object;

    const cpu = if (payload.get("cpu")) |v| if (v == .float) v.float else if (v == .integer) @as(f64, @floatFromInt(v.integer)) else 0.0 else 0.0;
    const memory = if (payload.get("memory")) |v| if (v == .float) v.float else if (v == .integer) @as(f64, @floatFromInt(v.integer)) else 0.0 else 0.0;
    const disk = if (payload.get("disk")) |v| if (v == .integer) v.integer else if (v == .float) @as(i64, @intFromFloat(v.float)) else 0 else 0;
    const proxy_status = if (payload.get("proxyStatus")) |v| if (v == .string) v.string else null else null;

    log.debug("Agent health from server {s}: CPU={d:.2}, RAM={d:.0}%, Disk={d}%", .{ server_id, cpu, memory, disk });

    servers_service.updateServerHealth(allocator, @ptrCast(db), server_id, .{
        .status = "online",
        .cpu = @as(i64, @intFromFloat(cpu * 100.0)),
        .memory = @as(i64, @intFromFloat(memory)),
        .disk = disk,
        .proxy_status = proxy_status,
    }) catch |err| {
        log.err("Failed to update server health: {any}", .{err});
    };
}
