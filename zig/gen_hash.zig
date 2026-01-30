const std = @import("std");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const password = "password123";
    var hash_buf: [128]u8 = undefined;
    const hash = try std.crypto.pwhash.argon2.strHash(password, .{
        .allocator = allocator,
        .params = std.crypto.pwhash.argon2.Params.owasp_2id,
    }, &hash_buf);
    
    std.debug.print("{s}\n", .{hash});
}
