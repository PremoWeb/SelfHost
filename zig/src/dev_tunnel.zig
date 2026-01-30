// Dev tunnel: spawn cloudflared and expose the public URL.
// Only active when SELFHOST_DEV=1. Used for "Develop with Magic Tunnel" and Sources public URL.

const std = @import("std");

const log = std.log.scoped(.dev_tunnel);

/// Dev mode: tunnel allowed in Debug builds, or when SELFHOST_DEV=1/true in Release.
pub fn isDevMode(allocator: std.mem.Allocator) bool {
    const builtin = @import("builtin");
    if (builtin.mode == .Debug) return true;
    const val = std.process.getEnvVarOwned(allocator, "SELFHOST_DEV") catch return false;
    defer allocator.free(val);
    const trimmed = std.mem.trim(u8, val, " \t");
    return std.mem.eql(u8, val, "1") or std.mem.eql(u8, trimmed, "true");
}

var tunnel_mutex: std.Thread.Mutex = .{};
var tunnel_url: ?[]const u8 = null;
var tunnel_child: ?*std.process.Child = null;

/// Return current tunnel URL if running. Caller does not own the slice.
pub fn getUrl() ?[]const u8 {
    tunnel_mutex.lock();
    defer tunnel_mutex.unlock();
    return tunnel_url;
}

/// Start cloudflared tunnel; blocks until URL is seen on stderr or timeout_ms. Returns owned URL on success.
pub fn start(allocator: std.mem.Allocator, timeout_ms: u32) ![]const u8 {
    tunnel_mutex.lock();
    defer tunnel_mutex.unlock();

    if (tunnel_url) |url| {
        return allocator.dupe(u8, url);
    }

    const target = std.process.getEnvVarOwned(allocator, "TUNNEL_TARGET_URL") catch blk: {
        break :blk allocator.dupe(u8, "http://localhost:5173") catch return error.OutOfMemory;
    };
    defer allocator.free(target);

    var child = allocator.create(std.process.Child) catch return error.OutOfMemory;
    errdefer allocator.destroy(child);

    child.* = std.process.Child.init(&.{ "cloudflared", "tunnel", "--url", target }, allocator);
    child.stdin_behavior = .Ignore;
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Pipe;

    child.spawn() catch |err| {
        log.err("Failed to spawn cloudflared: {any}", .{err});
        return err;
    };

    const stderr = child.stderr orelse {
        _ = child.kill() catch {};
        return error.NoStderr;
    };
    defer stderr.close();

    var buf: [4096]u8 = undefined;
    var total_len: usize = 0;
    const deadline = std.time.milliTimestamp() + @as(i64, @intCast(timeout_ms));

    while (std.time.milliTimestamp() < deadline) {
        var fds = [1]std.posix.pollfd{
            .{ .fd = stderr.handle, .events = std.posix.POLL.IN, .revents = 0 },
        };
        const timeout_ms_remaining = @min(500, @as(u32, @intCast(deadline - std.time.milliTimestamp())));
        _ = std.posix.poll(&fds, @intCast(timeout_ms_remaining)) catch {
            continue;
        };
        if (fds[0].revents & std.posix.POLL.IN == 0) {
            continue;
        }

        const n = stderr.read(buf[total_len..]) catch continue;
        if (n == 0) break;
        total_len += n;
        if (total_len >= buf.len) total_len = buf.len - 1;

        if (findTryCloudflareUrl(buf[0..total_len])) |url_slice| {
            const url = allocator.dupe(u8, url_slice) catch return error.OutOfMemory;
            tunnel_url = url;
            tunnel_child = child;
            return url;
        }
    }

    _ = child.kill() catch {};
    allocator.destroy(child);
    return error.TunnelTimeout;
}

/// Find https://xxx.trycloudflare.com in buffer. Returns slice into buffer.
fn findTryCloudflareUrl(buf: []const u8) ?[]const u8 {
    const prefix = "https://";
    const suffix = ".trycloudflare.com";
    var i: usize = 0;
    while (i + prefix.len + suffix.len <= buf.len) {
        if (std.mem.indexOf(u8, buf[i..], prefix)) |rel| {
            const idx = i + rel;
            const after = idx + prefix.len;
            var end = after;
            while (end < buf.len and (std.ascii.isAlphanumeric(buf[end]) or buf[end] == '-')) {
                end += 1;
            }
            if (end + suffix.len <= buf.len and std.mem.eql(u8, buf[end..][0..suffix.len], suffix)) {
                return buf[idx .. end + suffix.len];
            }
            i = after;
        } else break;
    }
    return null;
}

/// Clear stored URL (e.g. when child exits). Call when shutting down or restarting.
pub fn clearUrl(allocator: std.mem.Allocator) void {
    tunnel_mutex.lock();
    defer tunnel_mutex.unlock();
    if (tunnel_url) |url| {
        allocator.free(url);
        tunnel_url = null;
    }
    if (tunnel_child) |c| {
        _ = c.kill() catch {};
        allocator.destroy(c);
        tunnel_child = null;
    }
}
