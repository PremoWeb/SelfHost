// Servers Service
// Implements server-related database queries

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");
const uuid = @import("../utils/uuid.zig");
const companies_service = @import("companies.zig");

const log = std.log.scoped(.servers);

pub const Server = struct {
    id: []const u8,
    name: []const u8,
    description: ?[]const u8,
    ip: []const u8,
    ipv6: ?[]const u8,
    port: i64,
    user: []const u8,
    status: []const u8,
    region: ?[]const u8,
    team_id: ?[]const u8,
    owner_type: ?[]const u8,
    owner_id: ?[]const u8,
    application_count: i64,
    database_count: i64,
    provider_name: ?[]const u8,
    provider_type: ?[]const u8,
    created_at: i64,
    updated_at: i64,
    // Detail page fields (from servers table)
    private_key_id: ?[]const u8,
    connection_type: ?[]const u8,
    agent_key: ?[]const u8,
    tags: ?[]const u8,
    health_cpu: i64,
    health_memory: i64,
    health_disk: i64,
    health_updated_at: ?i64,
    proxy_type: ?[]const u8,
    proxy_status: ?[]const u8,
    cloudflare_tunnel_hostname: ?[]const u8,
    cloudflare_access_token_id: ?[]const u8,
    agent_checksum: ?[]const u8,
    agent_version: ?[]const u8,
    agent_installed_at: ?i64,

    pub fn deinit(self: *Server, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
        if (self.description) |d| allocator.free(d);
        allocator.free(self.ip);
        if (self.ipv6) |ip| allocator.free(ip);
        allocator.free(self.user);
        allocator.free(self.status);
        if (self.region) |r| allocator.free(r);
        if (self.team_id) |t| allocator.free(t);
        if (self.owner_type) |o| allocator.free(o);
        if (self.owner_id) |o| allocator.free(o);
        if (self.provider_name) |p| allocator.free(p);
        if (self.provider_type) |p| allocator.free(p);
        if (self.private_key_id) |p| allocator.free(p);
        if (self.connection_type) |c| allocator.free(c);
        if (self.agent_key) |a| allocator.free(a);
        if (self.tags) |t| allocator.free(t);
        if (self.proxy_type) |p| allocator.free(p);
        if (self.proxy_status) |p| allocator.free(p);
        if (self.cloudflare_tunnel_hostname) |c| allocator.free(c);
        if (self.cloudflare_access_token_id) |c| allocator.free(c);
        if (self.agent_checksum) |c| allocator.free(c);
        if (self.agent_version) |v| allocator.free(v);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !Server {
        return Server{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField),
            .description = if (row.get("description")) |d| try allocator.dupe(u8, d) else null,
            .ip = try allocator.dupe(u8, row.get("ip") orelse return error.MissingField),
            .ipv6 = if (row.get("ipv6")) |ip| try allocator.dupe(u8, ip) else null,
            .port = std.fmt.parseInt(i64, row.get("port") orelse "22", 10) catch 22,
            .user = try allocator.dupe(u8, row.get("user") orelse "root"),
            .status = try allocator.dupe(u8, row.get("status") orelse "offline"),
            .region = if (row.get("region")) |r| try allocator.dupe(u8, r) else null,
            .team_id = if (row.get("team_id")) |t| try allocator.dupe(u8, t) else null,
            .owner_type = if (row.get("owner_type")) |o| try allocator.dupe(u8, o) else null,
            .owner_id = if (row.get("owner_id")) |o| try allocator.dupe(u8, o) else null,
            .application_count = std.fmt.parseInt(i64, row.get("application_count") orelse "0", 10) catch 0,
            .database_count = std.fmt.parseInt(i64, row.get("database_count") orelse "0", 10) catch 0,
            .provider_name = if (row.get("provider_name")) |p| try allocator.dupe(u8, p) else null,
            .provider_type = if (row.get("provider_type")) |p| try allocator.dupe(u8, p) else null,
            .created_at = std.fmt.parseInt(i64, row.get("created_at") orelse "0", 10) catch 0,
            .updated_at = std.fmt.parseInt(i64, row.get("updated_at") orelse "0", 10) catch 0,
            .private_key_id = if (row.get("private_key_id")) |p| try allocator.dupe(u8, p) else null,
            .connection_type = if (row.get("connection_type")) |c| try allocator.dupe(u8, c) else null,
            .agent_key = if (row.get("agent_key")) |a| try allocator.dupe(u8, a) else null,
            .tags = if (row.get("tags")) |t| try allocator.dupe(u8, t) else null,
            .health_cpu = std.fmt.parseInt(i64, row.get("health_cpu") orelse "0", 10) catch 0,
            .health_memory = std.fmt.parseInt(i64, row.get("health_memory") orelse "0", 10) catch 0,
            .health_disk = std.fmt.parseInt(i64, row.get("health_disk") orelse "0", 10) catch 0,
            .health_updated_at = if (row.get("health_updated_at")) |h| std.fmt.parseInt(i64, h, 10) catch null else null,
            .proxy_type = if (row.get("proxy_type")) |p| try allocator.dupe(u8, p) else null,
            .proxy_status = if (row.get("proxy_status")) |p| try allocator.dupe(u8, p) else null,
            .cloudflare_tunnel_hostname = if (row.get("cloudflare_tunnel_hostname")) |c| try allocator.dupe(u8, c) else null,
            .cloudflare_access_token_id = if (row.get("cloudflare_access_token_id")) |c| try allocator.dupe(u8, c) else null,
            .agent_checksum = if (row.get("agent_checksum")) |c| try allocator.dupe(u8, c) else null,
            .agent_version = if (row.get("agent_version")) |v| try allocator.dupe(u8, v) else null,
            .agent_installed_at = if (row.get("agent_installed_at")) |a| std.fmt.parseInt(i64, a, 10) catch null else null,
        };
    }
};

/// Get all servers for a team (or all servers if teamId is null)
pub fn getServersByTeam(allocator: std.mem.Allocator, db: *sqlite.sqlite3, team_id: ?[]const u8) !std.ArrayList(Server) {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    // Simplified query for now - can add JOINs later if needed
    const base_sql = "SELECT * FROM servers";

    try sql_buf.writer(allocator).print("{s}", .{base_sql});

    if (team_id) |tid| {
        // Escape team_id to prevent SQL injection
        // For now, simple approach - in production use parameterized queries
        try sql_buf.writer(allocator).print(" WHERE team_id = '{s}'", .{tid});
    }

    try sql_buf.writer(allocator).print(" ORDER BY created_at ASC", .{});

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

    var servers = std.ArrayList(Server).initCapacity(allocator, 0) catch return error.OutOfMemory;
    errdefer {
        for (servers.items) |*s| {
            s.deinit(allocator);
        }
        servers.deinit(allocator);
    }

    for (rows.items) |*row| {
        const server = try Server.fromRow(allocator, row.*);
        errdefer @constCast(&server).deinit(allocator);
        try servers.append(allocator, server);
    }

    return servers;
}

/// Get server by ID
pub fn getServerById(allocator: std.mem.Allocator, db: *sqlite.sqlite3, server_id: []const u8, team_id: ?[]const u8) !?Server {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const server_id_escaped = try escapeSqlString(allocator, server_id);
    defer allocator.free(server_id_escaped);

    try sql_buf.writer(allocator).print("SELECT * FROM servers WHERE id = '{s}'", .{server_id_escaped});

    if (team_id) |tid| {
        const tid_escaped = try escapeSqlString(allocator, tid);
        defer allocator.free(tid_escaped);
        try sql_buf.writer(allocator).print(" AND (team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}'))", .{ tid_escaped, tid_escaped });
    }

    try sql_buf.writer(allocator).print(" LIMIT 1", .{});

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

    const server = try Server.fromRow(allocator, rows.items[0]);
    return server;
}

/// Create server data structure
pub const CreateServerData = struct {
    name: []const u8,
    ip: []const u8,
    description: ?[]const u8 = null,
    port: ?i64 = null,
    user: ?[]const u8 = null,
    team_id: ?[]const u8 = null,
    company_id: ?[]const u8 = null,
    vps_provider_id: ?[]const u8 = null,
    private_key_id: ?[]const u8 = null,
    tags: ?[]const []const u8 = null,
    cloudflare_tunnel_hostname: ?[]const u8 = null,
    cloudflare_access_token_id: ?[]const u8 = null,
    region: ?[]const u8 = null,
};

/// Create a new server
/// Supports company assignment via companyId parameter (like original)
pub fn createServer(allocator: std.mem.Allocator, db: *sqlite.sqlite3, data: CreateServerData) !Server {
    // Generate UUID
    const server_id = try uuid.generateUUID(allocator);
    defer allocator.free(server_id);

    // Determine company assignment (like original)
    var assigned_company_id: ?[]const u8 = data.company_id;
    if (assigned_company_id == null) {
        // Try to get default company
        assigned_company_id = try companies_service.getDefaultCompanyForResource(allocator, db);
    }

    // Set ownerType and ownerId if company is assigned
    const owner_type: ?[]const u8 = if (assigned_company_id != null) "company" else null;
    const owner_id: ?[]const u8 = assigned_company_id;

    // Build INSERT query
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const server_id_escaped = try escapeSqlString(allocator, server_id);
    defer allocator.free(server_id_escaped);
    const name_escaped = try escapeSqlString(allocator, data.name);
    defer allocator.free(name_escaped);
    const ip_escaped = try escapeSqlString(allocator, data.ip);
    defer allocator.free(ip_escaped);

    const port = data.port orelse 22;
    const user_str = data.user orelse "root";
    const user_escaped = try escapeSqlString(allocator, user_str);
    defer allocator.free(user_escaped);

    // Serialize tags to JSON
    const tags_json = if (data.tags) |tags| blk: {
        var tags_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
        defer tags_buf.deinit(allocator);
        try tags_buf.writer(allocator).print("[", .{});
        for (tags, 0..) |tag, i| {
            if (i > 0) try tags_buf.writer(allocator).print(",", .{});
            const tag_escaped = try escapeJsonString(allocator, tag);
            defer allocator.free(tag_escaped);
            try tags_buf.writer(allocator).print("\"{s}\"", .{tag_escaped});
        }
        try tags_buf.writer(allocator).print("]", .{});
        break :blk try tags_buf.toOwnedSlice(allocator);
    } else "[]";
    defer if (data.tags != null) allocator.free(tags_json);

    try sql_buf.writer(allocator).print(
        \\INSERT INTO servers (id, name, description, ip, port, user, status, team_id, owner_type, owner_id, vps_provider_id, private_key_id, tags, cloudflare_tunnel_hostname, cloudflare_access_token_id, region, created_at, updated_at)
        \\VALUES ('{s}', '{s}',
    , .{ server_id_escaped, name_escaped });

    // Description
    if (data.description) |desc| {
        const desc_escaped = try escapeSqlString(allocator, desc);
        defer allocator.free(desc_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{desc_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    try sql_buf.writer(allocator).print(" '{s}', {d}, '{s}', 'offline',", .{ ip_escaped, port, user_escaped });

    // Team ID
    if (data.team_id) |tid| {
        const tid_escaped = try escapeSqlString(allocator, tid);
        defer allocator.free(tid_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{tid_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    // Owner type and ID
    if (owner_type) |ot| {
        const ot_escaped = try escapeSqlString(allocator, ot);
        defer allocator.free(ot_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{ot_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    if (owner_id) |oid| {
        const oid_escaped = try escapeSqlString(allocator, oid);
        defer allocator.free(oid_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{oid_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    // VPS Provider ID
    if (data.vps_provider_id) |vpid| {
        const vpid_escaped = try escapeSqlString(allocator, vpid);
        defer allocator.free(vpid_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{vpid_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    // Private Key ID
    if (data.private_key_id) |pkid| {
        const pkid_escaped = try escapeSqlString(allocator, pkid);
        defer allocator.free(pkid_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{pkid_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    // Tags (JSON)
    const tags_json_escaped = try escapeSqlString(allocator, tags_json);
    defer allocator.free(tags_json_escaped);
    try sql_buf.writer(allocator).print(" '{s}',", .{tags_json_escaped});

    // Cloudflare fields
    if (data.cloudflare_tunnel_hostname) |hostname| {
        const hostname_escaped = try escapeSqlString(allocator, hostname);
        defer allocator.free(hostname_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{hostname_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    if (data.cloudflare_access_token_id) |token_id| {
        const token_id_escaped = try escapeSqlString(allocator, token_id);
        defer allocator.free(token_id_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{token_id_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    // Region
    if (data.region) |region| {
        const region_escaped = try escapeSqlString(allocator, region);
        defer allocator.free(region_escaped);
        try sql_buf.writer(allocator).print(" '{s}',", .{region_escaped});
    } else {
        try sql_buf.writer(allocator).print(" NULL,", .{});
    }

    try sql_buf.writer(allocator).print(" unixepoch(), unixepoch())", .{});

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    // Execute INSERT
    try query.execute(allocator, db, query_str);

    // Fetch the created server
    const created_server = try getServerById(allocator, db, server_id, null);
    return created_server orelse return error.ServerNotFound;
}

/// Update server data structure
pub const UpdateServerData = struct {
    name: ?[]const u8 = null,
    description: ?[]const u8 = null,
    ip: ?[]const u8 = null,
    port: ?i64 = null,
    user: ?[]const u8 = null,
    status: ?[]const u8 = null,
    region: ?[]const u8 = null,
    vps_provider_id: ?[]const u8 = null,
    private_key_id: ?[]const u8 = null,
    connection_type: ?[]const u8 = null,
    agent_key: ?[]const u8 = null,
    tags: ?[]const []const u8 = null,
    cloudflare_tunnel_hostname: ?[]const u8 = null,
    cloudflare_access_token_id: ?[]const u8 = null,
};

/// Update a server
/// Supports both teamId (backward compatibility) and ownerType/ownerId model
pub fn updateServer(allocator: std.mem.Allocator, db: *sqlite.sqlite3, server_id: []const u8, team_id: ?[]const u8, data: UpdateServerData) !?Server {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const server_id_escaped = try escapeSqlString(allocator, server_id);
    defer allocator.free(server_id_escaped);

    try sql_buf.writer(allocator).print("UPDATE servers SET", .{});

    var has_set = false;

    if (data.name) |name| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const name_escaped = try escapeSqlString(allocator, name);
        defer allocator.free(name_escaped);
        try sql_buf.writer(allocator).print(" name = '{s}'", .{name_escaped});
        has_set = true;
    }

    if (data.description) |desc| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const desc_escaped = try escapeSqlString(allocator, desc);
        defer allocator.free(desc_escaped);
        try sql_buf.writer(allocator).print(" description = '{s}'", .{desc_escaped});
        has_set = true;
    }

    if (data.ip) |ip| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const ip_escaped = try escapeSqlString(allocator, ip);
        defer allocator.free(ip_escaped);
        try sql_buf.writer(allocator).print(" ip = '{s}'", .{ip_escaped});
        has_set = true;
    }

    if (data.port) |port| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        try sql_buf.writer(allocator).print(" port = {d}", .{port});
        has_set = true;
    }

    if (data.user) |user| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const user_escaped = try escapeSqlString(allocator, user);
        defer allocator.free(user_escaped);
        try sql_buf.writer(allocator).print(" user = '{s}'", .{user_escaped});
        has_set = true;
    }

    if (data.status) |status| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const status_escaped = try escapeSqlString(allocator, status);
        defer allocator.free(status_escaped);
        try sql_buf.writer(allocator).print(" status = '{s}'", .{status_escaped});
        has_set = true;
    }

    if (data.region) |region| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const region_escaped = try escapeSqlString(allocator, region);
        defer allocator.free(region_escaped);
        try sql_buf.writer(allocator).print(" region = '{s}'", .{region_escaped});
        has_set = true;
    }

    if (data.vps_provider_id) |vpid| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const vpid_escaped = try escapeSqlString(allocator, vpid);
        defer allocator.free(vpid_escaped);
        try sql_buf.writer(allocator).print(" vps_provider_id = '{s}'", .{vpid_escaped});
        has_set = true;
    }

    if (data.private_key_id) |pkid| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const pkid_escaped = try escapeSqlString(allocator, pkid);
        defer allocator.free(pkid_escaped);
        try sql_buf.writer(allocator).print(" private_key_id = '{s}'", .{pkid_escaped});
        has_set = true;
    }

    if (data.connection_type) |ct| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const ct_escaped = try escapeSqlString(allocator, ct);
        defer allocator.free(ct_escaped);
        try sql_buf.writer(allocator).print(" connection_type = '{s}'", .{ct_escaped});
        has_set = true;
    }

    if (data.agent_key) |ak| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const ak_escaped = try escapeSqlString(allocator, ak);
        defer allocator.free(ak_escaped);
        try sql_buf.writer(allocator).print(" agent_key = '{s}'", .{ak_escaped});
        has_set = true;
    }

    if (data.tags) |tags| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const tags_json = blk: {
            var tags_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
            defer tags_buf.deinit(allocator);
            try tags_buf.writer(allocator).print("[", .{});
            for (tags, 0..) |tag, i| {
                if (i > 0) try tags_buf.writer(allocator).print(",", .{});
                const tag_escaped = try escapeJsonString(allocator, tag);
                defer allocator.free(tag_escaped);
                try tags_buf.writer(allocator).print("\"{s}\"", .{tag_escaped});
            }
            try tags_buf.writer(allocator).print("]", .{});
            break :blk try tags_buf.toOwnedSlice(allocator);
        };
        defer allocator.free(tags_json);
        const tags_json_escaped = try escapeSqlString(allocator, tags_json);
        defer allocator.free(tags_json_escaped);
        try sql_buf.writer(allocator).print(" tags = '{s}'", .{tags_json_escaped});
        has_set = true;
    }

    if (data.cloudflare_tunnel_hostname) |hostname| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const hostname_escaped = try escapeSqlString(allocator, hostname);
        defer allocator.free(hostname_escaped);
        try sql_buf.writer(allocator).print(" cloudflare_tunnel_hostname = '{s}'", .{hostname_escaped});
        has_set = true;
    }

    if (data.cloudflare_access_token_id) |token_id| {
        if (has_set) try sql_buf.writer(allocator).print(",", .{});
        const token_id_escaped = try escapeSqlString(allocator, token_id);
        defer allocator.free(token_id_escaped);
        try sql_buf.writer(allocator).print(" cloudflare_access_token_id = '{s}'", .{token_id_escaped});
        has_set = true;
    }

    // Always update updated_at
    if (has_set) try sql_buf.writer(allocator).print(",", .{});
    try sql_buf.writer(allocator).print(" updated_at = unixepoch()", .{});

    // WHERE clause
    try sql_buf.writer(allocator).print(" WHERE id = '{s}'", .{server_id_escaped});

    if (team_id) |tid| {
        const tid_escaped = try escapeSqlString(allocator, tid);
        defer allocator.free(tid_escaped);
        try sql_buf.writer(allocator).print(" AND (team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}'))", .{ tid_escaped, tid_escaped });
    }

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    // Log the generated query for debugging
    log.debug("Update server query: {s}", .{query_str});

    // Execute UPDATE
    try query.execute(allocator, db, query_str);

    // Fetch updated server
    return try getServerById(allocator, db, server_id, team_id);
}

/// Delete a server
/// Supports both teamId (backward compatibility) and ownerType/ownerId model
pub fn deleteServer(allocator: std.mem.Allocator, db: *sqlite.sqlite3, server_id: []const u8, team_id: ?[]const u8) !?Server {
    // First get the server to return it
    const server = try getServerById(allocator, db, server_id, team_id);
    if (server == null) return null;

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const server_id_escaped = try escapeSqlString(allocator, server_id);
    defer allocator.free(server_id_escaped);

    try sql_buf.writer(allocator).print("DELETE FROM servers WHERE id = '{s}'", .{server_id_escaped});

    if (team_id) |tid| {
        const tid_escaped = try escapeSqlString(allocator, tid);
        defer allocator.free(tid_escaped);
        try sql_buf.writer(allocator).print(" AND (team_id = '{s}' OR (owner_type = 'team' AND owner_id = '{s}'))", .{ tid_escaped, tid_escaped });
    }

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    // Execute DELETE
    try query.execute(allocator, db, query_str);

    return server;
}

/// Server health data
pub const ServerHealthData = struct {
    status: ?[]const u8 = null,
    cpu: ?i64 = null,
    memory: ?i64 = null,
    disk: ?i64 = null,
    proxy_status: ?[]const u8 = null,
    agent_checksum: ?[]const u8 = null,
    agent_version: ?[]const u8 = null,
    agent_installed_at: ?i64 = null,
};

/// Update server health metrics and status
pub fn updateServerHealth(allocator: std.mem.Allocator, db: *sqlite.sqlite3, server_id: []const u8, data: ServerHealthData) !void {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const writer = sql_buf.writer(allocator);
    try writer.print("UPDATE servers SET", .{});
    var has_set = false;

    if (data.status) |val| {
        if (has_set) try writer.print(",", .{});
        const escaped = try escapeSqlString(allocator, val);
        defer allocator.free(escaped);
        try writer.print(" status = '{s}'", .{escaped});
        has_set = true;
    }
    if (data.cpu) |val| {
        if (has_set) try writer.print(",", .{});
        try writer.print(" health_cpu = {d}", .{val});
        has_set = true;
    }
    if (data.memory) |val| {
        if (has_set) try writer.print(",", .{});
        try writer.print(" health_memory = {d}", .{val});
        has_set = true;
    }
    if (data.disk) |val| {
        if (has_set) try writer.print(",", .{});
        try writer.print(" health_disk = {d}", .{val});
        has_set = true;
    }
    if (data.proxy_status) |val| {
        if (has_set) try writer.print(",", .{});
        const escaped = try escapeSqlString(allocator, val);
        defer allocator.free(escaped);
        try writer.print(" proxy_status = '{s}'", .{escaped});
        has_set = true;
    }
    if (data.agent_checksum) |val| {
        if (has_set) try writer.print(",", .{});
        const escaped = try escapeSqlString(allocator, val);
        defer allocator.free(escaped);
        try writer.print(" agent_checksum = '{s}'", .{escaped});
        has_set = true;
    }
    if (data.agent_version) |val| {
        if (has_set) try writer.print(",", .{});
        const escaped = try escapeSqlString(allocator, val);
        defer allocator.free(escaped);
        try writer.print(" agent_version = '{s}'", .{escaped});
        has_set = true;
    }
    if (data.agent_installed_at) |val| {
        if (has_set) try writer.print(",", .{});
        try writer.print(" agent_installed_at = {d}", .{val});
        has_set = true;
    }

    if (!has_set) return;

    try writer.print(", health_updated_at = unixepoch(), updated_at = unixepoch()", .{});

    const server_id_escaped = try escapeSqlString(allocator, server_id);
    defer allocator.free(server_id_escaped);
    try writer.print(" WHERE id = '{s}'", .{server_id_escaped});

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    try query.execute(allocator, db, query_str);
}

/// Simple SQL string escaping
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

/// Escape string for JSON
fn escapeJsonString(allocator: std.mem.Allocator, str: []const u8) ![]const u8 {
    var result = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer result.deinit(allocator);

    for (str) |char| {
        switch (char) {
            '"' => try result.writer(allocator).print("\\\"", .{}),
            '\\' => try result.writer(allocator).print("\\\\", .{}),
            '\n' => try result.writer(allocator).print("\\n", .{}),
            '\r' => try result.writer(allocator).print("\\r", .{}),
            '\t' => try result.writer(allocator).print("\\t", .{}),
            else => try result.append(allocator, char),
        }
    }

    return try result.toOwnedSlice(allocator);
}
