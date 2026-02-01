const std = @import("std");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 3) {
        std.debug.print("Usage: {s} <dir_path> <output_file>\n", .{args[0]});
        std.process.exit(1);
    }

    const dir_path = args[1];
    const output_path = args[2];

    var out_file = try std.fs.cwd().createFile(output_path, .{});
    defer out_file.close();
    var writer = out_file.writer();

    try writer.writeAll("const std = @import(\"std\");\n\n");
    try writer.writeAll("pub fn get(path: []const u8) ?[]const u8 {\n");

    // We'll use a big if-else or a StaticStringMap if we want to be fancy.
    // For now, let's collect all files.
    var files = std.ArrayList(struct { path: []const u8, full_path: []const u8 }).init(allocator);
    defer {
        for (files.items) |f| {
            allocator.free(f.path);
            allocator.free(f.full_path);
        }
        files.deinit();
    }

    var dir = try std.fs.cwd().openDir(dir_path, .{ .iterate = true });
    defer dir.close();

    var walker = try dir.walk(allocator);
    defer walker.deinit();

    while (try walker.next()) |entry| {
        if (entry.kind == .file) {
            const rel_path = try allocator.dupe(u8, entry.path);
            // Replace backslashes for Windows compatibility just in case, though target is Linux
            for (rel_path) |*c| if (c.* == '\\') {
                c.* = '/';
            };

            const full_path = try std.fs.path.join(allocator, &.{ dir_path, entry.path });
            try files.append(.{ .path = rel_path, .full_path = full_path });
        }
    }

    for (files.items) |f| {
        try writer.print("    if (std.mem.eql(u8, path, \"{s}\")) return @embedFile(\"{s}\");\n", .{ f.path, f.full_path });
    }

    try writer.writeAll("    return null;\n");
    try writer.writeAll("}\n");
}
