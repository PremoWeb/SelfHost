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
var tunnel_restored = false; // Track if we've tried to restore from file

/// Try to restore tunnel from previous server instance
fn tryRestoreTunnel(allocator: std.mem.Allocator) void {
    if (tunnel_restored) return;
    tunnel_restored = true;

    const file = std.fs.openFileAbsolute("/tmp/selfhost-tunnel.txt", .{}) catch return;
    defer file.close();

    var buf: [512]u8 = undefined;
    const n = file.readAll(&buf) catch return;
    if (n == 0) return;

    var lines = std.mem.splitSequence(u8, buf[0..n], "\n");
    const pid_str = lines.next() orelse return;
    const url_str = lines.next() orelse return;

    const pid = std.fmt.parseInt(i32, pid_str, 10) catch return;

    // Check if process is still alive using kill(pid, 0)
    // Sending signal 0 checks for existence without sending a signal
    _ = std.posix.kill(pid, 0) catch |err| {
        if (err == error.ProcessNotFound) return; // Process dead
        return; // Other error (EPERM etc) - assume unusable
    };

    // If we get here, process exists
    tunnel_url = allocator.dupe(u8, url_str) catch return;
    log.info("Restored tunnel from previous instance: pid={d}, url={s}", .{ pid, url_str });
    // Note: we don't restore tunnel_child because we don't own the process
}

/// Return current tunnel URL if running. Caller does not own the slice.
pub fn getUrl(allocator: std.mem.Allocator) ?[]const u8 {
    tunnel_mutex.lock();
    defer tunnel_mutex.unlock();

    // Try to restore tunnel from previous instance on first call
    tryRestoreTunnel(allocator);

    // If we have a child, check if it's still running (non-blocking)
    // TEMPORARILY DISABLED to test if waitpid is causing issues
    // if (tunnel_child) |c| {
    //     if (c.id > 0) {
    //         const pid_result = std.posix.waitpid(c.id, std.posix.W.NOHANG);
    //         log.debug("Tunnel check: child.id={d}, waitpid.pid={d}", .{c.id, pid_result.pid});
    //
    //         // waitpid with NOHANG returns pid=0 if still running, pid>0 if exited
    //         if (pid_result.pid > 0) {
    //             // Process has exited, clear state
    //             log.info("Tunnel process {d} has exited, clearing state", .{c.id});
    //             if (tunnel_url) |url| {
    //                 allocator.free(url);
    //                 tunnel_url = null;
    //             }
    //             allocator.destroy(c);
    //             tunnel_child = null;
    //             return null;
    //         }
    //     }
    // }

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
        break :blk allocator.dupe(u8, "http://localhost:3000") catch return error.OutOfMemory;
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
    // Don't close stderr with defer - we need to keep it open for the child process

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
            // Don't close stderr - just stop reading from it
            // The child process will continue writing to it harmlessly
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
    _ = allocator; // We don't free memory to allow persistence
    tunnel_mutex.lock();
    defer tunnel_mutex.unlock();

    // Save tunnel info to file for persistence across restarts
    if (tunnel_child) |c| {
        if (tunnel_url) |url| {
            const file = std.fs.createFileAbsolute("/tmp/selfhost-tunnel.txt", .{}) catch |err| {
                log.err("Failed to save tunnel info: {any}", .{err});
                return;
            };
            defer file.close();

            var buf: [512]u8 = undefined;
            const content = std.fmt.bufPrint(&buf, "{d}\n{s}", .{ c.id, url }) catch return;
            file.writeAll(content) catch |err| {
                log.err("Failed to write tunnel info: {any}", .{err});
            };
            log.info("Saved tunnel info: pid={d}, url={s}", .{ c.id, url });
        }
    }

    // Don't kill the tunnel or free memory - let it persist
    // The next server instance will pick it up
}
