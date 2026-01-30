// Authentication Middleware
// Extracts user context from requests and validates sessions

const std = @import("std");
const zap = @import("zap");
const sqlite = @import("../db/sqlite.zig").sqlite;
const session = @import("session.zig");
const permissions = @import("permissions.zig");

const log = std.log.scoped(.auth_middleware);

// Simple header wrapper for Zap requests
const HeaderWrapper = struct {
    request: *const zap.Request,
    
    pub fn get(self: *const HeaderWrapper, name: []const u8) ?[]const u8 {
        // Zap Request provides getHeader() method
        // Try case-insensitive header lookup
        if (self.request.getHeader(name)) |header_value| {
            return header_value;
        }
        
        // Try lowercase version (HTTP headers are case-insensitive)
        var lower_name_buf: [64]u8 = undefined;
        if (name.len <= lower_name_buf.len) {
            var lower_name = lower_name_buf[0..name.len];
            for (name, 0..) |c, i| {
                lower_name[i] = std.ascii.toLower(c);
            }
            if (self.request.getHeader(lower_name)) |header_value| {
                return header_value;
            }
        }
        
        return null;
    }
};

pub const RequestContext = struct {
    user: ?session.User,
    session: ?session.Session,
    team_id: ?[]const u8,
    company_id: ?[]const u8,
    is_god: bool,
    allocator: std.mem.Allocator,
    
    pub fn deinit(self: *RequestContext) void {
        if (self.user) |*u| u.deinit(self.allocator);
        if (self.session) |*s| s.deinit(self.allocator);
        if (self.team_id) |tid| self.allocator.free(tid);
        if (self.company_id) |cid| self.allocator.free(cid);
    }
};

/// Extract authentication context from Zap request
/// Similar to requireApiAuth in the original server
pub fn extractAuthContext(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    request: *const zap.Request, // Zap request object
) !RequestContext {
    var ctx = RequestContext{
        .user = null,
        .session = null,
        .team_id = null,
        .company_id = null,
        .is_god = false,
        .allocator = allocator,
    };
    errdefer ctx.deinit();
    
    // Extract token from request headers (catch so we never 500 from auth extraction)
    const headers = HeaderWrapper{ .request = request };
    const token = session.extractTokenFromHeaders(allocator, headers) catch |err| {
        log.warn("extractTokenFromHeaders failed: {any}", .{err});
        return ctx;
    } orelse {
        return ctx; // No token, return empty context
    };
    defer allocator.free(token);
    
    // Get session by token (catch DB/query errors so we return 401 instead of 500)
    const sess = session.getSessionByToken(allocator, db, token) catch |err| {
        log.warn("getSessionByToken failed: {any}", .{err});
        return ctx;
    } orelse {
        return ctx; // No session found
    };
    ctx.session = sess;

    // Check if session is expired
    if (ctx.session.?.isExpired()) {
        log.warn("Session expired: {s}", .{ctx.session.?.id});
        ctx.session.?.deinit(allocator);
        ctx.session = null;
        return ctx;
    }

    // Get user (catch DB/query errors so we return 401 instead of 500)
    const user = session.getUserById(allocator, db, ctx.session.?.user_id) catch |err| {
        log.warn("getUserById failed: {any}", .{err});
        return ctx;
    } orelse {
        log.warn("User not found for session: {s}", .{ctx.session.?.id});
        return ctx;
    };
    ctx.user = user;
    ctx.is_god = user.is_god;
    
    // Extract team and company from session (catch so we never 500)
    if (ctx.session.?.active_team_id) |tid| {
        ctx.team_id = allocator.dupe(u8, tid) catch |err| {
            log.warn("dupe team_id failed: {any}", .{err});
            return ctx;
        };
    }
    if (ctx.session.?.active_company_id) |cid| {
        ctx.company_id = allocator.dupe(u8, cid) catch |err| {
            log.warn("dupe company_id failed: {any}", .{err});
            return ctx;
        };
    }

    return ctx;
}

/// Require authentication - returns error if not authenticated
pub fn requireAuth(ctx: *RequestContext) !void {
    if (ctx.user == null) {
        return error.Unauthorized;
    }
    
    const user = ctx.user.?;
    
    // God users are always authorized
    if (user.is_god) {
        return;
    }
    
    // Users with teams are authorized
    if (ctx.team_id != null) {
        return;
    }
    
    // TODO: Check super_admin via Casbin
    // For now, require team
    return error.Unauthorized;
}
