const std = @import("std");
const database = @import("src/db/database.zig");
const query = @import("src/db/query.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var db = try database.openFromEnv(allocator);
    defer db.deinit();

    const email = "nick@premoweb.com";
    
    // Simulate escape
    var escaped = std.ArrayList(u8).initCapacity(allocator, email.len + 2) catch return;
    defer escaped.deinit(allocator);
    for (email) |c| {
        if (c == '\'') _ = try escaped.append(allocator, '\'');
        _ = try escaped.append(allocator, c);
    }
    
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return;
    defer sql_buf.deinit(allocator);
    try sql_buf.writer(allocator).print("SELECT * FROM users WHERE email = '{s}' LIMIT 1", .{escaped.items});
    
    const query_str = sql_buf.items;
    std.debug.print("Query: {s}\n", .{query_str});
    
    var rows = try query.queryAll(allocator, db.getConnection(), query_str);
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
    
    if (rows.items.len > 0) {
        std.debug.print("Found user!\n", .{});
        std.debug.print("Email: {s}\n", .{rows.items[0].get("email").?});
    } else {
        std.debug.print("User not found!\n", .{});
    }
}
