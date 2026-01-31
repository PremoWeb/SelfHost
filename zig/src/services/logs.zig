// Action Logs Service
// Queries the separate logging database (sqlite-logs.db) for action log entries

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const query = @import("../db/query.zig");

const log = std.log.scoped(.logs_service);

pub const LogFilters = struct {
    user_id: ?[]const u8 = null,
    action: ?[]const u8 = null,
    resource_type: ?[]const u8 = null,
    resource_id: ?[]const u8 = null,
    team_id: ?[]const u8 = null,
    company_id: ?[]const u8 = null,
    impersonated_by: ?[]const u8 = null,
    success: ?bool = null,
    start_date: ?[]const u8 = null,
    end_date: ?[]const u8 = null,
    page: u32 = 1,
    limit: u32 = 50,
};

pub const QueryResult = struct {
    items: std.ArrayList(std.StringHashMap([]const u8)),
    has_more: bool,

    pub fn deinit(self: *QueryResult, allocator: std.mem.Allocator) void {
        for (self.items.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        self.items.deinit(allocator);
    }
};

/// Initialize the logging database table and indexes (idempotent)
pub fn initializeLogsDb(db: *sqlite.sqlite3, allocator: std.mem.Allocator) void {
    const create_table =
        \\CREATE TABLE IF NOT EXISTS action_logs (
        \\  id TEXT PRIMARY KEY,
        \\  user_id TEXT NOT NULL,
        \\  user_email TEXT,
        \\  user_name TEXT,
        \\  impersonated_by TEXT,
        \\  impersonation_type TEXT,
        \\  impersonation_entity_id TEXT,
        \\  action TEXT NOT NULL,
        \\  resource_type TEXT,
        \\  resource_id TEXT,
        \\  method TEXT NOT NULL,
        \\  path TEXT NOT NULL,
        \\  ip_address TEXT,
        \\  user_agent TEXT,
        \\  team_id TEXT,
        \\  company_id TEXT,
        \\  metadata TEXT DEFAULT '{}',
        \\  request_body TEXT,
        \\  success INTEGER NOT NULL DEFAULT 1,
        \\  error_message TEXT,
        \\  created_at INTEGER NOT NULL DEFAULT (unixepoch())
        \\)
    ;

    query.execute(allocator, db, create_table) catch |err| {
        log.err("Failed to create action_logs table: {any}", .{err});
        return;
    };

    const indexes = [_][]const u8{
        "CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_action_logs_action ON action_logs(action)",
        "CREATE INDEX IF NOT EXISTS idx_action_logs_resource_type ON action_logs(resource_type)",
        "CREATE INDEX IF NOT EXISTS idx_action_logs_resource_id ON action_logs(resource_id)",
        "CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_action_logs_team_id ON action_logs(team_id)",
        "CREATE INDEX IF NOT EXISTS idx_action_logs_company_id ON action_logs(company_id)",
        "CREATE INDEX IF NOT EXISTS idx_action_logs_impersonated_by ON action_logs(impersonated_by)",
    };

    for (indexes) |idx_sql| {
        query.execute(allocator, db, idx_sql) catch |err| {
            log.err("Failed to create index: {any}", .{err});
        };
    }

    log.info("Logging database initialized", .{});
}

/// Query action logs with filters and pagination
pub fn queryLogs(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    filters: LogFilters,
) !QueryResult {
    // Build SQL dynamically with parameterized WHERE clauses
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);
    var writer = sql_buf.writer(allocator);

    var params = std.ArrayList([]const u8).initCapacity(allocator, 0) catch return error.OutOfMemory;
    defer params.deinit(allocator);

    try writer.print("SELECT * FROM action_logs", .{});

    var has_where = false;

    // Helper: append WHERE/AND + condition
    inline for (.{
        .{ "user_id", filters.user_id },
        .{ "action", filters.action },
        .{ "resource_type", filters.resource_type },
        .{ "resource_id", filters.resource_id },
        .{ "team_id", filters.team_id },
        .{ "company_id", filters.company_id },
        .{ "impersonated_by", filters.impersonated_by },
    }) |pair| {
        if (pair[1]) |val| {
            if (!has_where) {
                try writer.print(" WHERE {s} = ?", .{pair[0]});
                has_where = true;
            } else {
                try writer.print(" AND {s} = ?", .{pair[0]});
            }
            try params.append(allocator, val);
        }
    }

    // Success filter
    if (filters.success) |s| {
        if (!has_where) {
            try writer.print(" WHERE success = ?", .{});
            has_where = true;
        } else {
            try writer.print(" AND success = ?", .{});
        }
        try params.append(allocator, if (s) "1" else "0");
    }

    // Date filters using SQLite's strftime
    if (filters.start_date) |sd| {
        if (!has_where) {
            try writer.print(" WHERE created_at >= CAST(strftime('%s', ?) AS INTEGER)", .{});
            has_where = true;
        } else {
            try writer.print(" AND created_at >= CAST(strftime('%s', ?) AS INTEGER)", .{});
        }
        try params.append(allocator, sd);
    }
    if (filters.end_date) |ed| {
        if (!has_where) {
            try writer.print(" WHERE created_at < CAST(strftime('%s', ?, '+1 day') AS INTEGER)", .{});
            has_where = true;
        } else {
            try writer.print(" AND created_at < CAST(strftime('%s', ?, '+1 day') AS INTEGER)", .{});
        }
        try params.append(allocator, ed);
    }

    // Order and pagination
    const effective_limit = @min(filters.limit, 100);
    const offset = (@as(u64, filters.page) - 1) * @as(u64, effective_limit);
    // Fetch limit+1 to determine has_more
    const fetch_limit = @as(u64, effective_limit) + 1;

    const limit_str = try std.fmt.allocPrint(allocator, "{d}", .{fetch_limit});
    defer allocator.free(limit_str);
    const offset_str = try std.fmt.allocPrint(allocator, "{d}", .{offset});
    defer allocator.free(offset_str);

    try writer.print(" ORDER BY created_at DESC LIMIT ? OFFSET ?", .{});
    try params.append(allocator, limit_str);
    try params.append(allocator, offset_str);

    const sql_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(sql_str);

    log.debug("Logs query: {s} (params: {d})", .{ sql_str, params.items.len });

    var rows = try query.queryAllWithParams(allocator, db, sql_str, params.items);

    // Determine has_more and trim to effective_limit
    const has_more = rows.items.len > effective_limit;
    if (has_more) {
        // Free the extra row
        var extra = rows.items[effective_limit];
        var it = extra.iterator();
        while (it.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        extra.deinit();
        rows.shrinkRetainingCapacity(effective_limit);
    }

    return QueryResult{
        .items = rows,
        .has_more = has_more,
    };
}
