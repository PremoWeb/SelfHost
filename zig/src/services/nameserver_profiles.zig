// Nameserver Profiles service
// CRUD for nameserver_profiles table; list filtered by team.

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");
const uuid = @import("../utils/uuid.zig");
const vps_providers = @import("vps_providers.zig");

const log = std.log.scoped(.nameserver_profiles);

pub const NameserverProfile = struct {
    id: []const u8,
    name: []const u8,
    ns1: []const u8,
    ns2: ?[]const u8,
    ns3: ?[]const u8,
    ns4: ?[]const u8,
    team_id: []const u8,
    dns_provider_id: ?[]const u8,
    created_at: i64,
    updated_at: i64,

    // Optional relation (fetched separately or joined if needed)
    dns_provider: ?vps_providers.VpsProvider = null,

    pub fn deinit(self: *NameserverProfile, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
        allocator.free(self.ns1);
        if (self.ns2) |n| allocator.free(n);
        if (self.ns3) |n| allocator.free(n);
        if (self.ns4) |n| allocator.free(n);
        allocator.free(self.team_id);
        if (self.dns_provider_id) |d| allocator.free(d);
        if (self.dns_provider) |*p| p.deinit(allocator);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !NameserverProfile {
        return NameserverProfile{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField),
            .ns1 = try allocator.dupe(u8, row.get("ns1") orelse return error.MissingField),
            .ns2 = if (row.get("ns2")) |n| try allocator.dupe(u8, n) else null,
            .ns3 = if (row.get("ns3")) |n| try allocator.dupe(u8, n) else null,
            .ns4 = if (row.get("ns4")) |n| try allocator.dupe(u8, n) else null,
            .team_id = try allocator.dupe(u8, row.get("team_id") orelse return error.MissingField),
            .dns_provider_id = if (row.get("dns_provider_id")) |d| try allocator.dupe(u8, d) else null,
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

/// List profiles for team (or all if team_id is null for God mode)
pub fn listByTeam(allocator: std.mem.Allocator, db: *sqlite.sqlite3, team_id: ?[]const u8) !std.ArrayList(NameserverProfile) {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    // Join with vps_providers to get provider name if linked
    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print(
            \\SELECT p.*, v.name as provider_name 
            \\FROM nameserver_profiles p
            \\LEFT JOIN vps_providers v ON p.dns_provider_id = v.id
            \\WHERE p.team_id = '{s}'
            \\ORDER BY p.name ASC
        , .{tid_esc});
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print(
            \\SELECT p.*, v.name as provider_name 
            \\FROM nameserver_profiles p
            \\LEFT JOIN vps_providers v ON p.dns_provider_id = v.id
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

    var list = std.ArrayList(NameserverProfile).initCapacity(allocator, rows.items.len) catch return error.OutOfMemory;
    for (rows.items) |row| {
        const p = try NameserverProfile.fromRow(allocator, row);

        // If we have provider name, simple hydration (or full object if we had more data)
        if (p.dns_provider_id) |_| {
            if (row.get("provider_name")) |_| {
                // We only need the name for the UI mostly
                // Assuming VpsProvider strict requires only id/name for display?
                // Nah, let's just use the ID/name if needed.
                // Actually, let's construct a minimal VpsProvider if possible, or skip.
                // For now, let's leave dns_provider null unless we fully fetch it.
                // Or we can manually mock it.
                // VpsProvider struct requires many fields.
                // Let's defer full population.
            }
        }

        try list.append(allocator, p);
    }
    return list;
}

pub fn create(allocator: std.mem.Allocator, db: *sqlite.sqlite3, data: struct {
    name: []const u8,
    ns1: []const u8,
    ns2: ?[]const u8 = null,
    ns3: ?[]const u8 = null,
    ns4: ?[]const u8 = null,
    team_id: []const u8,
    dns_provider_id: ?[]const u8 = null,
}) !NameserverProfile {
    const id = try uuid.generateUUID(allocator);
    defer allocator.free(id);

    const name_esc = try escapeSql(allocator, data.name);
    defer allocator.free(name_esc);
    const ns1_esc = try escapeSql(allocator, data.ns1);
    defer allocator.free(ns1_esc);
    const tid_esc = try escapeSql(allocator, data.team_id);
    defer allocator.free(tid_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    try sql_buf.writer(allocator).print(
        "INSERT INTO nameserver_profiles (id, name, ns1, ns2, ns3, ns4, team_id, dns_provider_id, created_at, updated_at) VALUES ('{s}', '{s}', '{s}'",
        .{ id, name_esc, ns1_esc },
    );

    if (data.ns2) |n| {
        const n_esc = try escapeSql(allocator, n);
        defer allocator.free(n_esc);
        try sql_buf.writer(allocator).print(", '{s}'", .{n_esc});
    } else {
        try sql_buf.writer(allocator).print(", NULL", .{});
    }

    if (data.ns3) |n| {
        const n_esc = try escapeSql(allocator, n);
        defer allocator.free(n_esc);
        try sql_buf.writer(allocator).print(", '{s}'", .{n_esc});
    } else {
        try sql_buf.writer(allocator).print(", NULL", .{});
    }

    if (data.ns4) |n| {
        const n_esc = try escapeSql(allocator, n);
        defer allocator.free(n_esc);
        try sql_buf.writer(allocator).print(", '{s}'", .{n_esc});
    } else {
        try sql_buf.writer(allocator).print(", NULL", .{});
    }

    try sql_buf.writer(allocator).print(", '{s}'", .{tid_esc});

    if (data.dns_provider_id) |pid| {
        // If empty string, treat as null
        if (pid.len > 0) {
            const pid_esc = try escapeSql(allocator, pid);
            defer allocator.free(pid_esc);
            try sql_buf.writer(allocator).print(", '{s}'", .{pid_esc});
        } else {
            try sql_buf.writer(allocator).print(", NULL", .{});
        }
    } else {
        try sql_buf.writer(allocator).print(", NULL", .{});
    }

    try sql_buf.writer(allocator).print(", unixepoch(), unixepoch())", .{});

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Insert nameserver_profile failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.InsertFailed;
    }

    // Return partial object or fetch full? Fetching useful to confirm persistence.
    // For now construct manually to save query.
    const profile = NameserverProfile{
        .id = try allocator.dupe(u8, id),
        .name = try allocator.dupe(u8, data.name),
        .ns1 = try allocator.dupe(u8, data.ns1),
        .ns2 = if (data.ns2) |n| try allocator.dupe(u8, n) else null,
        .ns3 = if (data.ns3) |n| try allocator.dupe(u8, n) else null,
        .ns4 = if (data.ns4) |n| try allocator.dupe(u8, n) else null,
        .team_id = try allocator.dupe(u8, data.team_id),
        .dns_provider_id = if (data.dns_provider_id) |d| (if (d.len > 0) try allocator.dupe(u8, d) else null) else null,
        .created_at = std.time.timestamp(),
        .updated_at = std.time.timestamp(),
    };
    return profile;
}

pub fn delete(allocator: std.mem.Allocator, db: *sqlite.sqlite3, id: []const u8, team_id: ?[]const u8) !bool {
    const id_esc = try escapeSql(allocator, id);
    defer allocator.free(id_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const query_str = if (team_id) |tid| blk: {
        const tid_esc = try escapeSql(allocator, tid);
        defer allocator.free(tid_esc);
        try sql_buf.writer(allocator).print("DELETE FROM nameserver_profiles WHERE id = '{s}' AND team_id = '{s}'", .{ id_esc, tid_esc });
        break :blk try sql_buf.toOwnedSlice(allocator);
    } else blk: {
        try sql_buf.writer(allocator).print("DELETE FROM nameserver_profiles WHERE id = '{s}'", .{id_esc});
        break :blk try sql_buf.toOwnedSlice(allocator);
    };
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Delete nameserver_profile failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.DeleteFailed;
    }
    return sqlite.sqlite3_changes(db) > 0;
}

pub fn setDefault(allocator: std.mem.Allocator, db: *sqlite.sqlite3, team_id: []const u8, profile_id: []const u8) !bool {
    const tid_esc = try escapeSql(allocator, team_id);
    defer allocator.free(tid_esc);
    const pid_esc = try escapeSql(allocator, profile_id);
    defer allocator.free(pid_esc);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    try sql_buf.writer(allocator).print("UPDATE teams SET default_nameserver_profile_id = '{s}', updated_at = unixepoch() WHERE id = '{s}'", .{ pid_esc, tid_esc });
    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    const rc = sqlite.sqlite3_exec(db, query_str.ptr, null, null, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Set default nameserver profile failed: {s}", .{sqlite.sqlite3_errmsg(db)});
        return error.UpdateFailed;
    }
    return sqlite.sqlite3_changes(db) > 0;
}
