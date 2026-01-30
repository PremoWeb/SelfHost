// Permissions and Authorization
// Ports the permissions system from the original server

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");
const session = @import("session.zig");

const log = std.log.scoped(.permissions);

/// Check if a user is God (first user, overrules everything)
pub fn isGod(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !bool {
    if (user_id.len == 0) return false;
    
    const user = try session.getUserById(allocator, db, user_id);
    if (user) |u| {
        defer u.deinit(allocator);
        return u.is_god;
    }
    
    return false;
}

/// Check if a user is a company owner
pub fn isCompanyOwner(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8, company_id: []const u8) !bool {
    var sql_buf = std.ArrayList(u8).init(allocator);
    defer sql_buf.deinit();
    
    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);
    const company_id_escaped = try escapeSqlString(allocator, company_id);
    defer allocator.free(company_id_escaped);
    
    try sql_buf.writer().print(
        "SELECT * FROM company_members WHERE user_id = '{s}' AND company_id = '{s}' AND role = 'owner' LIMIT 1",
        .{ user_id_escaped, company_id_escaped },
    );
    
    const query_str = try sql_buf.toOwnedSlice();
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
    
    return rows.items.len > 0;
}

/// Check if a user is a company admin
pub fn isCompanyAdmin(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8, company_id: []const u8) !bool {
    var sql_buf = std.ArrayList(u8).init(allocator);
    defer sql_buf.deinit();
    
    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);
    const company_id_escaped = try escapeSqlString(allocator, company_id);
    defer allocator.free(company_id_escaped);
    
    try sql_buf.writer().print(
        "SELECT * FROM company_members WHERE user_id = '{s}' AND company_id = '{s}' AND role IN ('owner', 'admin') LIMIT 1",
        .{ user_id_escaped, company_id_escaped },
    );
    
    const query_str = try sql_buf.toOwnedSlice();
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
    
    return rows.items.len > 0;
}

/// Simple SQL string escaping
fn escapeSqlString(allocator: std.mem.Allocator, str: []const u8) ![]const u8 {
    var result = std.ArrayList(u8).init(allocator);
    errdefer result.deinit();
    
    for (str) |char| {
        switch (char) {
            '\'' => try result.writer().print("''", .{}),
            '\\' => try result.writer().print("\\\\", .{}),
            else => try result.append(char),
        }
    }
    
    return try result.toOwnedSlice();
}
