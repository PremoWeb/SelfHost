// Simple JSON Parser for Request Bodies
// Parses JSON request bodies into Zig structs

const std = @import("std");

const log = std.log.scoped(.json_parser);

/// Parse JSON request body (simplified - handles basic cases)
/// For full JSON parsing, consider using a library
pub fn parseJson(allocator: std.mem.Allocator, body: []const u8) !std.StringHashMap([]const u8) {
    var map = std.StringHashMap([]const u8).init(allocator);
    errdefer {
        var it = map.iterator();
        while (it.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        map.deinit();
    }
    
    // Simple JSON parser - handles basic key-value pairs
    // This is a simplified version - for production, use a proper JSON library
    var i: usize = 0;
    while (i < body.len) {
        // Skip whitespace
        while (i < body.len and std.ascii.isWhitespace(body[i])) i += 1;
        if (i >= body.len) break;
        
        // Find key (starts with ")
        if (body[i] != '"') {
            i += 1;
            continue;
        }
        i += 1; // Skip opening quote
        
        const key_start = i;
        while (i < body.len and body[i] != '"') i += 1;
        if (i >= body.len) break;
        
        const key = body[key_start..i];
        i += 1; // Skip closing quote
        
        // Skip whitespace and colon
        while (i < body.len and (std.ascii.isWhitespace(body[i]) or body[i] == ':')) i += 1;
        if (i >= body.len) break;
        
        // Find value
        const value_start = i;
        
        if (body[i] == '"') {
            // String value
            i += 1;
            while (i < body.len and body[i] != '"') {
                if (body[i] == '\\') i += 1; // Skip escaped characters
                i += 1;
            }
            if (i < body.len) i += 1; // Skip closing quote
            const value = body[value_start..i];
            const key_owned = try allocator.dupe(u8, key);
            const value_owned = try allocator.dupe(u8, value);
            try map.put(key_owned, value_owned);
        } else if (std.ascii.isDigit(body[i]) or body[i] == '-') {
            // Number value
            while (i < body.len and (std.ascii.isDigit(body[i]) or body[i] == '.' or body[i] == '-' or body[i] == '+' or body[i] == 'e' or body[i] == 'E')) i += 1;
            const value = body[value_start..i];
            const key_owned = try allocator.dupe(u8, key);
            const value_owned = try allocator.dupe(u8, value);
            try map.put(key_owned, value_owned);
        } else if (std.mem.startsWith(u8, body[i..], "true") or std.mem.startsWith(u8, body[i..], "false") or std.mem.startsWith(u8, body[i..], "null")) {
            // Boolean or null
            const end = if (std.mem.startsWith(u8, body[i..], "true"))
                i + 4
            else if (std.mem.startsWith(u8, body[i..], "false"))
                i + 5
            else
                i + 4;
            const value = body[value_start..end];
            i = end;
            const key_owned = try allocator.dupe(u8, key);
            const value_owned = try allocator.dupe(u8, value);
            try map.put(key_owned, value_owned);
        }
        
        // Skip comma
        while (i < body.len and (std.ascii.isWhitespace(body[i]) or body[i] == ',')) i += 1;
    }
    
    return map;
}

/// Extract string value from JSON map
pub fn getString(map: std.StringHashMap([]const u8), allocator: std.mem.Allocator, key: []const u8) !?[]const u8 {
    if (map.get(key)) |value| {
        // Remove quotes if present
        if (value.len >= 2 and value[0] == '"' and value[value.len - 1] == '"') {
            return try allocator.dupe(u8, value[1..(value.len - 1)]);
        }
        return try allocator.dupe(u8, value);
    }
    return null;
}

/// Extract integer value from JSON map
pub fn getInt(map: std.StringHashMap([]const u8), key: []const u8) !?i64 {
    if (map.get(key)) |value| {
        return std.fmt.parseInt(i64, value, 10) catch null;
    }
    return null;
}

/// Extract array of strings from JSON map (simplified)
pub fn getStringArray(allocator: std.mem.Allocator, map: std.StringHashMap([]const u8), key: []const u8) !?[]const []const u8 {
    if (map.get(key)) |value| {
        // Simple array parser - handles ["item1", "item2"]
        var items = std.ArrayList([]const u8).initCapacity(allocator, 0) catch return error.OutOfMemory;
        errdefer items.deinit(allocator);
        
        var i: usize = 0;
        while (i < value.len) {
            // Find string in array
            while (i < value.len and value[i] != '"') i += 1;
            if (i >= value.len) break;
            i += 1; // Skip opening quote
            
            const item_start = i;
            while (i < value.len and value[i] != '"') {
                if (value[i] == '\\') i += 1;
                i += 1;
            }
            if (i >= value.len) break;
            
            const item = value[item_start..i];
            const item_owned = try allocator.dupe(u8, item);
            try items.append(allocator, item_owned);
            i += 1; // Skip closing quote
            
            // Skip comma
            while (i < value.len and (std.ascii.isWhitespace(value[i]) or value[i] == ',')) i += 1;
        }
        
        return try items.toOwnedSlice(allocator);
    }
    return null;
}
