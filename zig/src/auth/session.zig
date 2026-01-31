// Session Management
// Ports the session validation and user context from the original server

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");

const log = std.log.scoped(.session);

pub const Session = struct {
    id: []const u8,
    user_id: []const u8,
    token: []const u8,
    expires_at: i64,
    active_team_id: ?[]const u8,
    active_company_id: ?[]const u8,
    impersonated_by: ?[]const u8,

    pub fn deinit(self: *Session, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.user_id);
        allocator.free(self.token);
        if (self.active_team_id) |tid| allocator.free(tid);
        if (self.active_company_id) |cid| allocator.free(cid);
        if (self.impersonated_by) |ib| allocator.free(ib);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !Session {
        return Session{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .user_id = try allocator.dupe(u8, row.get("user_id") orelse return error.MissingField),
            .token = try allocator.dupe(u8, row.get("token") orelse return error.MissingField),
            .expires_at = std.fmt.parseInt(i64, row.get("expires_at") orelse "0", 10) catch 0,
            .active_team_id = if (row.get("active_team_id")) |tid| try allocator.dupe(u8, tid) else null,
            .active_company_id = if (row.get("active_company_id")) |cid| try allocator.dupe(u8, cid) else null,
            .impersonated_by = if (row.get("impersonated_by")) |ib| try allocator.dupe(u8, ib) else null,
        };
    }

    pub fn isExpired(self: *const Session) bool {
        const now = std.time.timestamp();
        return self.expires_at < now;
    }
};

pub const User = struct {
    id: []const u8,
    name: []const u8,
    email: []const u8,
    email_verified: bool,
    is_god: bool,
    image: ?[]const u8,

    pub fn deinit(self: *User, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
        allocator.free(self.email);
        if (self.image) |img| allocator.free(img);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !User {
        const is_god_str = row.get("is_god") orelse "0";
        const is_god = std.mem.eql(u8, is_god_str, "1") or std.mem.eql(u8, is_god_str, "true");

        const email_verified_str = row.get("email_verified") orelse "0";
        const email_verified = std.mem.eql(u8, email_verified_str, "1") or std.mem.eql(u8, email_verified_str, "true");

        return User{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField),
            .email = try allocator.dupe(u8, row.get("email") orelse return error.MissingField),
            .email_verified = email_verified,
            .is_god = is_god,
            .image = if (row.get("image")) |img| try allocator.dupe(u8, img) else null,
        };
    }
};

/// Get session by token from Authorization header
pub fn getSessionByToken(allocator: std.mem.Allocator, db: *sqlite.sqlite3, token: []const u8) !?Session {
    // Extract token from "Bearer <token>" format
    const actual_token = if (std.mem.startsWith(u8, token, "Bearer "))
        token["Bearer ".len..]
    else
        token;

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    // Escape token for SQL (in production, use parameterized queries)
    const token_escaped = try escapeSqlString(allocator, actual_token);
    defer allocator.free(token_escaped);

    try sql_buf.writer(allocator).print("SELECT * FROM session WHERE token = '{s}' LIMIT 1", .{token_escaped});
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
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return null;

    const session = try Session.fromRow(allocator, rows.items[0]);
    return session;
}

/// Get user by ID
pub fn getUserById(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !?User {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);

    try sql_buf.writer(allocator).print("SELECT * FROM users WHERE id = '{s}' LIMIT 1", .{user_id_escaped});
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
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return null;

    const user = try User.fromRow(allocator, rows.items[0]);
    return user;
}

/// List users (God only); returns up to limit users ordered by created_at ASC
pub fn getUsersList(allocator: std.mem.Allocator, db: *sqlite.sqlite3, limit: u32) !std.ArrayList(User) {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 128) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);
    try sql_buf.writer(allocator).print("SELECT * FROM users ORDER BY created_at ASC LIMIT {d}", .{limit});
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
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }

    var list = std.ArrayList(User).initCapacity(allocator, rows.items.len) catch return error.OutOfMemory;
    for (rows.items) |row| {
        const user = try User.fromRow(allocator, row);
        try list.append(allocator, user);
    }
    return list;
}

/// Get password hash from account table for a user
pub fn getAccountPassword(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !?[]const u8 {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);

    try sql_buf.writer(allocator).print("SELECT password FROM account WHERE user_id = '{s}' AND provider_id = 'credential' LIMIT 1", .{user_id_escaped});
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
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return null;

    const password = rows.items[0].get("password") orelse return null;
    return try allocator.dupe(u8, password);
}

/// Verify a password against a hash using Argon2
pub fn verifyPassword(allocator: std.mem.Allocator, hash_str: []const u8, password: []const u8) bool {
    std.crypto.pwhash.argon2.strVerify(hash_str, password, .{ .allocator = allocator }) catch |err| {
        log.warn("Password verification failed: {any}", .{err});
        return false;
    };
    return true;
}

/// Update the active team for a session
pub fn updateSessionTeam(allocator: std.mem.Allocator, db: *sqlite.sqlite3, session_id: []const u8, team_id: ?[]const u8) !void {
    const session_id_escaped = try escapeSqlString(allocator, session_id);
    defer allocator.free(session_id_escaped);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    if (team_id) |tid| {
        const tid_escaped = try escapeSqlString(allocator, tid);
        defer allocator.free(tid_escaped);
        try sql_buf.writer(allocator).print("UPDATE session SET active_team_id = '{s}', updated_at = unixepoch() WHERE id = '{s}'", .{ tid_escaped, session_id_escaped });
    } else {
        try sql_buf.writer(allocator).print("UPDATE session SET active_team_id = NULL, updated_at = unixepoch() WHERE id = '{s}'", .{session_id_escaped});
    }

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    try query.execute(allocator, db, query_str);
}

/// Create a new session for a user
pub fn createSession(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !Session {
    const id = try generateUuid(allocator);
    const token = try generateToken(allocator);
    const expires_at = std.time.timestamp() + (30 * 24 * 60 * 60); // 30 days

    // Get default team_id for user
    const team_id = try getDefaultTeamId(allocator, db, user_id);
    defer if (team_id) |tid| allocator.free(tid);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);
    const id_escaped = try escapeSqlString(allocator, id);
    defer allocator.free(id_escaped);
    const token_escaped = try escapeSqlString(allocator, token);
    defer allocator.free(token_escaped);

    if (team_id) |tid| {
        const tid_escaped = try escapeSqlString(allocator, tid);
        defer allocator.free(tid_escaped);
        try sql_buf.writer(allocator).print("INSERT INTO session (id, user_id, token, expires_at, active_team_id, created_at) VALUES ('{s}', '{s}', '{s}', {d}, '{s}', unixepoch())", .{ id_escaped, user_id_escaped, token_escaped, expires_at, tid_escaped });
    } else {
        try sql_buf.writer(allocator).print("INSERT INTO session (id, user_id, token, expires_at, created_at) VALUES ('{s}', '{s}', '{s}', {d}, unixepoch())", .{ id_escaped, user_id_escaped, token_escaped, expires_at });
    }

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    try query.execute(allocator, db, query_str);

    return Session{
        .id = id,
        .user_id = try allocator.dupe(u8, user_id),
        .token = token,
        .expires_at = expires_at,
        .active_team_id = if (team_id) |tid| try allocator.dupe(u8, tid) else null,
        .active_company_id = null,
        .impersonated_by = null,
    };
}

fn generateUuid(allocator: std.mem.Allocator) ![]const u8 {
    var bytes: [16]u8 = undefined;
    std.crypto.random.bytes(&bytes);
    // Rough UUID v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return try std.fmt.allocPrint(allocator, "{x:0>2}{x:0>2}{x:0>2}{x:0>2}-{x:0>2}{x:0>2}-{x:0>2}{x:0>2}-{x:0>2}{x:0>2}-{x:0>2}{x:0>2}{x:0>2}{x:0>2}{x:0>2}{x:0>2}", .{
        bytes[0],  bytes[1],  bytes[2],  bytes[3],
        bytes[4],  bytes[5],  bytes[6],  bytes[7],
        bytes[8],  bytes[9],  bytes[10], bytes[11],
        bytes[12], bytes[13], bytes[14], bytes[15],
    });
}

fn generateToken(allocator: std.mem.Allocator) ![]const u8 {
    var bytes: [32]u8 = undefined;
    std.crypto.random.bytes(&bytes);
    const hex = std.fmt.bytesToHex(bytes, .lower);
    return try allocator.dupe(u8, &hex);
}

fn getDefaultTeamId(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !?[]const u8 {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);

    try sql_buf.writer(allocator).print("SELECT team_id FROM team_members WHERE user_id = '{s}' LIMIT 1", .{user_id_escaped});
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
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return null;
    return try allocator.dupe(u8, rows.items[0].get("team_id") orelse return null);
}

/// Clear impersonation for a session (return to real user / God mode)
pub fn clearImpersonation(allocator: std.mem.Allocator, db: *sqlite.sqlite3, session_id: []const u8) !void {
    const session_id_escaped = try escapeSqlString(allocator, session_id);
    defer allocator.free(session_id_escaped);
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);
    try sql_buf.writer(allocator).print(
        "UPDATE session SET impersonated_by = NULL, updated_at = unixepoch() WHERE id = '{s}'",
        .{session_id_escaped},
    );
    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);
    try query.execute(allocator, db, query_str);
}

/// Reset account password
pub fn resetPassword(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8, new_password: []const u8) !void {
    var hash_buf: [128]u8 = undefined;
    const hash = try std.crypto.pwhash.argon2.strHash(new_password, .{
        .allocator = allocator,
        .params = std.crypto.pwhash.argon2.Params.owasp_2id,
    }, &hash_buf);

    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);
    const hash_escaped = try escapeSqlString(allocator, hash);
    defer allocator.free(hash_escaped);

    try sql_buf.writer(allocator).print("UPDATE account SET password = '{s}', updated_at = unixepoch() WHERE user_id = '{s}' AND provider_id = 'credential'", .{ hash_escaped, user_id_escaped });

    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    try query.execute(allocator, db, query_str);
}

/// Extract session token from request headers
pub fn extractTokenFromHeaders(allocator: std.mem.Allocator, headers: anytype) !?[]const u8 {
    // Try Authorization header
    if (headers.get("authorization")) |auth_header| {
        if (std.mem.startsWith(u8, auth_header, "Bearer ")) {
            const token = auth_header["Bearer ".len..];
            return try allocator.dupe(u8, token);
        }
    }

    // Try cookie (session cookie name is 'session')
    const cookie_header = headers.get("cookie") orelse headers.get("Cookie") orelse {
        log.warn("No cookie header found", .{});
        return null;
    };
    // Parse cookie string for session token
    var cookies = std.mem.splitSequence(u8, cookie_header, ";");
    while (cookies.next()) |cookie| {
        const trimmed = std.mem.trim(u8, cookie, " ");
        if (std.mem.startsWith(u8, trimmed, "session=")) {
            const token = trimmed["session=".len..];
            return try allocator.dupe(u8, token);
        }
        if (std.mem.startsWith(u8, trimmed, "better-auth.session_token=")) {
            const token = trimmed["better-auth.session_token=".len..];
            return try allocator.dupe(u8, token);
        }
    }
    log.warn("No session cookie found. Cookie header: {s}", .{cookie_header});
    return null;
}

/// Simple SQL string escaping (for now - should use parameterized queries in production)
fn escapeSqlString(allocator: std.mem.Allocator, str: []const u8) ![]const u8 {
    var result = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer result.deinit(allocator);

    for (str) |char| {
        switch (char) {
            '\'' => try result.writer(allocator).print("''", .{}), // SQL escape single quote
            '\\' => try result.writer(allocator).print("\\\\", .{}),
            else => try result.append(allocator, char),
        }
    }

    return try result.toOwnedSlice(allocator);
}
