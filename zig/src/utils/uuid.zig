// UUID Generation
// Generates UUID v4 strings compatible with the original crypto.randomUUID()

const std = @import("std");

/// Generate a UUID v4 string
pub fn generateUUID(allocator: std.mem.Allocator) ![]const u8 {
    var prng = std.Random.DefaultPrng.init(@intCast(std.time.milliTimestamp()));
    const random = prng.random();
    
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where x is any hexadecimal digit and y is one of 8, 9, A, or B
    var uuid_buf: [36]u8 = undefined;
    
    // Generate random bytes
    var bytes: [16]u8 = undefined;
    random.bytes(&bytes);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    
    // Format as UUID string (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const hex = "0123456789abcdef";
    var i: usize = 0;
    for (bytes, 0..) |b, j| {
        if (j == 4 or j == 6 or j == 8 or j == 10) {
            uuid_buf[i] = '-';
            i += 1;
        }
        uuid_buf[i] = hex[b >> 4];
        uuid_buf[i + 1] = hex[b & 0x0f];
        i += 2;
    }
    
    return try allocator.dupe(u8, &uuid_buf);
}
