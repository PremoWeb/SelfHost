// CLI: run agent diagnostics for a server by name or id (SSH + remote script).
// Usage: selfhost-server diagnose homelab
// Requires: DATABASE_URL (or default sqlite.db), same DB that has the server and its private key.

const std = @import("std");
const sqlite = @import("db/sqlite.zig").sqlite;
const servers_service = @import("services/servers.zig");
const security_service = @import("services/security.zig");
const agent_install = @import("agent_install.zig");

const log = std.log.scoped(.cli_diagnose);

/// Run diagnose for server name or id; print output to stdout.
pub fn run(allocator: std.mem.Allocator, db: *sqlite.sqlite3, name_or_id: []const u8) !void {
    var servers = try servers_service.getServersByTeam(allocator, db, null);
    defer {
        for (servers.items) |*s| {
            s.deinit(allocator);
        }
        servers.deinit(allocator);
    }

    var server: ?*servers_service.Server = null;
    for (servers.items) |*s| {
        if (std.mem.eql(u8, s.id, name_or_id)) {
            server = s;
            break;
        }
        if (s.name.len == name_or_id.len and std.ascii.eqlIgnoreCase(s.name, name_or_id)) {
            server = s;
            break;
        }
    }
    const s = server orelse {
        std.log.err("Server '{s}' not found", .{name_or_id});
        return error.ServerNotFound;
    };

    if (s.private_key_id == null) {
        std.log.err("Server '{s}' has no private key attached", .{s.name});
        return error.NoPrivateKey;
    }

    var pk = security_service.getPrivateKeyById(allocator, db, s.private_key_id.?, null, true) catch |err| {
        log.err("getPrivateKeyById: {any}", .{err});
        return err;
    };
    defer if (pk) |*key_ptr| key_ptr.deinit(allocator);
    const key = pk orelse {
        std.log.err("Private key not found for server '{s}'", .{s.name});
        return error.KeyNotFound;
    };

    log.info("Running diagnostics on {s} ({s})...", .{ s.name, s.id });
    const output = agent_install.runDiagnoseAgent(allocator, s, key.private_key) catch |err| {
        log.err("runDiagnoseAgent: {any}", .{err});
        return err;
    };
    defer allocator.free(output);

    std.debug.print("{s}", .{output});
}
