// Vultr API client — HTTP GET to api.vultr.com/v2 with Bearer token.
// Used to proxy instances, ssh-keys, regions, plans, os for the cloud provider detail page.

const std = @import("std");

const log = std.log.scoped(.vultr);

const VULTR_BASE = "https://api.vultr.com/v2";

/// Result of a Vultr API call. Caller owns body (allocator.free).
pub const FetchResult = struct {
    status: u16,
    body: []const u8,
};

/// GET https://api.vultr.com/v2/{path} with Authorization: Bearer api_key.
/// Returns FetchResult; caller must free result.body.
pub fn fetch(
    allocator: std.mem.Allocator,
    api_key: []const u8,
    path: []const u8,
) !FetchResult {
    const url = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ VULTR_BASE, path });
    defer allocator.free(url);

    const auth_value = try std.fmt.allocPrint(allocator, "Bearer {s}", .{api_key});
    defer allocator.free(auth_value);

    var body = std.ArrayList(u8).initCapacity(allocator, 8192) catch return error.OutOfMemory;
    var body_writer = std.io.Writer.Allocating.fromArrayList(allocator, &body);
    defer body_writer.deinit();

    var client = std.http.Client{ .allocator = allocator };
    defer client.deinit();

    const fetch_options = std.http.Client.FetchOptions{
        .location = .{ .url = url },
        .response_writer = &body_writer.writer,
        .extra_headers = &.{
            .{ .name = "Authorization", .value = auth_value },
            .{ .name = "Content-Type", .value = "application/json" },
        },
    };

    const result = client.fetch(fetch_options) catch |err| {
        log.err("Vultr fetch {s}: {any}", .{ path, err });
        return err;
    };

    const body_slice = body_writer.toOwnedSlice() catch |err| {
        return err;
    };
    const status_code: u16 = switch (@TypeOf(result.status)) {
        std.http.Status => @intFromEnum(result.status),
        else => result.status,
    };
    return .{
        .status = status_code,
        .body = body_slice,
    };
}
