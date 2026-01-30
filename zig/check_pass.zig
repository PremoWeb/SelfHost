const std = @import("std");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const hash = "$argon2id$v=19$m=19456,t=2,p=1$ZLRnWO3I/EQkIVcGhk1fE2XBj1Tl4HnJrXlRJoUrNSI$w0rZLJ38zkthaJ6gINqL+3EWxdRl9YaWKLaeR7yI4LA";
    const password = "password123";

    std.crypto.pwhash.argon2.strVerify(hash, password, .{ .allocator = allocator }) catch |err| {
        std.debug.print("Verification failed: {any}\n", .{err});
        return;
    };
    std.debug.print("Verification successful!\n", .{});
}
