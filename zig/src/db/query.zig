// SQLite Query Helpers
// Provides convenient functions for common database operations

const std = @import("std");
const sqlite = @import("sqlite.zig").sqlite;

const log = std.log.scoped(.query);

pub const QueryError = error{
    PrepareFailed,
    ExecuteFailed,
    NoRows,
    InvalidData,
    NotImplemented,
    MissingField,
    OutOfMemory,
};

/// Execute a query and return all rows as JSON-compatible maps
pub fn queryAll(allocator: std.mem.Allocator, db: *sqlite.sqlite3, sql_str: []const u8) QueryError!std.ArrayList(std.StringHashMap([]const u8)) {
    var results = std.ArrayList(std.StringHashMap([]const u8)).initCapacity(allocator, 0) catch return error.OutOfMemory;
    errdefer {
        for (results.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        results.deinit(allocator);
    }

    var stmt: ?*sqlite.sqlite3_stmt = null;
    const rc = sqlite.sqlite3_prepare_v2(db, sql_str.ptr, @intCast(sql_str.len), &stmt, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Failed to prepare query: {s}", .{sqlite.sqlite3_errmsg(db)});
        return QueryError.PrepareFailed;
    }
    defer _ = sqlite.sqlite3_finalize(stmt);

    while (true) {
        const step_rc = sqlite.sqlite3_step(stmt);
        if (step_rc == sqlite.SQLITE_DONE) break;
        if (step_rc != sqlite.SQLITE_ROW) {
            log.err("Failed to step query: {s}", .{sqlite.sqlite3_errmsg(db)});
            return QueryError.ExecuteFailed;
        }

        var row = std.StringHashMap([]const u8).init(allocator);
        errdefer {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }

        const col_count = sqlite.sqlite3_column_count(stmt);
        for (0..@intCast(col_count)) |i| {
            const col_name = sqlite.sqlite3_column_name(stmt, @intCast(i));
            const col_name_len = std.mem.len(col_name);
            const col_name_owned = try allocator.dupe(u8, col_name[0..col_name_len]);

            const col_type = sqlite.sqlite3_column_type(stmt, @intCast(i));
            const col_value: []const u8 = switch (col_type) {
                sqlite.SQLITE_NULL => "",
                sqlite.SQLITE_INTEGER => blk: {
                    const val = sqlite.sqlite3_column_int64(stmt, @intCast(i));
                    const val_str = try std.fmt.allocPrint(allocator, "{d}", .{val});
                    break :blk val_str;
                },
                sqlite.SQLITE_FLOAT => blk: {
                    const val = sqlite.sqlite3_column_double(stmt, @intCast(i));
                    const val_str = try std.fmt.allocPrint(allocator, "{d}", .{val});
                    break :blk val_str;
                },
                sqlite.SQLITE_TEXT => blk: {
                    const text = sqlite.sqlite3_column_text(stmt, @intCast(i));
                    const text_len = sqlite.sqlite3_column_bytes(stmt, @intCast(i));
                    break :blk try allocator.dupe(u8, text[0..@intCast(text_len)]);
                },
                sqlite.SQLITE_BLOB => blk: {
                    const blob = sqlite.sqlite3_column_blob(stmt, @intCast(i));
                    const blob_len = sqlite.sqlite3_column_bytes(stmt, @intCast(i));
                    const blob_ptr = @as([*]const u8, @ptrCast(blob));
                    break :blk try allocator.dupe(u8, blob_ptr[0..@intCast(blob_len)]);
                },
                else => "",
            };

            try row.put(col_name_owned, col_value);
        }

        try results.append(allocator, row);
    }

    return results;
}

/// Execute a query and return a single row
pub fn queryOne(allocator: std.mem.Allocator, db: *sqlite.sqlite3, sql_str: []const u8) QueryError!?std.StringHashMap([]const u8) {
    var results = try queryAll(allocator, db, sql_str);
    defer {
        for (results.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        results.deinit(allocator);
    }

    if (results.items.len == 0) return null;
    if (results.items.len > 1) {
        log.warn("queryOne returned multiple rows, returning first", .{});
    }

    // Return the first row (caller must free it)
    return results.items[0];
}

/// Execute a query with parameters
pub fn queryAllWithParams(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    sql_str: []const u8,
    params: []const []const u8,
) QueryError!std.ArrayList(std.StringHashMap([]const u8)) {
    var stmt: ?*sqlite.sqlite3_stmt = null;
    const rc = sqlite.sqlite3_prepare_v2(db, sql_str.ptr, @intCast(sql_str.len), &stmt, null);
    if (rc != sqlite.SQLITE_OK) {
        log.err("Failed to prepare query: {s}", .{sqlite.sqlite3_errmsg(db)});
        return QueryError.PrepareFailed;
    }
    defer _ = sqlite.sqlite3_finalize(stmt);

    // Bind parameters
    for (params, 0..) |param, i| {
        const param_z = try std.fmt.allocPrintZ(allocator, "{s}", .{param});
        defer allocator.free(param_z);
        _ = sqlite.sqlite3_bind_text(stmt, @intCast(i + 1), param_z.ptr, @intCast(param.len), sqlite.SQLITE_TRANSIENT);
    }

    // Execute and collect results (reuse queryAll logic)
    // For now, use a simpler approach
    // For parameterized queries, we'd need to prepare and bind
    // For now, return error - can be implemented when needed
    // Statement is prepared and parameters are bound, but not executed yet
    return QueryError.NotImplemented;
}

/// Execute a non-query statement (INSERT, UPDATE, DELETE)
pub fn execute(allocator: std.mem.Allocator, db: *sqlite.sqlite3, sql_str: []const u8) QueryError!void {
    _ = allocator;
    var err_msg: [*c][*c]u8 = null;
    const rc = sqlite.sqlite3_exec(db, sql_str.ptr, null, null, @ptrCast(&err_msg));
    
    if (rc != sqlite.SQLITE_OK) {
        const err = if (err_msg) |msg| blk: {
            const err_str = std.mem.span(@as([*c]const u8, @ptrCast(msg)));
            sqlite.sqlite3_free(@as(?*anyopaque, @ptrCast(msg)));
            break :blk err_str;
        } else "Unknown error";
        log.err("Failed to execute query: {s}", .{err});
        return QueryError.ExecuteFailed;
    }
    
    if (err_msg) |msg| sqlite.sqlite3_free(@as(?*anyopaque, @ptrCast(msg)));
}
