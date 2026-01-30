// Companies Service
// Ports company-related database operations from the original server

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");
const permissions = @import("../auth/permissions.zig");

const log = std.log.scoped(.companies);

pub const Company = struct {
    id: []const u8,
    name: []const u8,
    description: ?[]const u8,
    slug: []const u8,
    created_by: []const u8,
    billing_profile_id: ?[]const u8,
    settings: []const u8, // JSON string
    created_at: i64,
    updated_at: i64,
    
    pub fn deinit(self: *Company, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
        if (self.description) |d| allocator.free(d);
        allocator.free(self.slug);
        allocator.free(self.created_by);
        if (self.billing_profile_id) |b| allocator.free(b);
        allocator.free(self.settings);
    }
    
    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !Company {
        return Company{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField),
            .description = if (row.get("description")) |d| try allocator.dupe(u8, d) else null,
            .slug = try allocator.dupe(u8, row.get("slug") orelse return error.MissingField),
            .created_by = try allocator.dupe(u8, row.get("created_by") orelse return error.MissingField),
            .billing_profile_id = if (row.get("billing_profile_id")) |b| try allocator.dupe(u8, b) else null,
            .settings = try allocator.dupe(u8, row.get("settings") orelse "{}"),
            .created_at = std.fmt.parseInt(i64, row.get("created_at") orelse "0", 10) catch 0,
            .updated_at = std.fmt.parseInt(i64, row.get("updated_at") orelse "0", 10) catch 0,
        };
    }
};

/// Get all companies (God users only)
pub fn getAllCompanies(allocator: std.mem.Allocator, db: *sqlite.sqlite3) !std.ArrayList(Company) {
    const query_str = "SELECT * FROM companies ORDER BY created_at ASC";
    
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
    
    var companies = std.ArrayList(Company).initCapacity(allocator, 0) catch return error.OutOfMemory;
    errdefer {
        for (companies.items) |*c| {
            c.deinit(allocator);
        }
        companies.deinit(allocator);
    }
    
    for (rows.items) |row| {
        const company = try Company.fromRow(allocator, row);
        errdefer @constCast(&company).deinit(allocator);
        try companies.append(allocator, company);
    }
    
    return companies;
}

/// Get companies for a specific user
pub fn getCompaniesForUser(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !std.ArrayList(Company) {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);
    
    const user_id_escaped = try escapeSqlString(allocator, user_id);
    defer allocator.free(user_id_escaped);
    
    try sql_buf.writer(allocator).print(
        \\SELECT DISTINCT c.*
        \\FROM companies c
        \\JOIN company_members cm ON c.id = cm.company_id
        \\WHERE cm.user_id = '{s}'
        \\ORDER BY c.created_at ASC
    , .{user_id_escaped});
    
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
    
    var companies = std.ArrayList(Company).initCapacity(allocator, 0) catch return error.OutOfMemory;
    errdefer {
        for (companies.items) |*c| {
            c.deinit(allocator);
        }
        companies.deinit(allocator);
    }
    
    for (rows.items) |row| {
        const company = try Company.fromRow(allocator, row);
        errdefer @constCast(&company).deinit(allocator);
        try companies.append(allocator, company);
    }
    
    return companies;
}

/// Get default company for resource assignment
pub fn getDefaultCompanyForResource(allocator: std.mem.Allocator, db: *sqlite.sqlite3) !?[]const u8 {
    const query_str = "SELECT id FROM companies ORDER BY created_at ASC LIMIT 1";
    
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
    
    const company_id = rows.items[0].get("id") orelse return null;
    return try allocator.dupe(u8, company_id);
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
