// Security Service
// Private key lookups for SSH and agent install

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");

const log = std.log.scoped(.security);

pub const PrivateKey = struct {
    id: []const u8,
    private_key: []const u8,

    pub fn deinit(self: *PrivateKey, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.private_key);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !PrivateKey {
        return PrivateKey{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .private_key = try allocator.dupe(u8, row.get("private_key") orelse return error.MissingField),
        };
    }
};

/// Get private key by ID. If is_god is true, returns any key. Otherwise requires team_id match (team_id or owner_type=team + owner_id).
pub fn getPrivateKeyById(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    key_id: []const u8,
    team_id: ?[]const u8,
    is_god: bool,
) !?PrivateKey {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const key_id_escaped = try escapeSqlString(allocator, key_id);
    defer allocator.free(key_id_escaped);

    try sql_buf.writer(allocator).print(
        "SELECT id, private_key, team_id, owner_type, owner_id FROM private_keys WHERE id = '{s}'",
        .{key_id_escaped},
    );

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    var rows = try query.queryAll(allocator, db, query_str);
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return null;

    const row = &rows.items[0];
    if (!is_god) {
        if (team_id) |tid| {
            const row_team_id = row.get("team_id");
            const row_owner_type = row.get("owner_type");
            const row_owner_id = row.get("owner_id");
            const team_match = (row_team_id != null and row_team_id.?.len > 0 and std.mem.eql(u8, row_team_id.?, tid)) or
                (row_owner_type != null and std.mem.eql(u8, row_owner_type.?, "team") and row_owner_id != null and std.mem.eql(u8, row_owner_id.?, tid));
            if (!team_match) return null;
        } else {
            return null;
        }
    }

    return try PrivateKey.fromRow(allocator, row.*);
}

/// List private keys for a team (id and name only; no private key material). For cloud provider "team keys to install" UI.
pub const PrivateKeySummary = struct {
    id: []const u8,
    name: []const u8,

    pub fn deinit(self: *PrivateKeySummary, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
    }
};

pub fn listPrivateKeysByTeam(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    team_id: ?[]const u8,
    is_god: bool,
) !std.ArrayList(PrivateKeySummary) {
    if (!is_god and team_id == null) return std.ArrayList(PrivateKeySummary).initCapacity(allocator, 0) catch return error.OutOfMemory;

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 384) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSqlString(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            \\SELECT id, COALESCE(name, id) AS name FROM private_keys
            \\WHERE team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}')
            \\ORDER BY name ASC
        , .{ tid_esc, tid_esc });
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print(
            \\SELECT id, COALESCE(name, id) AS name FROM private_keys ORDER BY name ASC
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

    var list = std.ArrayList(PrivateKeySummary).initCapacity(allocator, rows.items.len) catch return error.OutOfMemory;
    for (rows.items) |row| {
        const id = try allocator.dupe(u8, row.get("id") orelse "");
        const name = try allocator.dupe(u8, row.get("name") orelse id);
        try list.append(allocator, .{ .id = id, .name = name });
    }
    return list;
}

fn escapeSqlString(allocator: std.mem.Allocator, str: []const u8) ![]const u8 {
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
