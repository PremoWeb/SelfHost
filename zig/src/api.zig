// API endpoint handlers
// Implements REST API endpoints

const std = @import("std");
const zap = @import("zap");
const sqlite = @import("db/sqlite.zig").sqlite;
const database = @import("db/database.zig");
const router = @import("router.zig");
const servers_service = @import("services/servers.zig");
const json_util = @import("json.zig");
const auth_middleware = @import("auth/middleware.zig");
const permissions = @import("auth/permissions.zig");
const companies_service = @import("services/companies.zig");
const projects_service = @import("services/projects.zig");
const vps_providers_service = @import("services/vps_providers.zig");
const cloudflare_tokens_service = @import("services/cloudflare_tokens.zig");
const security_service = @import("services/security.zig");
const agent_install = @import("agent_install.zig");
const websocket = @import("websocket.zig");
const json_parser = @import("utils/json_parser.zig");
const request_body = @import("utils/request_body.zig");
const session = @import("auth/session.zig");
const dev_tunnel = @import("dev_tunnel.zig");

const log = std.log.scoped(.api);

var agent_ws_settings: zap.WebSockets.Handler(websocket.WsContext).WebSocketSettings = undefined;

pub fn init(allocator: std.mem.Allocator) void {
    _ = allocator;
    agent_ws_settings = .{
        .on_open = router.handleWebSocketOpen,
        .on_ready = router.handleWebSocketReady,
        .on_message = router.handleWebSocketMessage,
        .on_close = router.handleWebSocketClose,
        .context = null, // Set per-upgrade
    };
}

/// WebSocket upgrade for agents
pub fn handleAgentWebSocketUpgrade(r: zap.Request) void {
    const allocator = router.getAllocator() orelse return;
    const db = router.getDatabase() orelse return;

    // Check headers
    const host_debug = r.getHeader("host") orelse "unknown";
    log.info("DEBUG: handleAgentWebSocketUpgrade called. host={s}", .{host_debug});

    const agent_id = r.getHeader("x-selfhost-agent-id") orelse {
        r.setStatus(.unauthorized);
        r.sendBody("Missing agent id") catch {};
        return;
    };
    const agent_key = r.getHeader("x-selfhost-agent-key") orelse {
        r.setStatus(.unauthorized);
        r.sendBody("Missing agent key") catch {};
        return;
    };

    // Authenticate
    const host = r.getHeader("host") orelse "unknown";
    const upgrade = r.getHeader("upgrade") orelse "none";
    const conn = r.getHeader("connection") orelse "none";
    log.info("Agent WS upgrade attempt: host={s}, upgrade={s}, connection={s}, agent_id={s}", .{ host, upgrade, conn, agent_id });
    var server_opt = servers_service.getServerById(allocator, @ptrCast(db), agent_id, null) catch |err| {
        log.err("Failed to get server for agent upgrade: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };
    defer if (server_opt) |*s| s.deinit(allocator);

    if (server_opt == null or server_opt.?.agent_key == null or !std.mem.eql(u8, server_opt.?.agent_key.?, agent_key)) {
        log.warn("Agent authentication failed for id: {s}", .{agent_id});
        r.setStatus(.unauthorized);
        r.sendBody("Authentication failed") catch {};
        return;
    }

    // Success - create context and upgrade
    const ws_ctx = allocator.create(websocket.WsContext) catch {
        r.setStatus(.internal_server_error);
        return;
    };
    ws_ctx.* = .{
        .server_id = allocator.dupe(u8, agent_id) catch {
            allocator.destroy(ws_ctx);
            r.setStatus(.internal_server_error);
            return;
        },
        .allocator = allocator,
    };

    const WsHandler = zap.WebSockets.Handler(websocket.WsContext);
    const upgrade_settings = allocator.create(WsHandler.WebSocketSettings) catch {
        ws_ctx.deinit();
        r.setStatus(.internal_server_error);
        return;
    };
    upgrade_settings.* = agent_ws_settings;
    upgrade_settings.context = ws_ctx;

    log.info("Attempting WebSocket upgrade for agent: {s}", .{agent_id});
    WsHandler.upgrade(r.h, upgrade_settings) catch |err| {
        log.err("Failed to upgrade agent to WebSocket: {any}", .{err});
        allocator.destroy(upgrade_settings);
        ws_ctx.deinit();
        r.setStatus(.internal_server_error);
        r.sendBody("WebSocket upgrade failed") catch {};
        return;
    };
    log.info("WebSocket upgrade successful for agent: {s}", .{agent_id});
}

/// POST: append or replace dev install-agent log file. Body: { "replace": boolean?, "message": string }. Dev-only (SELFHOST_DEV=1).
pub fn handleDevInstallAgentLog(r: zap.Request, method: zap.http.Method) void {
    if (method != .POST) {
        r.setStatus(.method_not_allowed);
        r.sendBody("Method not allowed") catch {};
        return;
    }
    const allocator = router.getAllocator() orelse {
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Allocator not available\"}") catch {};
        return;
    };
    if (!dev_tunnel.isDevMode(allocator)) {
        r.setStatus(.forbidden);
        r.sendBody("{\"message\":\"Dev log is disabled. Set SELFHOST_DEV=1.\"}") catch {};
        return;
    }
    const root = std.process.getEnvVarOwned(allocator, "ROOT") catch |err| {
        if (err != error.EnvironmentVariableNotFound) {
            log.err("Dev install-agent log: ROOT env: {any}", .{err});
        }
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"ROOT not set\"}") catch {};
        return;
    };
    defer allocator.free(root);

    const body_str = request_body.readRequestBody(allocator, r) catch |err| {
        log.err("Dev install-agent log: read body: {any}", .{err});
        r.setStatus(.bad_request);
        r.sendBody("{\"message\":\"Failed to read body\"}") catch {};
        return;
    };
    defer allocator.free(body_str);
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
    const replace_val = json_parser.getString(json_data, allocator, "replace") catch null;
    defer if (replace_val) |v| allocator.free(v);
    const replace = replace_val != null and replace_val.?.len == 4 and std.mem.eql(u8, replace_val.?, "true");
    const message = json_parser.getString(json_data, allocator, "message") catch null;
    defer if (message) |m| allocator.free(m);
    if (message == null or message.?.len == 0) {
        r.setStatus(.bad_request);
        r.sendBody("{\"message\":\"message required\"}") catch {};
        return;
    }

    var dir = std.fs.openDirAbsolute(root, .{}) catch |err| {
        log.err("Dev install-agent log: openDir ROOT: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Cannot open ROOT dir\"}") catch {};
        return;
    };
    defer dir.close();

    const log_name = ".dev-install-agent.log";
    if (replace) {
        var file = dir.createFile(log_name, .{}) catch |err| {
            log.err("Dev install-agent log: createFile: {any}", .{err});
            r.setStatus(.internal_server_error);
            r.sendBody("{\"error\":\"Cannot create log file\"}") catch {};
            return;
        };
        defer file.close();
        file.writeAll(message.?) catch |e| {
            log.err("Dev install-agent log: write: {any}", .{e});
        };
        file.writeAll("\n") catch {};
        r.setStatus(.ok);
        r.sendBody("{}") catch {};
        return;
    }
    {
        var file = dir.openFile(log_name, .{ .mode = .read_write }) catch |err| {
            if (err == error.FileNotFound) {
                var create = dir.createFile(log_name, .{}) catch |e| {
                    log.err("Dev install-agent log: createFile: {any}", .{e});
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Cannot create log file\"}") catch {};
                    return;
                };
                create.writeAll(message.?) catch {};
                create.writeAll("\n") catch {};
                create.close();
                r.setStatus(.ok);
                r.sendBody("{}") catch {};
                return;
            } else {
                log.err("Dev install-agent log: openFile: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Cannot open log file\"}") catch {};
                return;
            }
        };
        defer file.close();
        file.seekFromEnd(0) catch |e| {
            log.err("Dev install-agent log: seek: {any}", .{e});
            r.setStatus(.internal_server_error);
            r.sendBody("{\"error\":\"Seek failed\"}") catch {};
            return;
        };
        file.writeAll(message.?) catch |e| {
            log.err("Dev install-agent log: write: {any}", .{e});
        };
        file.writeAll("\n") catch {};
    }
    r.setStatus(.ok);
    r.sendBody("{}") catch {};
}

/// GET: return current tunnel URL. POST: start cloudflared and return URL. Dev-only (SELFHOST_DEV=1).
pub fn handleDevTunnel(r: zap.Request, method: zap.http.Method) void {
    const allocator = router.getAllocator() orelse {
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Allocator not available\"}") catch {};
        return;
    };
    if (!dev_tunnel.isDevMode(allocator)) {
        r.setStatus(.forbidden);
        r.sendBody("{\"message\":\"Dev tunnel is disabled. Run the server in Debug mode (zig build run) or set SELFHOST_DEV=1.\"}") catch {};
        return;
    }
    switch (method) {
        .GET => {
            const url = dev_tunnel.getUrl(allocator);
            if (url) |u| {
                var buf: [512]u8 = undefined;
                const body = std.fmt.bufPrint(&buf, "{{\"url\":\"{s}\"}}", .{u}) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Response too long\"}") catch {};
                    return;
                };
                r.setContentType(.JSON) catch {};
                r.sendBody(body) catch |err| log.err("sendBody: {any}", .{err});
            } else {
                r.setContentType(.JSON) catch {};
                r.sendBody("{\"url\":null}") catch |err| log.err("sendBody: {any}", .{err});
            }
        },
        .POST => {
            const url = dev_tunnel.start(allocator, 15000) catch |err| {
                log.err("Tunnel start failed: {any}", .{err});
                r.setStatus(.internal_server_error);
                var msg_buf: [128]u8 = undefined;
                const msg = std.fmt.bufPrint(&msg_buf, "{{\"message\":\"{s}\"}}", .{@errorName(err)}) catch "{\"message\":\"Tunnel failed\"}";
                r.sendBody(msg) catch {};
                return;
            };
            var buf: [512]u8 = undefined;
            const body = std.fmt.bufPrint(&buf, "{{\"url\":\"{s}\"}}", .{url}) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Response too long\"}") catch {};
                return;
            };
            r.setContentType(.JSON) catch {};
            r.sendBody(body) catch |err| log.err("sendBody: {any}", .{err});
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("Method not allowed") catch {};
        },
    }
}

// Health check endpoint
pub fn handleHealth(r: zap.Request) void {
    const timestamp = std.time.timestamp();
    var json_buf: [256]u8 = undefined;
    const json = std.fmt.bufPrintZ(&json_buf, "{{\"status\":\"ok\",\"timestamp\":{d}}}", .{timestamp}) catch {
        r.setStatus(.internal_server_error);
        r.sendBody("Internal Server Error") catch {};
        return;
    };

    r.setContentType(.JSON) catch {};
    r.sendBody(json) catch |err| {
        log.err("Failed to send health response: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("Internal Server Error") catch {};
    };
}

// Auth endpoints (login, register, etc.)
pub fn handleAuthRequest(r: zap.Request, path: []const u8, method: zap.http.Method) void {
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

    if (method == .POST and (std.mem.eql(u8, path, "/api/auth/login") or std.mem.eql(u8, path, "/api/auth/sign-in/email"))) {
        handleLogin(r, allocator, db);
        return;
    }

    if (method == .GET and (std.mem.eql(u8, path, "/api/auth/session") or std.mem.eql(u8, path, "/api/auth/get-session"))) {
        handleAuthSession(r, allocator, db);
        return;
    }

    if (method == .POST and (std.mem.eql(u8, path, "/api/auth/logout") or std.mem.eql(u8, path, "/api/auth/sign-out"))) {
        handleLogout(r, allocator, db);
        return;
    }

    if (method == .POST and std.mem.eql(u8, path, "/api/auth/session/team")) {
        handleAuthSessionTeam(r, allocator, db);
        return;
    }

    if (method == .POST and std.mem.eql(u8, path, "/api/auth/admin/stop-impersonating")) {
        handleStopImpersonating(r, allocator, db);
        return;
    }

    r.setStatus(.not_implemented);
    r.sendBody("{\"error\":\"Auth endpoint not implemented\"}") catch {};
}

fn handleLogin(r: zap.Request, allocator: std.mem.Allocator, db: *sqlite.sqlite3) void {
    const body = r.body orelse {
        r.setStatus(.bad_request);
        r.sendBody("{\"message\":\"Missing body\"}") catch {};
        return;
    };

    const json_data = json_parser.parseJson(allocator, body) catch {
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

    const email = json_parser.getString(json_data, allocator, "email") catch null;
    defer if (email) |e| allocator.free(e);
    const password = json_parser.getString(json_data, allocator, "password") catch null;
    defer if (password) |p| allocator.free(p);

    if (email == null or password == null) {
        r.setStatus(.bad_request);
        r.sendBody("{\"message\":\"Email and password required\"}") catch {};
        return;
    }

    log.info("Login attempt for email: {s}", .{email.?});

    // Find user by email
    var user = getUserByEmail(allocator, db, email.?) catch |err| {
        log.err("Failed to get user by email: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };
    defer if (user) |*u| u.deinit(allocator);

    if (user == null) {
        log.info("User not found: {s}", .{email.?});
        r.setStatus(.unauthorized);
        r.sendBody("{\"message\":\"Invalid credentials\"}") catch {};
        return;
    }

    log.info("Found user: {s} ({s})", .{ user.?.email, user.?.id });

    // Get account password hash
    const hash = session.getAccountPassword(allocator, db, user.?.id) catch |err| {
        log.err("Failed to get account password: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };
    defer if (hash) |h| allocator.free(h);

    if (hash == null) {
        log.info("No password found in account table for user {s}", .{user.?.id});
        r.setStatus(.unauthorized);
        r.sendBody("{\"message\":\"Invalid credentials\"}") catch {};
        return;
    }

    log.info("Verifying password...", .{});
    // Verify password
    if (!session.verifyPassword(allocator, hash.?, password.?)) {
        log.info("Password verification failed for user {s}", .{user.?.id});
        r.setStatus(.unauthorized);
        r.sendBody("{\"message\":\"Invalid credentials\"}") catch {};
        return;
    }

    log.info("Password verified, creating session...", .{});

    // Create session
    const sess = session.createSession(allocator, db, user.?.id) catch |err| {
        log.err("Failed to create session: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };
    defer @constCast(&sess).deinit(allocator);

    // Set cookie and return success
    // Better Auth cookie format: better-auth.session_token=<token>; Path=/; HttpOnly; Max-Age=...
    var cookie_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return;
    defer cookie_buf.deinit(allocator);
    cookie_buf.writer(allocator).print("better-auth.session_token={s}; Path=/; HttpOnly; Max-Age=2592000", .{sess.token}) catch return;

    r.setHeader("Set-Cookie", cookie_buf.items) catch {};
    r.setContentType(.JSON) catch {};
    r.sendBody("{\"status\":true}") catch {};
}

fn handleAuthSession(r: zap.Request, allocator: std.mem.Allocator, db: *sqlite.sqlite3) void {
    var ctx = auth_middleware.extractAuthContext(allocator, db, &r) catch |err| {
        log.err("Failed to extract auth context: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };
    defer ctx.deinit();

    if (ctx.user) |real_user| {
        // When impersonating, return the impersonated user as "user" and add isImpersonating + impersonatedBy (real user)
        const effective_user = if (ctx.session.?.impersonated_by) |imp_id|
            session.getUserById(allocator, db, imp_id) catch null
        else
            null;
        const user_to_return = if (effective_user) |u| u else real_user;
        defer if (effective_user) |*u| @constCast(u).deinit(allocator);

        var team_json: ?[]const u8 = null;
        defer if (team_json) |j| allocator.free(j);
        if (ctx.session.?.active_team_id) |tid| {
            if (getTeamById(allocator, db, tid)) |team_row| {
                defer {
                    var it = team_row.iterator();
                    while (it.next()) |entry| {
                        allocator.free(entry.key_ptr.*);
                        allocator.free(entry.value_ptr.*);
                    }
                    @constCast(&team_row).deinit();
                }
                team_json = formatTeamJson(allocator, team_row) catch null;
                if (team_json) |j| _ = j;
            }
        }
        var response_buf = std.ArrayList(u8).initCapacity(allocator, 2048) catch return;
        defer response_buf.deinit(allocator);
        var w = response_buf.writer(allocator);
        w.print("{{\"user\":{{\"id\":\"{s}\",\"email\":\"{s}\",\"name\":\"{s}\",\"isGod\":{}}},\"session\":{{\"id\":\"{s}\"}}", .{ user_to_return.id, user_to_return.email, user_to_return.name, user_to_return.is_god, ctx.session.?.id }) catch return;
        if (team_json) |j| {
            w.print(",\"team\":{s}", .{j}) catch return;
        }
        if (effective_user != null and ctx.session.?.impersonated_by != null) {
            const id_esc = json_util.escapeJson(allocator, real_user.id) catch return;
            defer allocator.free(id_esc);
            const email_esc = json_util.escapeJson(allocator, real_user.email) catch return;
            defer allocator.free(email_esc);
            const name_esc = json_util.escapeJson(allocator, real_user.name) catch return;
            defer allocator.free(name_esc);
            w.print(",\"isImpersonating\":true,\"impersonationType\":\"user\",\"impersonatedBy\":{{\"id\":\"{s}\",\"email\":\"{s}\",\"name\":\"{s}\",\"isGod\":{s}}}", .{ id_esc, email_esc, name_esc, if (real_user.is_god) "true" else "false" }) catch return;
        }
        w.print("}}", .{}) catch return;
        const body = response_buf.toOwnedSlice(allocator) catch return;
        defer allocator.free(body);
        r.setContentType(.JSON) catch {};
        r.sendBody(body) catch {};
    } else {
        r.setContentType(.JSON) catch {};
        r.sendBody("null") catch {};
    }
}

fn escapeSqlString(allocator: std.mem.Allocator, str: []const u8) ![]const u8 {
    var result = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer result.deinit(allocator);
    for (str) |char| {
        switch (char) {
            '\'' => try result.writer(allocator).print("''", .{}),
            '\\' => try result.writer(allocator).print("\\\\", .{}),
            else => try result.append(allocator, char),
        }
    }
    return try result.toOwnedSlice(allocator);
}

fn getTeamById(allocator: std.mem.Allocator, db: *sqlite.sqlite3, team_id: []const u8) ?std.StringHashMap([]const u8) {
    const query_mod = @import("db/query.zig");
    const tid_escaped = escapeSqlString(allocator, team_id) catch return null;
    defer allocator.free(tid_escaped);
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return null;
    defer sql_buf.deinit(allocator);
    sql_buf.writer(allocator).print("SELECT id, name, description, personal_team, created_at, updated_at FROM teams WHERE id = '{s}' LIMIT 1", .{tid_escaped}) catch return null;
    const query_str = sql_buf.toOwnedSlice(allocator) catch return null;
    defer allocator.free(query_str);
    var rows = query_mod.queryAll(allocator, db, query_str) catch return null;
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }
    if (rows.items.len == 0) return null;
    var row = rows.items[0];
    var out = std.StringHashMap([]const u8).init(allocator);
    var it = row.iterator();
    while (it.next()) |entry| {
        out.put(allocator.dupe(u8, entry.key_ptr.*) catch return null, allocator.dupe(u8, entry.value_ptr.*) catch {
            out.deinit();
            return null;
        }) catch {
            out.deinit();
            return null;
        };
    }
    return out;
}

fn formatTeamJson(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) ![]const u8 {
    const id = row.get("id") orelse return error.MissingField;
    const name = row.get("name") orelse return error.MissingField;
    const description = row.get("description");
    const personal_team = row.get("personal_team");
    const created_at = row.get("created_at") orelse "0";
    const updated_at = row.get("updated_at") orelse "0";
    const personal = personal_team != null and (std.mem.eql(u8, personal_team.?, "1") or std.mem.eql(u8, personal_team.?, "true"));
    const id_escaped = json_util.escapeJson(allocator, id) catch return error.OutOfMemory;
    defer allocator.free(id_escaped);
    const name_escaped = json_util.escapeJson(allocator, name) catch return error.OutOfMemory;
    defer allocator.free(name_escaped);
    var desc_json: []const u8 = "null";
    if (description) |d| {
        if (d.len > 0) {
            const escaped = json_util.escapeJson(allocator, d) catch return error.OutOfMemory;
            defer allocator.free(escaped);
            desc_json = std.fmt.allocPrint(allocator, "\"{s}\"", .{escaped}) catch return error.OutOfMemory;
            defer allocator.free(desc_json);
        }
    }
    return std.fmt.allocPrint(allocator, "{{\"id\":\"{s}\",\"name\":\"{s}\",\"description\":{s},\"personalTeam\":{},\"createdAt\":{s},\"updatedAt\":{s}}}", .{ id_escaped, name_escaped, desc_json, personal, created_at, updated_at });
}

fn handleAuthSessionTeam(r: zap.Request, allocator: std.mem.Allocator, db: *sqlite.sqlite3) void {
    var ctx = auth_middleware.extractAuthContext(allocator, db, &r) catch |err| {
        log.err("Failed to extract auth context: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };
    defer ctx.deinit();

    // Must be authenticated
    if (ctx.user == null) {
        r.setStatus(.unauthorized);
        return;
    }

    // Parse JSON body
    const body = r.body orelse {
        r.setStatus(.bad_request);
        return;
    };

    const json_data = json_parser.parseJson(allocator, body) catch {
        r.setStatus(.bad_request);
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

    const team_id = json_parser.getString(json_data, allocator, "teamId") catch null;
    defer if (team_id) |t| allocator.free(t);

    // Handle empty string as null (clearing context)
    var tid_to_use: ?[]const u8 = team_id;
    if (team_id) |t| {
        if (t.len == 0) tid_to_use = null;
    }

    session.updateSessionTeam(allocator, db, ctx.session.?.id, tid_to_use) catch |err| {
        log.err("Failed to update session team: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };

    r.setContentType(.JSON) catch {};
    r.sendBody("{\"success\":true}") catch {};
}

fn handleLogout(r: zap.Request, allocator: std.mem.Allocator, db: *sqlite.sqlite3) void {
    _ = allocator;
    _ = db;
    // Clear session cookie
    r.setHeader("Set-Cookie", "better-auth.session_token=; Path=/; HttpOnly; Max-Age=0") catch {};
    r.setContentType(.JSON) catch {};
    r.sendBody("{\"status\":true}") catch {};
}

fn handleStopImpersonating(r: zap.Request, allocator: std.mem.Allocator, db: *sqlite.sqlite3) void {
    var ctx = auth_middleware.extractAuthContext(allocator, db, &r) catch |err| {
        log.err("Failed to extract auth context: {any}", .{err});
        r.setStatus(.internal_server_error);
        return;
    };
    defer ctx.deinit();
    if (ctx.user == null or ctx.session == null) {
        r.setStatus(.unauthorized);
        r.sendBody("{\"success\":false,\"message\":\"Unauthorized\"}") catch {};
        return;
    }
    session.clearImpersonation(allocator, db, ctx.session.?.id) catch |err| {
        log.err("Failed to clear impersonation: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"success\":false,\"message\":\"Failed to clear impersonation\"}") catch {};
        return;
    };
    r.setContentType(.JSON) catch {};
    r.sendBody("{\"success\":true}") catch {};
}

fn getUserByEmail(allocator: std.mem.Allocator, db: *sqlite.sqlite3, email: []const u8) !?session.User {
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    // Escape email (simplified)
    var escaped = std.ArrayList(u8).initCapacity(allocator, email.len + 2) catch return error.OutOfMemory;
    defer escaped.deinit(allocator);
    for (email) |c| {
        if (c == '\'') _ = try escaped.append(allocator, '\'');
        _ = try escaped.append(allocator, c);
    }

    try sql_buf.writer(allocator).print("SELECT * FROM users WHERE email = '{s}' LIMIT 1", .{escaped.items});
    const query_str = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(query_str);

    const query_mod = @import("db/query.zig");
    var rows = try query_mod.queryAll(allocator, db, query_str);
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return null;
    return try session.User.fromRow(allocator, rows.items[0]);
}

// Main API request dispatcher (requires authentication)
pub fn handleApiRequest(r: zap.Request, path: []const u8, method: zap.http.Method) void {
    // Extract auth context
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

    // Extract headers (simplified - Zap API may differ)
    // For now, create a simple header accessor
    var ctx = auth_middleware.extractAuthContext(allocator, db, &r) catch |err| {
        log.err("Failed to extract auth context: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Failed to extract auth context\"}") catch {};
        return;
    };
    defer ctx.deinit();

    // GET list endpoints: allow unauthenticated so frontend can load (return empty data)
    if (method == .GET and std.mem.eql(u8, path, "/api/servers")) {
        handleServers(r, method, &ctx);
        return;
    }
    if (method == .GET and std.mem.eql(u8, path, "/api/projects")) {
        handleProjects(r, method, &ctx);
        return;
    }
    if (method == .GET and std.mem.eql(u8, path, "/api/vps-providers")) {
        handleVpsProviders(r, method, &ctx);
        return;
    }
    if (method == .GET and std.mem.eql(u8, path, "/api/cloudflare-tokens")) {
        handleCloudflareTokens(r, method, &ctx);
        return;
    }

    // All other API routes require authentication
    auth_middleware.requireAuth(&ctx) catch {
        r.setStatus(.unauthorized);
        r.sendBody("{\"message\":\"Unauthorized\"}") catch {};
        return;
    };

    if (std.mem.eql(u8, path, "/api/servers")) {
        handleServers(r, method, &ctx);
        return;
    }
    if (method == .POST and std.mem.endsWith(u8, path, "/install-agent")) {
        const prefix = "/api/servers/";
        const suffix = "/install-agent";
        if (path.len >= prefix.len + suffix.len and std.mem.startsWith(u8, path, prefix)) {
            var uuid_slice = path[prefix.len .. path.len - suffix.len];
            if (std.mem.indexOf(u8, uuid_slice, "?")) |q_pos| uuid_slice = uuid_slice[0..q_pos];
            handleInstallAgent(r, uuid_slice, &ctx);
            return;
        }
    }
    if (method == .POST and std.mem.endsWith(u8, path, "/validate")) {
        const prefix = "/api/servers/";
        const suffix = "/validate";
        if (path.len >= prefix.len + suffix.len and std.mem.startsWith(u8, path, prefix)) {
            var uuid_slice = path[prefix.len .. path.len - suffix.len];
            if (std.mem.indexOf(u8, uuid_slice, "?")) |q_pos| uuid_slice = uuid_slice[0..q_pos];
            handleValidateConnection(r, uuid_slice, &ctx);
            return;
        }
    }
    if (std.mem.startsWith(u8, path, "/api/servers/")) {
        var uuid_slice = path["/api/servers/".len..];
        if (std.mem.indexOf(u8, uuid_slice, "?")) |q_pos| {
            uuid_slice = uuid_slice[0..q_pos];
        }
        handleServerById(r, method, uuid_slice, &ctx);
        return;
    }
    if (std.mem.eql(u8, path, "/api/companies")) {
        handleCompanies(r, method, &ctx);
        return;
    }
    if (std.mem.eql(u8, path, "/api/projects")) {
        handleProjects(r, method, &ctx);
        return;
    }
    if (std.mem.startsWith(u8, path, "/api/projects/")) {
        var uuid_slice = path["/api/projects/".len..];
        // Strip query string if present (e.g. /api/projects/xxx?foo=bar)
        if (std.mem.indexOf(u8, uuid_slice, "?")) |q_pos| {
            uuid_slice = uuid_slice[0..q_pos];
        }
        handleProjectById(r, method, uuid_slice, &ctx);
        return;
    }
    if (std.mem.startsWith(u8, path, "/api/vps-providers/")) {
        const id = path["/api/vps-providers/".len..];
        handleVpsProviderById(r, method, id, &ctx);
        return;
    }
    if (std.mem.eql(u8, path, "/api/vps-providers")) {
        handleVpsProviders(r, method, &ctx);
        return;
    }
    if (std.mem.startsWith(u8, path, "/api/cloudflare-tokens/")) {
        const id = path["/api/cloudflare-tokens/".len..];
        handleCloudflareTokenById(r, method, id, &ctx);
        return;
    }
    if (std.mem.eql(u8, path, "/api/cloudflare-tokens")) {
        handleCloudflareTokens(r, method, &ctx);
        return;
    }
    if (method == .GET and std.mem.eql(u8, path, "/api/teams")) {
        handleTeams(r, &ctx);
        return;
    }
    if (method == .GET and std.mem.eql(u8, path, "/api/users")) {
        handleUsers(r, &ctx);
        return;
    }

    r.setStatus(.not_found);
    r.sendBody("{\"error\":\"Not found\"}") catch {};
}

// Servers API
fn handleServers(r: zap.Request, method: zap.http.Method, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .GET => {
            // Unauthenticated or no team (and not God): return empty so frontend can load
            if (!ctx.is_god and ctx.team_id == null) {
                r.setContentType(.JSON) catch {};
                r.sendBody("{\"data\":[]}") catch {};
                return;
            }
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
            // God mode: pass null to get all servers; otherwise filter by team
            const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

            const servers = servers_service.getServersByTeam(allocator, db, team_id) catch |err| {
                log.err("Failed to get servers: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to query servers\"}") catch {};
                return;
            };
            defer {
                for (servers.items) |*s| {
                    s.deinit(allocator);
                }
                @constCast(&servers).deinit(allocator);
            }

            // Serialize servers to JSON
            const json = json_util.serializeServerArray(allocator, servers) catch |err| {
                log.err("Failed to serialize servers: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                return;
            };
            defer allocator.free(json);

            // Send JSON response
            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch |err| {
                log.err("Failed to send response: {any}", .{err});
            };
        },
        .POST => {
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
            const body_str = request_body.readRequestBody(allocator, r) catch |err| {
                log.err("Failed to read request body: {any}", .{err});
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Failed to read request body\"}") catch {};
                return;
            };
            defer allocator.free(body_str);

            if (body_str.len == 0) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Request body required\"}") catch {};
                return;
            }

            // Parse JSON
            const json_data = json_parser.parseJson(allocator, body_str) catch |err| {
                log.err("Failed to parse JSON: {any}", .{err});
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

            // Extract required fields
            const name = json_parser.getString(json_data, allocator, "name") catch null;
            defer if (name) |n| allocator.free(n);

            const ip = json_parser.getString(json_data, allocator, "ip") catch null;
            defer if (ip) |i| allocator.free(i);

            // Validate required fields
            if (name == null or ip == null) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Name and IP are required\"}") catch {};
                return;
            }

            // Extract optional fields
            const description = json_parser.getString(json_data, allocator, "description") catch null;
            defer if (description) |d| allocator.free(d);

            const port = json_parser.getInt(json_data, "port") catch null;

            const user = json_parser.getString(json_data, allocator, "user") catch null;
            defer if (user) |u| allocator.free(u);

            const vps_provider_id = json_parser.getString(json_data, allocator, "vpsProviderId") catch null;
            defer if (vps_provider_id) |vpid| allocator.free(vpid);

            const private_key_id = json_parser.getString(json_data, allocator, "privateKeyId") catch null;
            defer if (private_key_id) |pkid| allocator.free(pkid);

            const company_id = json_parser.getString(json_data, allocator, "companyId") catch null;
            defer if (company_id) |cid| allocator.free(cid);

            const cloudflare_tunnel_hostname = json_parser.getString(json_data, allocator, "cloudflare_tunnel_hostname") catch null;
            defer if (cloudflare_tunnel_hostname) |cth| allocator.free(cth);

            const cloudflare_access_token_id = json_parser.getString(json_data, allocator, "cloudflare_access_token_id") catch null;
            defer if (cloudflare_access_token_id) |catid| allocator.free(catid);

            // Parse tags array (optional)
            var tags: ?[]const []const u8 = null;
            if (json_parser.getStringArray(allocator, json_data, "tags") catch null) |tags_array| {
                tags = tags_array;
            }
            defer if (tags) |t| {
                for (t) |tag| allocator.free(tag);
                allocator.free(t);
            };

            // Get team_id from context (like original: locals.team?.id)
            const team_id: ?[]const u8 = ctx.team_id;

            // Build create data
            const create_data = servers_service.CreateServerData{
                .name = name.?,
                .ip = ip.?,
                .description = description,
                .port = port,
                .user = user,
                .team_id = team_id,
                .company_id = company_id,
                .vps_provider_id = vps_provider_id,
                .private_key_id = private_key_id,
                .tags = tags,
                .cloudflare_tunnel_hostname = cloudflare_tunnel_hostname,
                .cloudflare_access_token_id = cloudflare_access_token_id,
            };

            // Create server
            const server = servers_service.createServer(allocator, db, create_data) catch |err| {
                log.err("Failed to create server: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"message\":\"Failed to create server\"}") catch {};
                return;
            };
            defer @constCast(&server).deinit(allocator);

            // Serialize server to JSON
            const json = json_util.serializeServer(allocator, server) catch |err| {
                log.err("Failed to serialize server: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                return;
            };
            defer allocator.free(json);

            var response_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Out of memory\"}") catch {};
                return;
            };
            defer response_buf.deinit(allocator);
            response_buf.writer(allocator).print("{{\"data\":{s}}}", .{json}) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to format response\"}") catch {};
                return;
            };
            const response = response_buf.toOwnedSlice(allocator) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Out of memory\"}") catch {};
                return;
            };
            defer allocator.free(response);

            r.setStatus(.created);
            r.setContentType(.JSON) catch {};
            r.sendBody(response) catch |err| {
                log.err("Failed to send response: {any}", .{err});
            };
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("Method not allowed") catch {};
        },
    }
}

fn handleValidateConnection(r: zap.Request, server_id: []const u8, ctx: *auth_middleware.RequestContext) void {
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

    const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;
    var server = servers_service.getServerById(allocator, db, server_id, team_id) catch |err| {
        log.err("Validate: get server failed: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"success\":false,\"message\":\"Failed to query server\"}") catch {};
        return;
    };
    if (server == null) {
        server = servers_service.getServerById(allocator, db, server_id, null) catch null;
        if (server) |*s| {
            const proj_team = s.team_id orelse "";
            const ctx_tid = team_id orelse "";
            const team_match = std.mem.eql(u8, proj_team, ctx_tid) or std.ascii.eqlIgnoreCase(proj_team, ctx_tid);
            if (!team_match) {
                @constCast(s).deinit(allocator);
                server = null;
            }
        }
    }
    defer if (server) |*s| @constCast(s).deinit(allocator);

    if (server == null) {
        r.setStatus(.not_found);
        r.sendBody("{\"success\":false,\"message\":\"Server not found\"}") catch {};
        return;
    }
    if (server.?.private_key_id == null) {
        r.setStatus(.bad_request);
        r.sendBody("{\"success\":false,\"message\":\"No private key associated with this server\"}") catch {};
        return;
    }

    const root = std.process.getEnvVarOwned(allocator, "ROOT") catch |err| {
        if (err != error.EnvironmentVariableNotFound) log.err("Validate: ROOT env: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"success\":false,\"message\":\"ROOT not set. Run via dev:all or set ROOT.\"}") catch {};
        return;
    };
    defer allocator.free(root);

    const team_id_str = if (team_id) |tid| tid else "null";
    var argv_buf: [5][]const u8 = undefined;
    argv_buf[0] = "bun";
    argv_buf[1] = "run";
    argv_buf[2] = "scripts/validate-connection-standalone.ts";
    argv_buf[3] = server_id;
    argv_buf[4] = team_id_str;

    var child = std.process.Child.init(&argv_buf, allocator);
    child.cwd = root;
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Ignore;
    child.stdin_behavior = .Ignore;

    child.spawn() catch |err| {
        log.err("Validate: spawn failed: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"success\":false,\"message\":\"Failed to start validate script. Is Bun installed?\"}") catch {};
        return;
    };

    const stdout = child.stdout orelse {
        _ = child.wait() catch {};
        r.setStatus(.internal_server_error);
        r.sendBody("{\"success\":false,\"message\":\"No stdout\"}") catch {};
        return;
    };

    var line_buf: [4096]u8 = undefined;
    var line_len: usize = 0;
    while (line_len < line_buf.len) {
        const n = stdout.read(line_buf[line_len..]) catch break;
        if (n == 0) break;
        line_len += n;
        if (std.mem.indexOf(u8, line_buf[0..line_len], "\n")) |idx| {
            line_len = idx;
            break;
        }
    }
    // Do not close stdout: Child.wait() closes it in cleanupStreams().
    _ = child.wait() catch {};

    r.setStatus(.ok);
    r.setContentType(.JSON) catch {};
    r.sendBody(line_buf[0..line_len]) catch |err| log.err("Validate: sendBody: {any}", .{err});
}

fn handleInstallAgent(r: zap.Request, server_id_slice: []const u8, ctx: *auth_middleware.RequestContext) void {
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

    // Duplicate IDs because this handler runs long and original slices might be invalidated
    const server_id = allocator.dupe(u8, server_id_slice) catch return;
    defer allocator.free(server_id);

    const team_id_slice: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;
    const team_id = if (team_id_slice) |tid| allocator.dupe(u8, tid) catch null else null;
    defer if (team_id) |tid| allocator.free(tid);
    var server = servers_service.getServerById(allocator, db, server_id, team_id) catch |err| {
        log.err("Install agent: get server failed: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Failed to query server\"}") catch {};
        return;
    };
    if (server == null) {
        server = servers_service.getServerById(allocator, db, server_id, null) catch null;
        if (server) |*s| {
            const proj_team = s.team_id orelse "";
            const ctx_tid = team_id orelse "";
            const team_match = std.mem.eql(u8, proj_team, ctx_tid) or std.ascii.eqlIgnoreCase(proj_team, ctx_tid);
            if (!team_match) {
                @constCast(s).deinit(allocator);
                server = null;
            }
        }
    }
    defer if (server) |*s| @constCast(s).deinit(allocator);

    if (server == null) {
        r.setStatus(.not_found);
        r.sendBody("{\"error\":\"Server not found\"}") catch {};
        return;
    }
    if (server.?.private_key_id == null) {
        r.setStatus(.bad_request);
        r.sendBody("{\"error\":\"Server has no private key. Attach a deployment key first.\"}") catch {};
        return;
    }

    const body_str = request_body.readRequestBody(allocator, r) catch |err| {
        log.err("Install agent: read body failed: {any}", .{err});
        r.setStatus(.bad_request);
        r.sendBody("{\"message\":\"Failed to read request body\"}") catch {};
        return;
    };
    defer allocator.free(body_str);
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
    var callback_url: ?[]const u8 = json_parser.getString(json_data, allocator, "callbackUrl") catch null;
    if (callback_url == null or callback_url.?.len == 0) {
        if (callback_url) |c| allocator.free(c);
        const host = r.getHeader("host") orelse "";
        if (host.len > 0) {
            const proto = r.getHeader("x-forwarded-proto") orelse "http";
            const ws_proto = if (std.mem.eql(u8, proto, "https")) "wss" else "ws";
            callback_url = std.fmt.allocPrint(allocator, "{s}://{s}", .{ ws_proto, host }) catch null;
        }

        // If still null, try Magic Tunnel URL
        if (callback_url == null or callback_url.?.len == 0) {
            if (callback_url) |c| allocator.free(c);
            if (dev_tunnel.getUrl(allocator)) |t_url| {
                callback_url = allocator.dupe(u8, t_url) catch null;
            }
        }
    }

    if (callback_url == null or callback_url.?.len == 0) {
        r.setStatus(.bad_request);
        r.sendBody("{\"message\":\"callbackUrl required and could not be inferred from Host header\"}") catch {};
        return;
    }
    defer if (callback_url) |c| allocator.free(c);

    const root = std.process.getEnvVarOwned(allocator, "ROOT") catch |err| {
        if (err != error.EnvironmentVariableNotFound) {
            log.err("Install agent: ROOT env: {any}", .{err});
        }
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"ROOT not set. Run via dev:all or set ROOT to project root.\"}") catch {};
        return;
    };
    defer allocator.free(root);

    var pk = security_service.getPrivateKeyById(allocator, db, server.?.private_key_id.?, team_id, ctx.is_god) catch |err| {
        log.err("Install agent: get private key failed: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Failed to get private key\"}") catch {};
        return;
    };
    if (pk == null) {
        r.setStatus(.not_found);
        r.sendBody("{\"error\":\"Private key not found\"}") catch {};
        return;
    }
    defer if (pk) |*key| key.deinit(allocator);

    var sse = std.ArrayList(u8).initCapacity(allocator, 4096) catch {
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Out of memory\"}") catch {};
        return;
    };
    defer sse.deinit(allocator);

    var s = server.?;

    // Set status to installing for UI feedback
    const installing_data = servers_service.UpdateServerData{
        .status = "installing",
    };
    _ = servers_service.updateServer(allocator, db, server_id, team_id, installing_data) catch |err| {
        log.err("Install agent: update status failed: {any}", .{err});
    };

    const success = agent_install.runInstallAgent(allocator, db, &s, pk.?.private_key, callback_url.?, root, &sse, team_id) catch |err| {
        log.err("Install agent: runInstallAgent: {any}", .{err});
        _ = sse.appendSlice(allocator, "data: {\"step\":\"error\",\"message\":\"Install failed\",\"status\":\"error\"}\n\n") catch {};
        r.setStatus(.ok);
        r.setHeader("Content-Type", "text/event-stream") catch {};
        r.setHeader("Cache-Control", "no-cache") catch {};
        r.setHeader("Connection", "keep-alive") catch {};
        r.sendBody(sse.items) catch {};
        return;
    };

    if (success) {
        const update_data = servers_service.UpdateServerData{
            .connection_type = "agent",
            .status = "waiting",
        };
        _ = servers_service.updateServer(allocator, db, server_id, team_id, update_data) catch |err| {
            log.err("Install agent: update server: {any}", .{err});
        };
    }

    r.setStatus(.ok);
    r.setHeader("Content-Type", "text/event-stream") catch {};
    r.setHeader("Cache-Control", "no-cache") catch {};
    r.setHeader("Connection", "keep-alive") catch {};
    r.sendBody(sse.items) catch |err| log.err("Install agent: sendBody: {any}", .{err});
}

fn handleServerById(r: zap.Request, method: zap.http.Method, uuid: []const u8, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .GET => {
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

            // God users can fetch any server; others scoped to active team
            const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

            var server = servers_service.getServerById(allocator, db, uuid, team_id) catch |err| {
                log.err("Failed to get server: {any}", .{err});
                r.setStatus(.internal_server_error);
                var buf: [128]u8 = undefined;
                const msg = std.fmt.bufPrint(&buf, "{{\"error\":\"Failed to query server\",\"detail\":\"{s}\"}}", .{@errorName(err)}) catch {
                    r.sendBody("{\"error\":\"Failed to query server\"}") catch {};
                    return;
                };
                r.sendBody(msg) catch {};
                return;
            };
            // Fallback: not found with team filter, try without (handles NULL team_id or case mismatch)
            if (server == null and team_id != null and !ctx.is_god) {
                server = servers_service.getServerById(allocator, db, uuid, null) catch null;
                if (server) |*s| {
                    const proj_team = s.team_id orelse "";
                    const ctx_tid = team_id.?;
                    const team_match = std.mem.eql(u8, proj_team, ctx_tid) or std.ascii.eqlIgnoreCase(proj_team, ctx_tid);
                    if (!team_match) {
                        @constCast(s).deinit(allocator);
                        server = null;
                    }
                }
            }
            defer if (server) |*s| @constCast(s).deinit(allocator);

            if (server) |s| {
                const json = json_util.serializeServer(allocator, s) catch |err| {
                    log.err("Failed to serialize server: {any}", .{err});
                    r.setStatus(.internal_server_error);
                    var buf: [128]u8 = undefined;
                    const msg = std.fmt.bufPrint(&buf, "{{\"error\":\"Failed to serialize response\",\"detail\":\"{s}\"}}", .{@errorName(err)}) catch {
                        r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                        return;
                    };
                    r.sendBody(msg) catch {};
                    return;
                };
                defer allocator.free(json);

                const response = std.fmt.allocPrint(allocator, "{{\"data\":{s}}}", .{json}) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Out of memory\"}") catch {};
                    return;
                };
                defer allocator.free(response);

                r.setContentType(.JSON) catch {};
                r.sendBody(response) catch |err| {
                    log.err("Failed to send response: {any}", .{err});
                };
            } else {
                r.setStatus(.not_found);
                r.sendBody("{\"error\":\"Server not found\"}") catch {};
            }
        },
        .PATCH, .PUT => {
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

            // Get team_id from context
            const team_id: ?[]const u8 = ctx.team_id;

            // Get request body
            const body_str = request_body.readRequestBody(allocator, r) catch |err| {
                log.err("Failed to read request body: {any}", .{err});
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Failed to read request body\"}") catch {};
                return;
            };
            defer allocator.free(body_str);

            if (body_str.len == 0) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Request body required\"}") catch {};
                return;
            }

            // Parse JSON
            const json_data = json_parser.parseJson(allocator, body_str) catch |err| {
                log.err("Failed to parse JSON: {any}", .{err});
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

            // Extract update fields
            const name = json_parser.getString(json_data, allocator, "name") catch null;
            defer if (name) |n| allocator.free(n);

            const description = json_parser.getString(json_data, allocator, "description") catch null;
            defer if (description) |d| allocator.free(d);

            const ip = json_parser.getString(json_data, allocator, "ip") catch null;
            defer if (ip) |i| allocator.free(i);

            const port = json_parser.getInt(json_data, "port") catch null;

            const user = json_parser.getString(json_data, allocator, "user") catch null;
            defer if (user) |u| allocator.free(u);

            const status = json_parser.getString(json_data, allocator, "status") catch null;
            defer if (status) |s| allocator.free(s);

            // Build update data
            const update_data = servers_service.UpdateServerData{
                .name = name,
                .description = description,
                .ip = ip,
                .port = port,
                .user = user,
                .status = status,
            };

            const server = servers_service.updateServer(allocator, db, uuid, team_id, update_data) catch |err| {
                log.err("Failed to update server: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"message\":\"Failed to update server\"}") catch {};
                return;
            };
            defer if (server) |*s| @constCast(s).deinit(allocator);

            if (server) |s| {
                const json = json_util.serializeServer(allocator, s) catch |err| {
                    log.err("Failed to serialize server: {any}", .{err});
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                    return;
                };
                defer allocator.free(json);

                var response_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Out of memory\"}") catch {};
                    return;
                };
                defer response_buf.deinit(allocator);
                response_buf.writer(allocator).print("{{\"data\":{s}}}", .{json}) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to format response\"}") catch {};
                    return;
                };
                const response = response_buf.toOwnedSlice(allocator) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Out of memory\"}") catch {};
                    return;
                };
                defer allocator.free(response);

                r.setContentType(.JSON) catch {};
                r.sendBody(response) catch |err| {
                    log.err("Failed to send response: {any}", .{err});
                };
            } else {
                r.setStatus(.not_found);
                r.sendBody("{\"message\":\"Server not found or update failed\"}") catch {};
            }
        },
        .DELETE => {
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

            // Get team_id from context (God users can pass null)
            const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

            const server = servers_service.deleteServer(allocator, db, uuid, team_id) catch |err| {
                log.err("Failed to delete server: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"message\":\"Failed to delete server\"}") catch {};
                return;
            };
            defer if (server) |*s| @constCast(s).deinit(allocator);

            if (server) |s| {
                _ = s; // Server was deleted successfully
                r.sendBody("{\"data\":{\"message\":\"Server deleted successfully\"}}") catch {};
            } else {
                r.setStatus(.not_found);
                r.sendBody("{\"message\":\"Server not found or deletion failed\"}") catch {};
            }
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("Method not allowed") catch {};
        },
    }
}

// Companies API
fn handleCompanies(r: zap.Request, method: zap.http.Method, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .GET => {
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

            // God can see all companies, regular users see only their companies
            var companies = if (ctx.is_god)
                companies_service.getAllCompanies(allocator, db) catch |err| {
                    log.err("Failed to get all companies: {any}", .{err});
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to query companies\"}") catch {};
                    return;
                }
            else if (ctx.user) |user|
                companies_service.getCompaniesForUser(allocator, db, user.id) catch |err| {
                    log.err("Failed to get user companies: {any}", .{err});
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to query companies\"}") catch {};
                    return;
                }
            else
                std.ArrayList(companies_service.Company).initCapacity(allocator, 0) catch {
                    log.err("Failed to allocate companies list", .{});
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to allocate memory\"}") catch {};
                    return;
                };

            defer {
                for (companies.items) |*c| {
                    c.deinit(allocator);
                }
                companies.deinit(allocator);
            }

            // Serialize companies to JSON
            const json = json_util.serializeCompanyArray(allocator, companies) catch |err| {
                log.err("Failed to serialize companies: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                return;
            };
            defer allocator.free(json);

            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch |err| {
                log.err("Failed to send response: {any}", .{err});
            };
        },
        .POST => {
            // TODO: Create company
            r.setStatus(.created);
            r.sendBody("{\"data\":null,\"message\":\"Company created\"}") catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("Method not allowed") catch {};
        },
    }
}

// Projects API
fn handleProjects(r: zap.Request, method: zap.http.Method, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .GET => {
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

            // God mode: get all projects; otherwise filter by team
            const team_id: ?[]const u8 = ctx.team_id;
            if (!ctx.is_god and team_id == null) {
                r.setContentType(.JSON) catch {};
                r.sendBody("{\"data\":[]}") catch {};
                return;
            }

            const projects = if (ctx.is_god)
                projects_service.getAllProjects(allocator, db) catch |err| {
                    log.err("Failed to get all projects: {any}", .{err});
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to query projects\"}") catch {};
                    return;
                }
            else
                projects_service.getProjectsByTeam(allocator, db, team_id) catch |err| {
                    log.err("Failed to get projects: {any}", .{err});
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to query projects\"}") catch {};
                    return;
                };
            defer {
                for (projects.items) |p| {
                    @constCast(&p).deinit(allocator);
                }
                @constCast(&projects).deinit(allocator);
            }

            // Serialize projects to JSON
            const json = json_util.serializeProjectArray(allocator, projects) catch |err| {
                log.err("Failed to serialize projects: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                return;
            };
            defer allocator.free(json);

            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch |err| {
                log.err("Failed to send response: {any}", .{err});
            };
        },
        .POST => {
            // TODO: Create project
            r.setStatus(.created);
            r.sendBody("{\"data\":null,\"message\":\"Project created\"}") catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("Method not allowed") catch {};
        },
    }
}

fn handleProjectById(r: zap.Request, method: zap.http.Method, uuid: []const u8, ctx: *auth_middleware.RequestContext) void {
    switch (method) {
        .GET => {
            log.debug("GET project by id: uuid={s} has_team={}", .{ uuid, ctx.team_id != null });
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

            // God users can fetch any project; others are scoped to active team
            const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

            var project = projects_service.getProjectById(allocator, db, uuid, team_id) catch |err| {
                log.err("getProjectById failed: uuid={s} err={any}", .{ uuid, err });
                r.setStatus(.internal_server_error);
                var buf: [256]u8 = undefined;
                const msg = std.fmt.bufPrint(&buf, "{{\"error\":\"Failed to query project\",\"detail\":\"{s}\"}}", .{@errorName(err)}) catch {
                    r.sendBody("{\"error\":\"Failed to query project\"}") catch {};
                    return;
                };
                r.sendBody(msg) catch {};
                return;
            };
            // Fallback: if not found with team filter, try without (handles NULL team_id or case mismatch)
            if (project == null and team_id != null and ctx.is_god == false) {
                project = projects_service.getProjectById(allocator, db, uuid, null) catch null;
                if (project) |*p| {
                    const proj_team = p.team_id orelse "";
                    const ctx_tid = team_id.?;
                    const team_match = std.mem.eql(u8, proj_team, ctx_tid) or std.ascii.eqlIgnoreCase(proj_team, ctx_tid);
                    if (!team_match) {
                        @constCast(p).deinit(allocator);
                        project = null;
                    }
                }
            }
            defer if (project) |*p| @constCast(p).deinit(allocator);

            if (project) |p| {
                const json = json_util.serializeProject(allocator, p) catch |err| {
                    log.err("serializeProject failed: {any}", .{err});
                    r.setStatus(.internal_server_error);
                    var buf: [256]u8 = undefined;
                    const msg = std.fmt.bufPrint(&buf, "{{\"error\":\"Failed to serialize response\",\"detail\":\"{s}\"}}", .{@errorName(err)}) catch {
                        r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
                        return;
                    };
                    r.sendBody(msg) catch {};
                    return;
                };
                defer allocator.free(json);

                var response_buf = std.ArrayList(u8).initCapacity(allocator, 256) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Out of memory\"}") catch {};
                    return;
                };
                defer response_buf.deinit(allocator);
                response_buf.writer(allocator).print("{{\"data\":{s}}}", .{json}) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Failed to format response\"}") catch {};
                    return;
                };
                const response = response_buf.toOwnedSlice(allocator) catch {
                    r.setStatus(.internal_server_error);
                    r.sendBody("{\"error\":\"Out of memory\"}") catch {};
                    return;
                };
                defer allocator.free(response);

                r.setContentType(.JSON) catch {};
                r.sendBody(response) catch |err| {
                    log.err("Failed to send response: {any}", .{err});
                };
            } else {
                r.setStatus(.not_found);
                r.sendBody("{\"error\":\"Project not found\"}") catch {};
            }
        },
        .PATCH, .PUT => {
            // TODO: Update project
            r.setStatus(.not_implemented);
            r.sendBody("{\"error\":\"Not implemented\"}") catch {};
        },
        .DELETE => {
            // TODO: Delete project
            r.setStatus(.not_implemented);
            r.sendBody("{\"error\":\"Not implemented\"}") catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("Method not allowed") catch {};
        },
    }
}

// Teams API — list teams for current user (via team_members)
fn handleTeams(r: zap.Request, ctx: *auth_middleware.RequestContext) void {
    const user = ctx.user orelse {
        r.setStatus(.unauthorized);
        r.sendBody("{\"error\":\"Unauthorized\"}") catch {};
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
    var rows = getTeamRowsForUser(allocator, db, user.id) catch |err| {
        log.err("Failed to get teams for user: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Failed to query teams\"}") catch {};
        return;
    };
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            @constCast(row).deinit();
        }
        rows.deinit(allocator);
    }
    var arr = std.ArrayList(u8).initCapacity(allocator, 256) catch {
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Out of memory\"}") catch {};
        return;
    };
    defer arr.deinit(allocator);
    var w = arr.writer(allocator);
    w.print("[", .{}) catch {
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Out of memory\"}") catch {};
        return;
    };
    for (rows.items, 0..) |row, i| {
        if (i > 0) w.print(",", .{}) catch {};
        const team_json = formatTeamJson(allocator, row) catch {
            r.setStatus(.internal_server_error);
            r.sendBody("{\"error\":\"Failed to serialize team\"}") catch {};
            return;
        };
        defer allocator.free(team_json);
        w.print("{s}", .{team_json}) catch {
            r.setStatus(.internal_server_error);
            r.sendBody("{\"error\":\"Out of memory\"}") catch {};
            return;
        };
    }
    w.print("]", .{}) catch {};
    const body = std.fmt.allocPrint(allocator, "{{\"data\":{s}}}", .{arr.items}) catch {
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Out of memory\"}") catch {};
        return;
    };
    defer allocator.free(body);
    r.setContentType(.JSON) catch {};
    r.sendBody(body) catch {};
}

fn getTeamRowsForUser(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !std.ArrayList(std.StringHashMap([]const u8)) {
    const query_mod = @import("db/query.zig");
    const uid_escaped = escapeSqlString(allocator, user_id) catch return error.OutOfMemory;
    defer allocator.free(uid_escaped);
    const query_str = try std.fmt.allocPrint(allocator, "SELECT t.id, t.name, t.description, t.personal_team, t.created_at, t.updated_at FROM teams t INNER JOIN team_members tm ON t.id = tm.team_id WHERE tm.user_id = '{s}' ORDER BY t.name", .{uid_escaped});
    defer allocator.free(query_str);
    return try query_mod.queryAll(allocator, db, query_str);
}

// Users API — list users (God only, for impersonation / context switcher)
fn handleUsers(r: zap.Request, ctx: *auth_middleware.RequestContext) void {
    if (!ctx.is_god) {
        r.setStatus(.forbidden);
        r.sendBody("{\"error\":\"Forbidden\"}") catch {};
        return;
    }
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
    var users = session.getUsersList(allocator, db, 50) catch |err| {
        log.err("Failed to get users list: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Failed to query users\"}") catch {};
        return;
    };
    defer {
        for (users.items) |*u| {
            u.deinit(allocator);
        }
        users.deinit(allocator);
    }
    const json = json_util.serializeUserArray(allocator, users) catch |err| {
        log.err("Failed to serialize users: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("{\"error\":\"Failed to serialize response\"}") catch {};
        return;
    };
    defer allocator.free(json);
    r.setContentType(.JSON) catch {};
    r.sendBody(json) catch {};
}

fn handleVpsProviders(r: zap.Request, method: zap.http.Method, ctx: *auth_middleware.RequestContext) void {
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
    const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

    switch (method) {
        .GET => {
            var providers = vps_providers_service.listByTeam(allocator, db, team_id) catch |err| {
                log.err("Failed to list vps providers: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to query providers\"}") catch {};
                return;
            };
            defer {
                for (providers.items) |*p| p.deinit(allocator);
                providers.deinit(allocator);
            }
            const json = json_util.serializeVpsProviderArray(allocator, providers) catch |err| {
                log.err("Failed to serialize vps providers: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize\"}") catch {};
                return;
            };
            defer allocator.free(json);
            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch {};
        },
        .POST => {
            const body_str = request_body.readRequestBody(allocator, r) catch {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Failed to read body\"}") catch {};
                return;
            };
            defer allocator.free(body_str);
            if (body_str.len == 0) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Request body required\"}") catch {};
                return;
            }
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
            const name = json_parser.getString(json_data, allocator, "name") catch null;
            defer if (name) |n| allocator.free(n);
            const type_str = json_parser.getString(json_data, allocator, "type") catch null;
            defer if (type_str) |t| allocator.free(t);
            const api_key = json_parser.getString(json_data, allocator, "apiKey") catch json_parser.getString(json_data, allocator, "api_key") catch null;
            defer if (api_key) |k| allocator.free(k);
            if (name == null or type_str == null or api_key == null) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"name, type, and apiKey required\"}") catch {};
                return;
            }
            const dns_enabled = blk: {
                const v = json_parser.getString(json_data, allocator, "dnsEnabled") catch json_parser.getString(json_data, allocator, "dns_enabled") catch null;
                defer if (v) |x| allocator.free(x);
                break :blk if (v) |x| (std.mem.eql(u8, x, "true") or std.mem.eql(u8, x, "1")) else false;
            };
            var provider = vps_providers_service.create(allocator, db, .{
                .name = name.?,
                .type_name = type_str.?,
                .api_key = api_key.?,
                .dns_enabled = dns_enabled,
                .team_id = team_id,
            }) catch |err| {
                log.err("Failed to create vps provider: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to create provider\"}") catch {};
                return;
            };
            defer @constCast(&provider).deinit(allocator);
            const json = json_util.serializeVpsProvider(allocator, provider) catch {
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize\"}") catch {};
                return;
            };
            defer allocator.free(json);
            r.setStatus(.created);
            r.setContentType(.JSON) catch {};
            r.sendBody(std.fmt.allocPrint(allocator, "{{\"data\":{s}}}", .{json}) catch {
                r.setStatus(.internal_server_error);
                return;
            }) catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("{\"error\":\"Method not allowed\"}") catch {};
        },
    }
}

fn handleVpsProviderById(r: zap.Request, method: zap.http.Method, id: []const u8, ctx: *auth_middleware.RequestContext) void {
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
    const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

    switch (method) {
        .GET => {
            const provider = vps_providers_service.getById(allocator, db, id, team_id) catch |err| {
                log.err("Failed to get vps provider: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to query\"}") catch {};
                return;
            } orelse {
                r.setStatus(.not_found);
                r.sendBody("{\"error\":\"Not found\"}") catch {};
                return;
            };
            defer @constCast(&provider).deinit(allocator);
            const json = json_util.serializeVpsProvider(allocator, provider) catch {
                r.setStatus(.internal_server_error);
                return;
            };
            defer allocator.free(json);
            const body = std.fmt.allocPrint(allocator, "{{\"data\":{s}}}", .{json}) catch return;
            defer allocator.free(body);
            r.setContentType(.JSON) catch {};
            r.sendBody(body) catch {};
        },
        .PATCH => {
            const body_str = request_body.readRequestBody(allocator, r) catch {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Failed to read body\"}") catch {};
                return;
            };
            defer allocator.free(body_str);
            const json_data = if (body_str.len > 0) json_parser.parseJson(allocator, body_str) catch null else null;
            defer if (json_data) |*jd| {
                var it = jd.iterator();
                while (it.next()) |entry| {
                    allocator.free(entry.key_ptr.*);
                    allocator.free(entry.value_ptr.*);
                }
                @constCast(jd).deinit();
            };
            var update_data: struct { name: ?[]const u8 = null, api_key: ?[]const u8 = null, dns_enabled: ?bool = null } = .{};
            if (json_data) |jd| {
                update_data.name = json_parser.getString(jd, allocator, "name") catch null;
                update_data.api_key = json_parser.getString(jd, allocator, "apiKey") catch json_parser.getString(jd, allocator, "api_key") catch null;
                const de = json_parser.getString(jd, allocator, "dnsEnabled") catch null;
                defer if (de) |x| allocator.free(x);
                update_data.dns_enabled = if (de) |x| (std.mem.eql(u8, x, "true") or std.mem.eql(u8, x, "1")) else null;
            }
            const ok = vps_providers_service.update(allocator, db, id, team_id, .{
                .name = update_data.name,
                .api_key = update_data.api_key,
                .dns_enabled = update_data.dns_enabled,
            }) catch |err| {
                log.err("Failed to update vps provider: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to update\"}") catch {};
                return;
            };
            if (!ok) {
                r.setStatus(.not_found);
                r.sendBody("{\"error\":\"Not found\"}") catch {};
                return;
            }
            if (update_data.name) |n| allocator.free(n);
            if (update_data.api_key) |k| allocator.free(k);
            r.setContentType(.JSON) catch {};
            r.sendBody("{\"data\":null,\"message\":\"Updated\"}") catch {};
        },
        .DELETE => {
            const ok = vps_providers_service.delete(allocator, db, id, team_id) catch |err| {
                log.err("Failed to delete vps provider: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to delete\"}") catch {};
                return;
            };
            if (!ok) {
                r.setStatus(.not_found);
                r.sendBody("{\"error\":\"Not found\"}") catch {};
                return;
            }
            r.setStatus(.no_content);
            r.sendBody("") catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("{\"error\":\"Method not allowed\"}") catch {};
        },
    }
}

fn handleCloudflareTokens(r: zap.Request, method: zap.http.Method, ctx: *auth_middleware.RequestContext) void {
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
    const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

    switch (method) {
        .GET => {
            var tokens = cloudflare_tokens_service.listByTeam(allocator, db, team_id) catch |err| {
                log.err("Failed to list cloudflare tokens: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to query\"}") catch {};
                return;
            };
            defer {
                for (tokens.items) |*t| t.deinit(allocator);
                tokens.deinit(allocator);
            }
            const json = json_util.serializeCloudflareTokenArray(allocator, tokens) catch |err| {
                log.err("Failed to serialize cloudflare tokens: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to serialize\"}") catch {};
                return;
            };
            defer allocator.free(json);
            r.setContentType(.JSON) catch {};
            r.sendBody(json) catch {};
        },
        .POST => {
            const body_str = request_body.readRequestBody(allocator, r) catch {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Failed to read body\"}") catch {};
                return;
            };
            defer allocator.free(body_str);
            if (body_str.len == 0) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"Request body required\"}") catch {};
                return;
            }
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
            const name = json_parser.getString(json_data, allocator, "name") catch null;
            defer if (name) |n| allocator.free(n);
            const client_id = json_parser.getString(json_data, allocator, "clientId") catch json_parser.getString(json_data, allocator, "client_id") catch null;
            defer if (client_id) |c| allocator.free(c);
            const client_secret = json_parser.getString(json_data, allocator, "clientSecret") catch json_parser.getString(json_data, allocator, "client_secret") catch null;
            defer if (client_secret) |c| allocator.free(c);
            if (name == null or client_id == null or client_secret == null) {
                r.setStatus(.bad_request);
                r.sendBody("{\"message\":\"name, clientId, and clientSecret required\"}") catch {};
                return;
            }
            const description = json_parser.getString(json_data, allocator, "description") catch null;
            defer if (description) |d| allocator.free(d);
            var token = cloudflare_tokens_service.create(allocator, db, .{
                .name = name.?,
                .description = description,
                .client_id = client_id.?,
                .client_secret = client_secret.?,
                .team_id = team_id,
            }) catch |err| {
                log.err("Failed to create cloudflare token: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to create\"}") catch {};
                return;
            };
            defer token.deinit(allocator);
            const json = json_util.serializeCloudflareToken(allocator, token) catch {
                r.setStatus(.internal_server_error);
                return;
            };
            defer allocator.free(json);
            r.setStatus(.created);
            r.setContentType(.JSON) catch {};
            r.sendBody(std.fmt.allocPrint(allocator, "{{\"data\":{s}}}", .{json}) catch {
                r.setStatus(.internal_server_error);
                return;
            }) catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("{\"error\":\"Method not allowed\"}") catch {};
        },
    }
}

fn handleCloudflareTokenById(r: zap.Request, method: zap.http.Method, id: []const u8, ctx: *auth_middleware.RequestContext) void {
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
    const team_id: ?[]const u8 = if (ctx.is_god) null else ctx.team_id;

    switch (method) {
        .DELETE => {
            const ok = cloudflare_tokens_service.delete(allocator, db, id, team_id) catch |err| {
                log.err("Failed to delete cloudflare token: {any}", .{err});
                r.setStatus(.internal_server_error);
                r.sendBody("{\"error\":\"Failed to delete\"}") catch {};
                return;
            };
            if (!ok) {
                r.setStatus(.not_found);
                r.sendBody("{\"error\":\"Not found\"}") catch {};
                return;
            }
            r.setStatus(.no_content);
            r.sendBody("") catch {};
        },
        else => {
            r.setStatus(.method_not_allowed);
            r.sendBody("{\"error\":\"Method not allowed\"}") catch {};
        },
    }
}

// Static file serving for SPA
pub fn tryServeStatic(r: zap.Request, path: []const u8, static_dir: []const u8) void {
    const allocator = router.getAllocator() orelse {
        handleSpaFallback(r);
        return;
    };
    // Normalize path: strip leading "/", use "index.html" for "/" or ""
    var rel_path = path;
    if (rel_path.len > 0 and rel_path[0] == '/') rel_path = rel_path[1..];
    if (rel_path.len == 0) rel_path = "index.html";
    // Reject ".." for security
    if (std.mem.indexOf(u8, rel_path, "..") != null) {
        r.setStatus(.bad_request);
        r.sendBody("Invalid path") catch {};
        return;
    }
    // Log the request
    log.debug("Serving static file: {s}", .{rel_path});

    var dir = std.fs.cwd().openDir(static_dir, .{}) catch {
        handleSpaFallback(r);
        return;
    };
    defer dir.close();
    // Try requested path first (e.g. index.html, _app/xyz.js)
    var file = dir.openFile(rel_path, .{}) catch {
        log.debug("File not found: {s}, serving index.html", .{rel_path});
        // Not a file: SPA route (e.g. /servers, /login). Serve index.html so client router handles it.
        var index_file = dir.openFile("index.html", .{}) catch {
            handleSpaFallback(r);
            return;
        };
        defer index_file.close();
        const max_size: usize = 10 * 1024 * 1024; // 10MB
        const contents = index_file.readToEndAlloc(allocator, max_size) catch {
            r.setStatus(.internal_server_error);
            r.sendBody("Failed to read file") catch {};
            return;
        };
        defer allocator.free(contents);
        r.setContentType(.HTML) catch {};
        r.sendBody(contents) catch |err| {
            log.err("Failed to send index.html: {any}", .{err});
        };
        return;
    };
    defer file.close();
    const max_size: usize = 10 * 1024 * 1024; // 10MB
    const contents = file.readToEndAlloc(allocator, max_size) catch {
        r.setStatus(.internal_server_error);
        r.sendBody("Failed to read file") catch {};
        return;
    };
    defer allocator.free(contents);

    // Explicit MIME type handling
    if (std.mem.endsWith(u8, rel_path, ".html")) {
        r.setContentType(.HTML) catch {};
    } else if (std.mem.endsWith(u8, rel_path, ".js")) {
        r.setHeader("Content-Type", "application/javascript") catch {};
    } else if (std.mem.endsWith(u8, rel_path, ".css")) {
        r.setHeader("Content-Type", "text/css") catch {};
    } else if (std.mem.endsWith(u8, rel_path, ".json")) {
        r.setContentType(.JSON) catch {};
    } else if (std.mem.endsWith(u8, rel_path, ".svg")) {
        r.setHeader("Content-Type", "image/svg+xml") catch {};
    } else if (std.mem.endsWith(u8, rel_path, ".png")) {
        r.setHeader("Content-Type", "image/png") catch {};
    } else if (std.mem.endsWith(u8, rel_path, ".jpg") or std.mem.endsWith(u8, rel_path, ".jpeg")) {
        r.setHeader("Content-Type", "image/jpeg") catch {};
    } else {
        r.setContentTypeFromFilename(rel_path) catch {
            r.setContentType(.TEXT) catch {};
        };
    }

    r.sendBody(contents) catch |err| {
        log.err("Failed to send static file: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("Internal Server Error") catch {};
    };
}

// SPA fallback - serve a simple HTML page so browser visitors see something useful
pub fn handleSpaFallback(r: zap.Request) void {
    const html =
        \\<!DOCTYPE html>
        \\<html>
        \\<head><meta charset="utf-8"><title>Selfhost</title></head>
        \\<body style="font-family:system-ui;max-width:600px;margin:2rem auto;padding:0 1rem">
        \\<h1>Selfhost</h1>
        \\<p>Zig backend is running. No frontend build found.</p>
        \\<p>To serve the Svelte UI, run from repo root:</p>
        \\<pre style="background:#f0f0f0;padding:0.75rem;overflow:auto">./scripts/build-frontend-for-zig.sh</pre>
        \\<p>Then restart the server and open <a href="/">/</a>.</p>
        \\<hr>
        \\<p><a href="/api/health">API health</a> &middot; <a href="/api/servers">/api/servers</a> &middot; <a href="/api/projects">/api/projects</a></p>
        \\</body>
        \\</html>
    ;
    r.setContentType(.HTML) catch {};
    r.sendBody(html) catch |err| {
        log.err("Failed to send root page: {any}", .{err});
        r.setStatus(.internal_server_error);
        r.sendBody("Internal Server Error") catch {};
    };
}
