// Request Body Utilities
// Helper functions for reading and parsing request bodies from Zap

const std = @import("std");
const zap = @import("zap");

const log = std.log.scoped(.request_body);

/// Get request body as a slice
/// Zap's Request has a body field that may need parsing
pub fn getRequestBody(r: zap.Request) ?[]const u8 {
    // Zap Request has body: ?[]const u8 field
    // But it may need to be parsed first
    if (r.body) |body| {
        return body;
    }
    
    // Try parsing the body if it's not available
    r.parseBody() catch {
        return null;
    };
    
    return r.body;
}

/// Read request body into an allocated buffer
pub fn readRequestBody(allocator: std.mem.Allocator, r: zap.Request) ![]const u8 {
    if (getRequestBody(r)) |body| {
        return try allocator.dupe(u8, body);
    }

    // If body is not available, return empty string
    return try allocator.dupe(u8, "");
}
