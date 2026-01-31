// Git repository service
// Handles Git repository management, SSH keys, and access control

const std = @import("std");
const sqlite = @import("../db/sqlite.zig").sqlite;
const database = @import("../db/database.zig");
const query_mod = @import("../db/query.zig");

const log = std.log.scoped(.git_service);

/// Git repository structure
pub const GitRepository = struct {
    id: []const u8,
    project_id: []const u8,
    name: []const u8,
    description: ?[]const u8,
    is_private: bool,
    repository_path: []const u8,
    default_branch: []const u8,
    size: i64,
    commit_count: i64,
    branch_count: i64,
    tag_count: i64,
    last_commit_at: ?i64,
    last_commit_message: ?[]const u8,
    last_commit_author: ?[]const u8,
    allow_http_push: bool,
    allow_ssh_push: bool,
    is_template: bool,
    is_read_only: bool,
    created_at: i64,
    updated_at: i64,

    pub fn deinit(self: *GitRepository, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.project_id);
        allocator.free(self.name);
        if (self.description) |d| allocator.free(d);
        allocator.free(self.repository_path);
        allocator.free(self.default_branch);
        if (self.last_commit_message) |m| allocator.free(m);
        if (self.last_commit_author) |a| allocator.free(a);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !GitRepository {
        const id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField);
        errdefer allocator.free(id);

        const project_id = try allocator.dupe(u8, row.get("project_id") orelse return error.MissingField);
        errdefer allocator.free(project_id);

        const name = try allocator.dupe(u8, row.get("name") orelse return error.MissingField);
        errdefer allocator.free(name);

        const description = if (row.get("description")) |d|
            if (d.len > 0) try allocator.dupe(u8, d) else null
        else
            null;
        errdefer if (description) |d| allocator.free(d);

        const repository_path = try allocator.dupe(u8, row.get("repository_path") orelse return error.MissingField);
        errdefer allocator.free(repository_path);

        const default_branch = try allocator.dupe(u8, row.get("default_branch") orelse "main");
        errdefer allocator.free(default_branch);

        const last_commit_message = if (row.get("last_commit_message")) |m|
            if (m.len > 0) try allocator.dupe(u8, m) else null
        else
            null;
        errdefer if (last_commit_message) |m| allocator.free(m);

        const last_commit_author = if (row.get("last_commit_author")) |a|
            if (a.len > 0) try allocator.dupe(u8, a) else null
        else
            null;
        errdefer if (last_commit_author) |a| allocator.free(a);

        return GitRepository{
            .id = id,
            .project_id = project_id,
            .name = name,
            .description = description,
            .is_private = parseBool(row.get("is_private")),
            .repository_path = repository_path,
            .default_branch = default_branch,
            .size = parseInt(row.get("size")) orelse 0,
            .commit_count = parseInt(row.get("commit_count")) orelse 0,
            .branch_count = parseInt(row.get("branch_count")) orelse 0,
            .tag_count = parseInt(row.get("tag_count")) orelse 0,
            .last_commit_at = parseInt(row.get("last_commit_at")),
            .last_commit_message = last_commit_message,
            .last_commit_author = last_commit_author,
            .allow_http_push = parseBool(row.get("allow_http_push")),
            .allow_ssh_push = parseBool(row.get("allow_ssh_push")),
            .is_template = parseBool(row.get("is_template")),
            .is_read_only = parseBool(row.get("is_read_only")),
            .created_at = parseInt(row.get("created_at")) orelse 0,
            .updated_at = parseInt(row.get("updated_at")) orelse 0,
        };
    }
};

/// SSH Key structure
pub const SshKey = struct {
    id: []const u8,
    user_id: []const u8,
    title: []const u8,
    public_key: []const u8,
    key_type: []const u8,
    fingerprint: []const u8,
    last_used_at: ?i64,
    created_at: i64,

    pub fn deinit(self: *SshKey, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.user_id);
        allocator.free(self.title);
        allocator.free(self.public_key);
        allocator.free(self.key_type);
        allocator.free(self.fingerprint);
    }

    pub fn fromRow(allocator: std.mem.Allocator, row: std.StringHashMap([]const u8)) !SshKey {
        const id = try allocator.dupe(u8, row.get("id") orelse return error.MissingField);
        errdefer allocator.free(id);

        const user_id = try allocator.dupe(u8, row.get("user_id") orelse return error.MissingField);
        errdefer allocator.free(user_id);

        const title = try allocator.dupe(u8, row.get("title") orelse return error.MissingField);
        errdefer allocator.free(title);

        const public_key = try allocator.dupe(u8, row.get("public_key") orelse return error.MissingField);
        errdefer allocator.free(public_key);

        const key_type = try allocator.dupe(u8, row.get("key_type") orelse return error.MissingField);
        errdefer allocator.free(key_type);

        const fingerprint = try allocator.dupe(u8, row.get("fingerprint") orelse return error.MissingField);
        errdefer allocator.free(fingerprint);

        return SshKey{
            .id = id,
            .user_id = user_id,
            .title = title,
            .public_key = public_key,
            .key_type = key_type,
            .fingerprint = fingerprint,
            .last_used_at = parseInt(row.get("last_used_at")),
            .created_at = parseInt(row.get("created_at")) orelse 0,
        };
    }
};

/// Get the filesystem path for a repository
pub fn getRepositoryPath(allocator: std.mem.Allocator, project_id: []const u8, repo_name: []const u8) ![]const u8 {
    const git_repos_root = std.process.getEnvVarOwned(allocator, "GIT_REPOS_ROOT") catch |err| blk: {
        if (err != error.EnvironmentVariableNotFound) return err;
        // Default to data/git-repos
        break :blk try std.fmt.allocPrint(allocator, "data/git-repos", .{});
    };
    defer allocator.free(git_repos_root);

    return std.fmt.allocPrint(allocator, "{s}/{s}/{s}.git", .{ git_repos_root, project_id, repo_name });
}

/// Initialize a new bare git repository
pub fn initRepository(allocator: std.mem.Allocator, project_id: []const u8, repo_name: []const u8, default_branch: []const u8) ![]const u8 {
    const repo_path = try getRepositoryPath(allocator, project_id, repo_name);
    errdefer allocator.free(repo_path);

    // Create directory structure
    var dir = try std.fs.cwd().makeOpenPath(repo_path, .{});
    dir.close();

    // Initialize bare repository
    const cmd = try std.fmt.allocPrint(allocator, "git init --bare --initial-branch={s} \"{s}\"", .{ default_branch, repo_path });
    defer allocator.free(cmd);

    var child = std.process.Child.init(&[_][]const u8{ "sh", "-c", cmd }, allocator);
    const result = try child.spawnAndWait();

    if (result != .Exited or result.Exited != 0) {
        return error.GitInitFailed;
    }

    return repo_path;
}

/// Create a new git repository
pub fn createRepository(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    project_id: []const u8,
    name: []const u8,
    description: ?[]const u8,
    is_private: bool,
    default_branch: []const u8,
) !GitRepository {
    // Initialize repository on filesystem
    const repository_path = try initRepository(allocator, project_id, name, default_branch);
    defer allocator.free(repository_path);

    // Generate UUID for repository
    const id = try generateUuid(allocator);
    defer allocator.free(id);

    // Insert into database
    var sql_buf = std.ArrayList(u8).initCapacity(allocator, 512) catch return error.OutOfMemory;
    defer sql_buf.deinit(allocator);

    const writer = sql_buf.writer(allocator);
    try writer.print(
        \\INSERT INTO git_repositories (
        \\  id, project_id, name, description, is_private, repository_path, default_branch,
        \\  size, commit_count, branch_count, tag_count, allow_http_push, allow_ssh_push,
        \\  is_template, is_read_only, created_at, updated_at
        \\) VALUES ('{s}', '{s}', '{s}', {s}, {d}, '{s}', '{s}', 0, 0, 0, 0, 1, 1, 0, 0, unixepoch(), unixepoch())
    , .{
        id,
        project_id,
        name,
        if (description) |d| try std.fmt.allocPrint(allocator, "'{s}'", .{d}) else "NULL",
        @as(i32, if (is_private) 1 else 0),
        repository_path,
        default_branch,
    });

    const sql = try sql_buf.toOwnedSlice(allocator);
    defer allocator.free(sql);

    try query_mod.execute(allocator, db, sql);

    // Fetch and return the created repository
    return try getRepositoryById(allocator, db, id);
}

/// Get repository by ID
pub fn getRepositoryById(allocator: std.mem.Allocator, db: *sqlite.sqlite3, repo_id: []const u8) !GitRepository {
    const sql = try std.fmt.allocPrint(allocator, "SELECT * FROM git_repositories WHERE id = '{s}' LIMIT 1", .{repo_id});
    defer allocator.free(sql);

    var rows = try query_mod.queryAll(allocator, db, sql);
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return error.RepositoryNotFound;

    return try GitRepository.fromRow(allocator, rows.items[0]);
}

/// Get repository by project ID
pub fn getRepositoryByProjectId(allocator: std.mem.Allocator, db: *sqlite.sqlite3, project_id: []const u8) !?GitRepository {
    const sql = try std.fmt.allocPrint(allocator, "SELECT * FROM git_repositories WHERE project_id = '{s}' LIMIT 1", .{project_id});
    defer allocator.free(sql);

    var rows = try query_mod.queryAll(allocator, db, sql);
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return null;

    return try GitRepository.fromRow(allocator, rows.items[0]);
}

/// Calculate SHA256 fingerprint for SSH key
pub fn calculateFingerprint(allocator: std.mem.Allocator, public_key: []const u8) ![]const u8 {
    // Extract the key part (remove key type and comment)
    var parts = std.mem.splitSequence(u8, public_key, " ");
    _ = parts.next() orelse return error.InvalidKeyFormat; // Skip key type
    const key_data = parts.next() orelse return error.InvalidKeyFormat;

    // Decode base64
    const decoder = std.base64.standard.Decoder;
    const decoded_len = try decoder.calcSizeForSlice(key_data);
    const decoded = try allocator.alloc(u8, decoded_len);
    defer allocator.free(decoded);

    try decoder.decode(decoded, key_data);

    // Calculate SHA256
    var hash: [32]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(decoded, &hash, .{});

    // Encode to base64
    const encoder = std.base64.standard.Encoder;
    const encoded_len = encoder.calcSize(hash.len);
    const encoded = try allocator.alloc(u8, encoded_len);
    defer allocator.free(encoded);

    _ = encoder.encode(encoded, &hash);

    // Format as SSH fingerprint
    return try std.fmt.allocPrint(allocator, "SHA256:{s}", .{encoded});
}

/// Add SSH key for a user
pub fn addSshKey(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    user_id: []const u8,
    title: []const u8,
    public_key: []const u8,
) !SshKey {
    // Parse key type
    var parts = std.mem.splitSequence(u8, public_key, " ");
    const key_type = parts.next() orelse return error.InvalidKeyFormat;

    // Calculate fingerprint
    const fingerprint = try calculateFingerprint(allocator, public_key);
    defer allocator.free(fingerprint);

    // Check if key already exists
    const check_sql = try std.fmt.allocPrint(allocator, "SELECT COUNT(*) as count FROM ssh_keys WHERE fingerprint = '{s}'", .{fingerprint});
    defer allocator.free(check_sql);

    var check_rows = try query_mod.queryAll(allocator, db, check_sql);
    defer {
        for (check_rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        check_rows.deinit(allocator);
    }

    if (check_rows.items.len > 0) {
        const count_str = check_rows.items[0].get("count") orelse "0";
        const count = std.fmt.parseInt(i64, count_str, 10) catch 0;
        if (count > 0) return error.KeyAlreadyExists;
    }

    // Generate UUID
    const id = try generateUuid(allocator);
    defer allocator.free(id);

    // Insert key
    const sql = try std.fmt.allocPrint(allocator,
        \\INSERT INTO ssh_keys (id, user_id, title, public_key, key_type, fingerprint, created_at)
        \\VALUES ('{s}', '{s}', '{s}', '{s}', '{s}', '{s}', unixepoch())
    , .{ id, user_id, title, public_key, key_type, fingerprint });
    defer allocator.free(sql);

    try query_mod.execute(allocator, db, sql);

    // Fetch and return the created key
    return try getSshKeyById(allocator, db, id);
}

/// Get SSH key by ID
pub fn getSshKeyById(allocator: std.mem.Allocator, db: *sqlite.sqlite3, key_id: []const u8) !SshKey {
    const sql = try std.fmt.allocPrint(allocator, "SELECT * FROM ssh_keys WHERE id = '{s}' LIMIT 1", .{key_id});
    defer allocator.free(sql);

    var rows = try query_mod.queryAll(allocator, db, sql);
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        rows.deinit(allocator);
    }

    if (rows.items.len == 0) return error.KeyNotFound;

    return try SshKey.fromRow(allocator, rows.items[0]);
}

/// Get SSH keys for a user
pub fn getUserSshKeys(allocator: std.mem.Allocator, db: *sqlite.sqlite3, user_id: []const u8) !std.ArrayList(SshKey) {
    const sql = try std.fmt.allocPrint(allocator, "SELECT * FROM ssh_keys WHERE user_id = '{s}' ORDER BY created_at DESC", .{user_id});
    defer allocator.free(sql);

    var rows = try query_mod.queryAll(allocator, db, sql);
    defer {
        for (rows.items) |*row| {
            var it = row.iterator();
            while (it.next()) |entry| {
                allocator.free(entry.key_ptr.*);
                allocator.free(entry.value_ptr.*);
            }
            row.deinit();
        }
        rows.deinit(allocator);
    }

    var keys = std.ArrayList(SshKey).initCapacity(allocator, 16) catch return error.OutOfMemory;
    errdefer {
        for (keys.items) |*key| key.deinit(allocator);
        keys.deinit(allocator);
    }

    for (rows.items) |row| {
        const key = try SshKey.fromRow(allocator, row);
        try keys.append(allocator, key);
    }

    return keys;
}

/// Delete SSH key
pub fn deleteSshKey(allocator: std.mem.Allocator, db: *sqlite.sqlite3, key_id: []const u8, user_id: []const u8) !void {
    const sql = try std.fmt.allocPrint(allocator, "DELETE FROM ssh_keys WHERE id = '{s}' AND user_id = '{s}'", .{ key_id, user_id });
    defer allocator.free(sql);

    try query_mod.execute(allocator, db, sql);
}

// Helper functions

fn parseBool(value: ?[]const u8) bool {
    if (value) |v| {
        return std.mem.eql(u8, v, "1") or std.mem.eql(u8, v, "true");
    }
    return false;
}

fn parseInt(value: ?[]const u8) ?i64 {
    if (value) |v| {
        return std.fmt.parseInt(i64, v, 10) catch null;
    }
    return null;
}

fn generateUuid(allocator: std.mem.Allocator) ![]const u8 {
    var uuid: [16]u8 = undefined;
    std.crypto.random.bytes(&uuid);

    // Set version (4) and variant bits
    uuid[6] = (uuid[6] & 0x0f) | 0x40;
    uuid[8] = (uuid[8] & 0x3f) | 0x80;

    return try std.fmt.allocPrint(allocator, "{x:0>2}{x:0>2}{x:0>2}{x:0>2}-{x:0>2}{x:0>2}-{x:0>2}{x:0>2}-{x:0>2}{x:0>2}-{x:0>2}{x:0>2}{x:0>2}{x:0>2}{x:0>2}{x:0>2}", .{
        uuid[0],  uuid[1],  uuid[2],  uuid[3],
        uuid[4],  uuid[5],  uuid[6],  uuid[7],
        uuid[8],  uuid[9],  uuid[10], uuid[11],
        uuid[12], uuid[13], uuid[14], uuid[15],
    });
}
