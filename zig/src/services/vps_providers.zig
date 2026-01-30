// VPS Providers (Cloud Providers) service
// CRUD for vps_providers table; list filtered by team (or all for God).

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");
const uuid = @import("../utils/uuid.zig");

const log = std.log.scoped(.vps_providers);

pub const VpsProvider = struct {
    id: []const u8,
    name: []const u8,
    type_name: []const u8, // "vultr"
    api_key: []const u8,
    dns_enabled: bool,
    team_id: ?[]const u8,
    owner_type: ?[]const u8,
    owner_id: ?[]const u8,
    created_at: i64,
    updated_at: i64,
    server_count: i64 = 0,
    application_count: i64 = 0,
    database_count: i64 = 0,
    domain_count: i64 = 0,

    pub fn deinit(self: *VpsProvider, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
        allocator.free(self.type_name);
        allocator.free(self.api_key);
        if (self.team_id) |t| allocator.free(t);
        if (self.owner_type) |o| allocator.free(o);
        if (self.owner_id) |o| allocator.free(o);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !VpsProvider {
        const dns_str = row.get("dns_enabled") orelse "0";
        const dns_enabled = std.mem.eql(u8, dns_str, "1") or std.mem.eql(u8, dns_str, "true");
        return VpsProvider{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField),
            .type_name = try allocator.dupe(u8, row.get("type") orelse return error.MissingField),
            .api_key = try allocator.dupe(u8, row.get("api_key") orelse return error.MissingField),
            .dns_enabled = dns_enabled,
            .team_id = if (row.get("team_id")) |t| try allocator.dupe(u8, t) else null,
            .owner_type = if (row.get("owner_type")) |o| try allocator.dupe(u8, o) else null,
            .owner_id = if (row.get("owner_id")) |o| try allocator.dupe(u8, o) else null,
            .created_at = std.fmt.parseInt(i64, row.get("created_at") orelse "0", 10) catch 0,
            .updated_at = std.fmt.parseInt(i64, row.get("updated_at") orelse "0", 10) catch 0,
            .server_count = std.fmt.parseInt(i64, row.get("server_count") orelse "0", 10) catch 0,
            .application_count = std.fmt.parseInt(i64, row.get("application_count") orelse "0", 10) catch 0,
            .database_count = std.fmt.parseInt(i64, row.get("database_count") orelse "0", 10) catch 0,
            .domain_count = std.fmt.parseInt(i64, row.get("domain_count") orelse "0", 10) catch 0,
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

/// List VPS providers for team (or all if team_id is null for God mode)
pub fn listByTeam(allocator: std.mem.Allocator, db: *sqlite.sqlite3, team_id: ?[]const u8) !std.ArrayList(VpsProvider) {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            \\SELECT p.id, p.name, p.type, p.api_key, p.dns_enabled, p.team_id, p.owner_type, p.owner_id, p.created_at, p.updated_at,
            \\(SELECT COUNT(*) FROM servers s WHERE s.vps_provider_id = p.id) AS server_count,
            \\0 AS application_count, 0 AS database_count, 0 AS domain_count
            \\FROM vps_providers p
            \\WHERE p.team_id = '{s}' OR (p.owner_type = 'team' AND p.owner_id = '{s}')
            \\ORDER BY p.name ASC
        , .{ tid_esc, tid_esc });
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print(
            \\SELECT p.id, p.name, p.type, p.api_key, p.dns_enabled, p.team_id, p.owner_type, p.owner_id, p.created_at, p.updated_at,
            \\(SELECT COUNT(*) FROM servers s WHERE s.vps_provider_id = p.id) AS server_count,
            \\0 AS application_count, 0 AS database_count, 0 AS domain_count
            \\FROM vps_providers p
            \\ORDER BY p.name ASC
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

    var list = std.ArrayList(VpsProvider).initCapacity(allocator, rows.items.len) catch return error.OutOfMemory;
    for (rows.items) |row| {
        const p = try VpsProvider.fromRow(allocator, row);
        try list.append(allocator, p);
    }
    return list;
}

/// Get one provider by id; team_id null = God (any team)
pub fn getById(allocator: std.mem.Allocator, db: *sqlite.sqlite3, id: []const u8, team_id: ?[]const u8) !?VpsProvider {
    const id_esc = try escapeSql(allocator, id);
    defer allocator.free(id_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 384) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            \\SELECT p.id, p.name, p.type, p.api_key, p.dns_enabled, p.team_id, p.owner_type, p.owner_id, p.created_at, p.updated_at,
            \\(SELECT COUNT(*) FROM servers s WHERE s.vps_provider_id = p.id) AS server_count, 0 AS application_count, 0 AS database_count, 0 AS domain_count
            \\FROM vps_providers p WHERE p.id = '{s}' AND (p.team_id = '{s}' OR (p.owner_type = 'team' AND p.owner_id = '{s}')) LIMIT 1
        , .{ id_esc, tid_esc, tid_esc });
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print(
            \\SELECT p.id, p.name, p.type, p.api_key, p.dns_enabled, p.team_id, p.owner_type, p.owner_id, p.created_at, p.updated_at,
            \\(SELECT COUNT(*) FROM servers s WHERE s.vps_provider_id = p.id) AS server_count, 0 AS application_count, 0 AS database_count, 0 AS domain_count
            \\FROM vps_providers p WHERE p.id = '{s}' LIMIT 1
        , .{id_esc});
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
    if (rows.items.len == 0) return null;
    return try VpsProvider.fromRow(allocator, rows.items[0]);
}

/// Create a new VPS provider; returns the created row (caller must deinit)
pub fn create(allocator: std.mem.Allocator, db: *sqlite.sqlite3, data: struct {
    name: []const u8,
    type_name: []const u8,
    api_key: []const u8,
    dns_enabled: bool = false,
    team_id: ?[]const u8 = null,
    owner_type: ?[]const u8 = null,
    owner_id: ?[]const u8 = null,
}) !VpsProvider {
    const id = try uuid.generateUUID(allocator);
    defer allocator.free(id);

    const name_esc = try escapeSql(allocator, data.name);
    defer allocator.free(name_esc);
    const type_esc = try escapeSql(allocator, data.type_name);
    defer allocator.free(type_esc);
    const key_esc = try escapeSql(allocator, data.api_key);
    defer allocator.free(key_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const dns_val = if (data.dns_enabled) "1" else "0";
    if (data.team_id) |tid| {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            \\INSERT INTO vps_providers (id, name, type, api_key, dns_enabled, team_id, created_at, updated_at)
            \\VALUES ('{s}', '{s}', '{s}', '{s}', {s}, '{s}', unixepoch(), unixepoch())
        , .{ id, name_esc, type_esc, key_esc, dns_val, tid_esc });
    } else if (data.owner_type) |ot| {
        if (data.owner_id) |oid| {
            const ot_esc = try escapeSql(allocator, ot);
            defer allocator.free(ot_esc);
            const oid_esc = try escapeSql(allocator, oid);
            defer allocator.free(oid_esc);
            try sql_buf.writer(allocator).print(
                \\INSERT INTO vps_providers (id, name, type, api_key, dns_enabled, owner_type, owner_id, created_at, updated_at)
                \\VALUES ('{s}', '{s}', '{s}', '{s}', {s}, '{s}', '{s}', unixepoch(), unixepoch())
            , .{ id, name_esc, type_esc, key_esc, dns_val, ot_esc, oid_esc });
        } else {
            try sql_buf.writer(allocator).print(
                \\INSERT INTO vps_providers (id, name, type, api_key, dns_enabled, created_at, updated_at)
                \\VALUES ('{s}', '{s}', '{s}', '{s}', {s}, unixepoch(), unixepoch())
            , .{ id, name_esc, type_esc, key_esc, dns_val });
        }
    } else {
        try sql_buf.writer(allocator).print(
            \\INSERT INTO vps_providers (id, name, type, api_key, dns_enabled, created_at, updated_at)
            \\VALUES ('{s}', '{s}', '{s}', '{s}', {s}, unixepoch(), unixepoch())
        , .{ id, name_esc, type_esc, key_esc, dns_val });
    }
    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Insert vps_provider failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.InsertFailed;
    }

    const created = (try getById(allocator, db, id, data.team_id)) orelse return error.InsertFailed;
    return created;
}

/// Update provider by id (and optional team scope)
pub fn update(allocator: std.mem.Allocator, db: *sqlite.sqlite3, id: []const u8, team_id: ?[]const u8, data: struct {
    name: ?[]const u8 = null,
    api_key: ?[]const u8 = null,
    dns_enabled: ?bool = null,
}) !bool {
    const id_esc = try escapeSql(allocator, id);
    defer allocator.free(id_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 384) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    if (team_id) |tid| {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            "UPDATE vps_providers SET updated_at = unixepoch()",
            .{},
        );
        if (data.name) |n| {
            const n_esc = try escapeSql(allocator, n);
            defer allocator.free(n_esc);
            try sql_buf.writer(allocator).print(", name = '{s}'", .{n_esc});
        }
        if (data.api_key) |k| {
            const k_esc = try escapeSql(allocator, k);
            defer allocator.free(k_esc);
            try sql_buf.writer(allocator).print(", api_key = '{s}'", .{k_esc});
        }
        if (data.dns_enabled) |d| {
            try sql_buf.writer(allocator).print(", dns_enabled = {s}", .{if (d) "1" else "0"});
        }
        try sql_buf.writer(allocator).print(" WHERE id = '{s}' AND (team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}'))", .{ id_esc, tid_esc, tid_esc });
    } else {
        try sql_buf.writer(allocator).print("UPDATE vps_providers SET updated_at = unixepoch()", .{});
        if (data.name) |n| {
            const n_esc = try escapeSql(allocator, n);
            defer allocator.free(n_esc);
            try sql_buf.writer(allocator).print(", name = '{s}'", .{n_esc});
        }
        if (data.api_key) |k| {
            const k_esc = try escapeSql(allocator, k);
            defer allocator.free(k_esc);
            try sql_buf.writer(allocator).print(", api_key = '{s}'", .{k_esc});
        }
        if (data.dns_enabled) |d| {
            try sql_buf.writer(allocator).print(", dns_enabled = {s}", .{if (d) "1" else "0"});
        }
        try sql_buf.writer(allocator).print(" WHERE id = '{s}'", .{id_esc});
    }
    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Update vps_provider failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.UpdateFailed;
    }
    return sqlite.sqlite3_changes(db) > 0;
}

/// Delete provider by id (and optional team scope)
pub fn delete(allocator: std.mem.Allocator, db: *sqlite.sqlite3, id: []const u8, team_id: ?[]const u8) !bool {
    const id_esc = try escapeSql(allocator, id);
    defer allocator.free(id_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            "DELETE FROM vps_providers WHERE id = '{s}' AND (team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}'))",
            .{ id_esc, tid_esc, tid_esc }
        );
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print("DELETE FROM vps_providers WHERE id = '{s}'", .{id_esc});
        break :blk try sql_buf.toOwnedSlice(allocator);
    };
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Delete vps_provider failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.DeleteFailed;
    }
    return sqlite.sqlite3_changes(db) > 0;
}
