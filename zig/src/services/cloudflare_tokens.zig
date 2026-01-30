// Cloudflare Access Tokens service
// List/create/delete cloudflare_access_tokens; list filtered by team.

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");
const uuid = @import("../utils/uuid.zig");

const log = std.log.scoped(.cloudflare_tokens);

pub const CloudflareToken = struct {
    id: []const u8,
    name: []const u8,
    description: ?[]const u8,
    client_id: []const u8,
    client_secret: []const u8,
    team_id: ?[]const u8,
    owner_type: ?[]const u8,
    owner_id: ?[]const u8,
    created_at: i64,
    updated_at: i64,

    pub fn deinit(self: *CloudflareToken, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
        if (self.description) |d| allocator.free(d);
        allocator.free(self.client_id);
        allocator.free(self.client_secret);
        if (self.team_id) |t| allocator.free(t);
        if (self.owner_type) |o| allocator.free(o);
        if (self.owner_id) |o| allocator.free(o);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !CloudflareToken {
        return CloudflareToken{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField),
            .description = if (row.get("description")) |d| try allocator.dupe(u8, d) else null,
            .client_id = try allocator.dupe(u8, row.get("client_id") orelse return error.MissingField),
            .client_secret = try allocator.dupe(u8, row.get("client_secret") orelse return error.MissingField),
            .team_id = if (row.get("team_id")) |t| try allocator.dupe(u8, t) else null,
            .owner_type = if (row.get("owner_type")) |o| try allocator.dupe(u8, o) else null,
            .owner_id = if (row.get("owner_id")) |o| try allocator.dupe(u8, o) else null,
            .created_at = std.fmt.parseInt(i64, row.get("created_at") orelse "0", 10) catch 0,
            .updated_at = std.fmt.parseInt(i64, row.get("updated_at") orelse "0", 10) catch 0,
        };
    }
};

fn escapeSql(allocator: std.mem.Allocator, str: []const u8) ![]const u8 {
    var result = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer result.deinit(allocator);
    for (str) |char| {
        switch (char) {
            '\'' => try result.writer(allocator).print("''", .{}),
            '\\' => try result.writer(allocator).print("\\\\", .{}),
            else => try result.append(allocator, char),
        }
    }
    return try result.toOwnedSlice(allocator);
}

/// List Cloudflare tokens for team (or all if team_id is null for God mode)
pub fn listByTeam(allocator: std.mem.Allocator, db: *sqlite.sqlite3, team_id: ?[]const u8) !std.ArrayList(CloudflareToken) {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            \\SELECT * FROM cloudflare_access_tokens WHERE team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}') ORDER BY name ASC
        , .{ tid_esc, tid_esc });
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print(
            \\SELECT * FROM cloudflare_access_tokens ORDER BY name ASC
        , .{});
        break :blk try sql_buf.toOwnedSlice(allocator);
    };
    defer allocator.free(query_str);

    var rows = try query.queryAll(allocator, db, query_str);
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }

    var list = std.ArrayList(CloudflareToken).initCapacity(allocator, rows.items.len) catch return error.OutOfMemory;
    for (rows.items) |row| {
        const t = try CloudflareToken.fromRow(allocator, row);
        try list.append(allocator, t);
    }
    return list;
}

/// Create a new Cloudflare token
pub fn create(allocator: std.mem.Allocator, db: *sqlite.sqlite3, data: struct {
    name: []const u8,
    description: ?[]const u8 = null,
    client_id: []const u8,
    client_secret: []const u8,
    team_id: ?[]const u8 = null,
    owner_type: ?[]const u8 = null,
    owner_id: ?[]const u8 = null,
}) !CloudflareToken {
    const id = try uuid.generateUUID(allocator);
    defer allocator.free(id);

    const name_esc = try escapeSql(allocator, data.name);
    defer allocator.free(name_esc);
    const cid_esc = try escapeSql(allocator, data.client_id);
    defer allocator.free(cid_esc);
    const csec_esc = try escapeSql(allocator, data.client_secret);
    defer allocator.free(csec_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    if (data.team_id) |tid| {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        if (data.description) |desc| {
            const desc_esc = try escapeSql(allocator, desc);
            defer allocator.free(desc_esc);
            try sql_buf.writer(allocator).print(
                \\INSERT INTO cloudflare_access_tokens (id, name, description, client_id, client_secret, team_id, created_at, updated_at)
                \\VALUES ('{s}', '{s}', '{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
            , .{ id, name_esc, desc_esc, cid_esc, csec_esc, tid_esc });
        } else {
            try sql_buf.writer(allocator).print(
                \\INSERT INTO cloudflare_access_tokens (id, name, client_id, client_secret, team_id, created_at, updated_at)
                \\VALUES ('{s}', '{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
            , .{ id, name_esc, cid_esc, csec_esc, tid_esc });
        }
    } else if (data.owner_type) |ot| {
        if (data.owner_id) |oid| {
            const ot_esc = try escapeSql(allocator, ot);
            defer allocator.free(ot_esc);
            const oid_esc = try escapeSql(allocator, oid);
            defer allocator.free(oid_esc);
            if (data.description) |desc| {
                const desc_esc = try escapeSql(allocator, desc);
                defer allocator.free(desc_esc);
                try sql_buf.writer(allocator).print(
                    \\INSERT INTO cloudflare_access_tokens (id, name, description, client_id, client_secret, owner_type, owner_id, created_at, updated_at)
                    \\VALUES ('{s}', '{s}', '{s}', '{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
                , .{ id, name_esc, desc_esc, cid_esc, csec_esc, ot_esc, oid_esc });
            } else {
                try sql_buf.writer(allocator).print(
                    \\INSERT INTO cloudflare_access_tokens (id, name, client_id, client_secret, owner_type, owner_id, created_at, updated_at)
                    \\VALUES ('{s}', '{s}', '{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
                , .{ id, name_esc, cid_esc, csec_esc, ot_esc, oid_esc });
            }
        } else {
            if (data.description) |desc| {
                const desc_esc = try escapeSql(allocator, desc);
                defer allocator.free(desc_esc);
                try sql_buf.writer(allocator).print(
                    \\INSERT INTO cloudflare_access_tokens (id, name, description, client_id, client_secret, created_at, updated_at)
                    \\VALUES ('{s}', '{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
                , .{ id, name_esc, desc_esc, cid_esc, csec_esc });
            } else {
                try sql_buf.writer(allocator).print(
                    \\INSERT INTO cloudflare_access_tokens (id, name, client_id, client_secret, created_at, updated_at)
                    \\VALUES ('{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
                , .{ id, name_esc, cid_esc, csec_esc });
            }
        }
    } else {
        if (data.description) |desc| {
            const desc_esc = try escapeSql(allocator, desc);
            defer allocator.free(desc_esc);
            try sql_buf.writer(allocator).print(
                \\INSERT INTO cloudflare_access_tokens (id, name, description, client_id, client_secret, created_at, updated_at)
                \\VALUES ('{s}', '{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
            , .{ id, name_esc, desc_esc, cid_esc, csec_esc });
        } else {
            try sql_buf.writer(allocator).print(
                \\INSERT INTO cloudflare_access_tokens (id, name, client_id, client_secret, created_at, updated_at)
                \\VALUES ('{s}', '{s}', '{s}', '{s}', unixepoch(), unixepoch())
            , .{ id, name_esc, cid_esc, csec_esc });
        }
    }
    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Insert cloudflare_access_token failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.InsertFailed;
    }

    const id_esc = try escapeSql(allocator, id);
    defer allocator.free(id_esc);
    var sql2 = std.ArrayList(u8).initCapacity(allocator, 128) catch return error.OutOfMemory;
    defer sql2.deinit(allocator);
    try sql2.writer(allocator).print("SELECT * FROM cloudflare_access_tokens WHERE id = '{s}' LIMIT 1", .{id_esc});
    const q2 = try sql2.toOwnedSlice(allocator);
    defer allocator.free(q2);
    var rows2 = try query.queryAll(allocator, db, q2);
    defer {
        for (rows2.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            @constCast(row).deinit();
        }
        rows2.deinit(allocator);
    }
    if (rows2.items.len == 0) return error.InsertFailed;
    return try CloudflareToken.fromRow(allocator, rows2.items[0]);
}

/// Delete token by id (and optional team scope)
pub fn delete(allocator: std.mem.Allocator, db: *sqlite.sqlite3, id: []const u8, team_id: ?[]const u8) !bool {
    const id_esc = try escapeSql(allocator, id);
    defer allocator.free(id_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            "DELETE FROM cloudflare_access_tokens WHERE id = '{s}' AND (team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}'))",
            .{ id_esc, tid_esc, tid_esc }
        );
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print("DELETE FROM cloudflare_access_tokens WHERE id = '{s}'", .{id_esc});
        break :blk try sql_buf.toOwnedSlice(allocator);
    };
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Delete cloudflare_access_token failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.DeleteFailed;
    }
    return sqlite.sqlite3_changes(db) > 0;
}
