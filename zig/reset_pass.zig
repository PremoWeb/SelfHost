const std = @import("std");
const database = @import("src/db/database.zig");
const session = @import("src/auth/session.zig");
const router = @import("src/router.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Set up context for router/database if needed
    var db = try database.openFromEnv(allocator);
    defer db.deinit();

    const email = "nick@premoweb.com";
    const new_password = "password123";

    // Get user_id by email
    const user_id = "Z6AWKJh3bm2iNTTZyHiAiBi0wGtnC0Wo";
    
    std.debug.print("Resetting password for {s} (id: {s})...\n", .{email, user_id});
    
    try session.resetPassword(allocator, db.getConnection(), user_id, new_password);
    
    std.debug.print("Password successfully reset to: {s}\n", .{new_password});
}
