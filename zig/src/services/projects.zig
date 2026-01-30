// Projects Service
// Ports project-related database operations from the original server

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");

const log = std.log.scoped(.projects);

pub const Project = struct {
    id: []const u8,
    name: []const u8,
    description: ?[]const u8,
    team_id: ?[]const u8,
    client_id: ?[]const u8,
    category_id: ?[]const u8,
    billing_profile_id: ?[]const u8,
    company_id: ?[]const u8,
    created_at: i64,
    updated_at: i64,
    
    pub fn deinit(self: *Project, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.name);
        if (self.description) |d| allocator.free(d);
        if (self.team_id) |t| allocator.free(t);
        if (self.client_id) |c| allocator.free(c);
        if (self.category_id) |c| allocator.free(c);
        if (self.billing_profile_id) |b| allocator.free(b);
        if (self.company_id) |c| allocator.free(c);
    }
    
    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !Project {
        return Project{
            .id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField),
            .name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField),
            .description = if (row.get("description")) |d| try allocator.dupe(u8, d) else null,
            .team_id = if (row.get("team_id")) |t| try allocator.dupe(u8, t) else null,
            .client_id = if (row.get("client_id")) |c| try allocator.dupe(u8, c) else null,
            .category_id = if (row.get("category_id")) |c| try allocator.dupe(u8, c) else null,
            .billing_profile_id = if (row.get("billing_profile_id")) |b| try allocator.dupe(u8, b) else null,
            .company_id = if (row.get("company_id")) |c| try allocator.dupe(u8, c) else null,
            .created_at = std.fmt.parseInt(i64, row.get("created_at") orelse "0", 10) catch 0,
            .updated_at = std.fmt.parseInt(i64, row.get("updated_at") orelse "0", 10) catch 0,
        };
    }
};

/// Get all projects (no team filter) — for God mode
pub fn getAllProjects(allocator: std.mem.Allocator, db: *sqlite.sqlite3) !std.ArrayList(Project) {
    const query_str = "SELECT * FROM projects ORDER BY created_at DESC";
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
    var projects = std.ArrayList(Project).initCapacity(allocator, 0) catch return error.OutOfMemory;
    errdefer {
        for (projects.items) |*p| {
            p.deinit(allocator);
        }
        projects.deinit(allocator);
    }
    for (rows.items) |row| {
        const project = try Project.fromRow(allocator, row);
        errdefer @constCast(&project).deinit(allocator);
        try projects.append(allocator, project);
    }
    return projects;
}

/// Get all projects for a team
/// Includes owned projects, team-assigned projects, and shared projects
pub fn getProjectsByTeam(allocator: std.mem.Allocator, db: *sqlite.sqlite3, team_id: ?[]const u8) !std.ArrayList(Project) {
    if (team_id == null) {
        return std.ArrayList(Project).initCapacity(allocator, 0) catch return error.OutOfMemory;
    }
    
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);
    
    const team_id_escaped = try escapeSqlString(allocator, team_id.?);
    defer allocator.free(team_id_escaped);
    
    // Simplified query - get projects by team_id (backward compatibility)
    // TODO: Add support for project assignments and shared projects
    try sql_buf.writer(allocator).print(
        "SELECT * FROM projects WHERE team_id = '{s}' ORDER BY created_at DESC",
        .{team_id_escaped},
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
    
    var projects = std.ArrayList(Project).initCapacity(allocator, 0) catch return error.OutOfMemory;
    errdefer {
        for (projects.items) |*p| {
            p.deinit(allocator);
        }
        projects.deinit(allocator);
    }
    
    for (rows.items) |row| {
        const project = try Project.fromRow(allocator, row);
        errdefer @constCast(&project).deinit(allocator);
        try projects.append(allocator, project);
    }
    
    return projects;
}

/// Get project by ID
pub fn getProjectById(allocator: std.mem.Allocator, db: *sqlite.sqlite3, project_id: []const u8, team_id: ?[]const u8) !?Project {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);
    
    const project_id_escaped = try escapeSqlString(allocator, project_id);
    defer allocator.free(project_id_escaped);
    
    if (team_id) |tid| {
        const team_id_escaped = try escapeSqlString(allocator, tid);
        defer allocator.free(team_id_escaped);
        
        try sql_buf.writer(allocator).print(
            "SELECT * FROM projects WHERE id = '{s}' AND team_id = '{s}' LIMIT 1",
            .{ project_id_escaped, team_id_escaped },
        );
    } else {
        try sql_buf.writer(allocator).print(
            "SELECT * FROM projects WHERE id = '{s}' LIMIT 1",
            .{project_id_escaped},
        );
    }
    
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
    
    const project = try Project.fromRow(allocator, rows.items[0]);
    return project;
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
