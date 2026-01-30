const std = @import("std");

pub fn main() !void {
    const password = "password123";
    const salt: [16]u8 = [_]u8{1} ** 16;
    var hash: [32]u8 = undefined;
    
    try std.crypto.pwhash.argon2.strHash(&hash, password, .{
        .salt = &salt,
        .params = std.crypto.pwhash.argon2.Params.interactive,
    });
    
    std.debug.print("Hash: {any}\n", .{hash});
}
