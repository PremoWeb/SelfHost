// Git API handlers
// Separated into its own file for better organization

const std = @import("std");
const zap = @import("zap");
const router = @import("router.zig");
const auth_middleware = @import("auth/middleware.zig");
const git_service = @import("services/git.zig");
const json_util = @import("json.zig");
const json_parser = @import("utils/json_parser.zig");
const request_body = @import("utils/request_body.zig");

const log = std.log.scoped(.git_handlers);

// Git Repositories API
pub fn handleGitRepositories(r: zap.Request, method: zap.http.Method, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .GET => {
            // Return empty array if not authenticated
            if (ctx.user == null) {
                r.setContentType(.JSON) catch {};
                r.sendBody("{\"data\":[]}") catch {};
                return;
            }

            // TODO: Implement list repositories (filter by team/user permissions)
            r.setContentType(.JSON) catch {};
            r.sendBody("{\"data\":[]}") catch {};
        },
        .POST => {
            // Require authentication
            auth_middleware.requireAuth(ctx) catch {
                r.setStatus(.unauthorized);
                r.sendBody("{\"message\":\"Unauthorized\"}") catch {};
                return;
            };

            const db = router.getDatabase() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Database not available\"}") catch {};
                return;
            };
            const allocator = router.getAllocator() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Allocator not available\"}") catch {};
                return;
            };

            // Read request body
            const body_str = request_body.readRequestBody(allocator, r) catch {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Failed to read request body\"}") catch {};
                return;
            };
            defer allocator.free(body_str);

            // Parse JSON
            const json_data = json_parser.parseJson(allocator, body_str) catch {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Invalid JSON\"}") catch {};
                return;
            };
            defer {
                var it = json_data.iterator();
                while (it.next()) |entry| {
                    allocator.free(entry.key_ptr.*);
                    allocator.free(entry.value_ptr.*);
                }
                @constCast(&json_data).deinit();
            }

            // Extract fields
            const project_id = json_parser.getString(json_data, allocator, "projectId") catch null;
            defer if (project_id) |p| allocator.free(p);

            const name = json_parser.getString(json_data, allocator, "name") catch null;
            defer if (name) |n| allocator.free(n);

            const description = json_parser.getString(json_data, allocator, "description") catch null;
            defer if (description) |d| allocator.free(d);

            const is_private_str = json_parser.getString(json_data, allocator, "isPrivate") catch null;
            defer if (is_private_str) |s| allocator.free(s);

            if (project_id == null or name == null) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Project ID and repository name are required\"}") catch {};
                return;
            }

            // Validate repository name
            for (name.?) |c| {
                if (!std.ascii.isAlphanumeric(c) and c != '-') {
                    r.setStatus(.bad_request);
                    r.sendBody("{\"message\":\"Repository name must contain only lowercase letters, numbers, and hyphens\"}") catch {};
                    return;
                }
            }

            const is_private = if (is_private_str) |s| std.mem.eql(u8, s, "true") else false;

            // Create repository
            var repo = git_service.createRepository(
                allocator,
                db,
                project_id.?,
                name.?,
                description,
                is_private,
                "main",
            ) catch |err| {
                log.err("Failed to create repository: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"message\":\"Failed to create repository\"}") catch {};
                return;
            };
            defer repo.deinit(allocator);

            // Serialize response
            const json = json_util.serializeGitRepository(allocator, repo) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                return;
            };
            defer allocator.free(json);

            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("{\"error\":\"Method not allowed\"}") catch {};
        },
    }
}

pub fn handleGitRepositoryById(r: zap.Request, method: zap.http.Method, id: []const u8, ctx: *auth_middleware.RequestContext) void {
    _ = method;
    _ = id;
    _ = ctx;

    // TODO: Implement GET, PATCH, DELETE for specific repository
    r.setStatus(.not_implemented);
    r.sendBody("{\"error\":\"Not implemented\"}") catch {};
}

// SSH Keys API
pub fn handleSshKeys(r: zap.Request, method: zap.http.Method, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .GET => {
            // Require authentication
            auth_middleware.requireAuth(ctx) catch {
                r.setStatus(.unauthorized);
                r.sendBody("{\"message\":\"Unauthorized\"}") catch {};
                return;
            };

            const db = router.getDatabase() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Database not available\"}") catch {};
                return;
            };
            const allocator = router.getAllocator() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Allocator not available\"}") catch {};
                return;
            };

            // Get user's SSH keys
            var keys = git_service.getUserSshKeys(allocator, db, ctx.user.?.id) catch |err| {
                log.err("Failed to get SSH keys: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to query SSH keys\"}") catch {};
                return;
            };
            defer {
                for (keys.items) |*key| key.deinit(allocator);
                keys.deinit(allocator);
            }

            // Serialize response
            const json = json_util.serializeSshKeyArray(allocator, keys) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                return;
            };
            defer allocator.free(json);

            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch {};
        },
        .POST => {
            // Require authentication
            auth_middleware.requireAuth(ctx) catch {
                r.setStatus(.unauthorized);
                r.sendBody("{\"message\":\"Unauthorized\"}") catch {};
                return;
            };

            const db = router.getDatabase() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Database not available\"}") catch {};
                return;
            };
            const allocator = router.getAllocator() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Allocator not available\"}") catch {};
                return;
            };

            // Read request body
            const body_str = request_body.readRequestBody(allocator, r) catch {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Failed to read request body\"}") catch {};
                return;
            };
            defer allocator.free(body_str);

            // Parse JSON
            const json_data = json_parser.parseJson(allocator, body_str) catch {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Invalid JSON\"}") catch {};
                return;
            };
            defer {
                var it = json_data.iterator();
                while (it.next()) |entry| {
                    allocator.free(entry.key_ptr.*);
                    allocator.free(entry.value_ptr.*);
                }
                @constCast(&json_data).deinit();
            }

            // Extract fields
            const title = json_parser.getString(json_data, allocator, "title") catch null;
            defer if (title) |t| allocator.free(t);

            const public_key = json_parser.getString(json_data, allocator, "publicKey") catch null;
            defer if (public_key) |k| allocator.free(k);

            if (title == null or public_key == null) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Title and public key are required\"}") catch {};
                return;
            }

            // Add SSH key
            var key = git_service.addSshKey(
                allocator,
                db,
                ctx.user.?.id,
                title.?,
                public_key.?,
            ) catch |err| {
                log.err("Failed to add SSH key: {any}", .{err});
                const msg = switch (err) {
                    error.KeyAlreadyExists => "{\"message\":\"SSH key already exists\"}",
                    error.InvalidKeyFormat => "{\"message\":\"Invalid SSH key format\"}",
                    else => "{\"message\":\"Failed to add SSH key\"}",
                };
                r.setStatus(.bad_request);
                r.sendBody(msg) catch {};
                return;
            };
            defer key.deinit(allocator);

            // Serialize response
            const json = json_util.serializeSshKey(allocator, key) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                return;
            };
            defer allocator.free(json);

            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("{\"error\":\"Method not allowed\"}") catch {};
        },
    }
}

pub fn handleSshKeyById(r: zap.Request, method: zap.http.Method, id: []const u8, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .DELETE => {
            // Require authentication
            auth_middleware.requireAuth(ctx) catch {
                r.setStatus(.unauthorized);
                r.sendBody("{\"message\":\"Unauthorized\"}") catch {};
                return;
            };

            const db = router.getDatabase() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Database not available\"}") catch {};
                return;
            };
            const allocator = router.getAllocator() orelse {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Allocator not available\"}") catch {};
                return;
            };

            // Delete SSH key
            git_service.deleteSshKey(allocator, db, id, ctx.user.?.id) catch |err| {
                log.err("Failed to delete SSH key: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to delete SSH key\"}") catch {};
                return;
            };

            r.setContentType(.JSON) catch {};
            r.sendBody("{\"success\":true}") catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("{\"error\":\"Method not allowed\"}") catch {};
        },
    }
}
