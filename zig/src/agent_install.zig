// Agent install over SSH (scp + ssh)
// Replaces the Bun install-agent-standalone script

const std = @import("std");
const servers_service = @import("services/servers.zig");
const sqlite = @import("db/sqlite.zig").sqlite;
const log = std.log.scoped(.agent_install);

pub const DetectResult = struct {
    init_system: []const u8, // "systemd" | "openrc" | "generic"
    is_root: bool,
    sudo_prefix: []const u8, // "sudo " or ""
    existing_bun_path: []const u8, // "" if not found
};

/// Append one SSE event line to sse_out (data: {...}\n\n)
fn appendSse(allocator: std.mem.Allocator, sse_out: *std.ArrayList(u8), step: []const u8, message: []const u8, status: []const u8) !void {
    const msg_escaped = jsonEscape(allocator, message) catch message;
    defer if (msg_escaped.ptr != message.ptr) allocator.free(msg_escaped);
    try sse_out.writer(allocator).print("data: {{\"step\":\"{s}\",\"message\":\"{s}\",\"status\":\"{s}\"}}\n\n", .{ step, msg_escaped, status });
}

fn jsonEscape(allocator: std.mem.Allocator, s: []const u8) ![]const u8 {
    var out = std.ArrayList(u8).initCapacity(allocator, s.len + 32) catch return error.OutOfMemory;
    errdefer out.deinit(allocator);
    for (s) |c| {
        switch (c) {
            '\\' => try out.appendSlice(allocator, "\\\\"),
            '"' => try out.appendSlice(allocator, "\\\""),
            '\n' => try out.appendSlice(allocator, "\\n"),
            '\r' => try out.appendSlice(allocator, "\\r"),
            else => try out.append(allocator, c),
        }
    }
    return try out.toOwnedSlice(allocator);
}

/// Sanitize subprocess stderr for display: printable ASCII + newline/tab only, truncate length.
fn sanitizeStderrForDisplay(allocator: std.mem.Allocator, s: []const u8, max_len: usize) ![]const u8 {
    // Filter out SSH warnings and progress bars
    var filtered = std.ArrayList(u8).initCapacity(allocator, s.len) catch return error.OutOfMemory;
    defer filtered.deinit(allocator);

    var lines = std.mem.splitScalar(u8, s, '\n');
    while (lines.next()) |line| {
        const trimmed = std.mem.trim(u8, line, &std.ascii.whitespace);
        // Skip SSH warnings and progress indicators
        if (std.mem.indexOf(u8, trimmed, "Permanently added") != null) continue;
        if (std.mem.indexOf(u8, trimmed, "Warning:") != null and std.mem.indexOf(u8, trimmed, "host key") != null) continue;
        if (std.mem.indexOf(u8, trimmed, "#=#") != null) continue; // curl/wget progress
        if (trimmed.len == 0) continue;

        try filtered.appendSlice(allocator, trimmed);
        try filtered.append(allocator, ' ');
    }

    const limit = @min(filtered.items.len, max_len);
    var out = std.ArrayList(u8).initCapacity(allocator, limit) catch return error.OutOfMemory;
    errdefer out.deinit(allocator);
    for (filtered.items[0..limit]) |c| {
        if (c >= 0x20 and c <= 0x7E) {
            try out.append(allocator, c);
        } else if (c == '\n' or c == '\t') {
            try out.append(allocator, c);
        } else {
            try out.append(allocator, ' ');
        }
    }
    return try out.toOwnedSlice(allocator);
}

/// Shell-escape for single-quoted string: ' -> '\''
fn shellEscapeSingleQuoted(allocator: std.mem.Allocator, s: []const u8) ![]const u8 {
    var out = std.ArrayList(u8).initCapacity(allocator, s.len + 8) catch return error.OutOfMemory;
    errdefer out.deinit(allocator);
    for (s) |c| {
        if (c == '\'') try out.appendSlice(allocator, "'\\''") else try out.append(allocator, c);
    }
    return try out.toOwnedSlice(allocator);
}

/// Run install over SSH. Returns true on success. Appends SSE events to sse_out.
pub fn runInstallAgent(
    allocator: std.mem.Allocator,
    db: *sqlite.sqlite3,
    server: *servers_service.Server,
    private_key_pem: []const u8,
    callback_url: []const u8,
    root_path: []const u8,
    sse_out: *std.ArrayList(u8),
    team_id: ?[]const u8,
) !bool {
    var agent_key_to_use: []const u8 = undefined;
    var agent_key_owned: ?[]const u8 = null;
    defer if (agent_key_owned) |ak| allocator.free(ak);

    if (server.agent_key) |ak| {
        agent_key_to_use = ak;
    } else {
        var buf: [32]u8 = undefined;
        std.crypto.random.bytes(&buf);
        const hex = std.fmt.bytesToHex(buf, .lower);
        agent_key_owned = try allocator.dupe(u8, &hex);
        agent_key_to_use = agent_key_owned.?;
        const update_data = servers_service.UpdateServerData{ .agent_key = agent_key_owned };
        _ = try servers_service.updateServer(allocator, db, server.id, team_id, update_data);
    }

    var server_url_buf: [512]u8 = undefined;
    var server_url = callback_url;
    if (!std.mem.endsWith(u8, callback_url, "/api/agent")) {
        const base = std.mem.trim(u8, callback_url, "/");
        server_url = std.fmt.bufPrint(&server_url_buf, "{s}/api/agent", .{base}) catch callback_url;
    }

    try appendSse(allocator, sse_out, "connecting", "Connecting to remote server via SSH...", "in-progress");

    var rand_buf: [8]u8 = undefined;
    std.crypto.random.bytes(&rand_buf);
    const hex_suffix = std.fmt.bytesToHex(rand_buf, .lower);
    var key_path_buf: [64]u8 = undefined;
    const key_path = std.fmt.bufPrintZ(&key_path_buf, "/tmp/selfhost-key-{s}", .{hex_suffix}) catch return false;
    const key_file = std.fs.createFileAbsolute(key_path[0 .. key_path.len - 1], .{ .mode = 0o600 }) catch |err| {
        log.err("create temp key file: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Failed to create temp key file", "error");
        return false;
    };
    defer key_file.close();
    defer std.posix.unlink(key_path) catch {};
    key_file.writeAll(private_key_pem) catch |err| {
        log.err("write key: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Failed to write key file", "error");
        return false;
    };
    const key_path_no_null = key_path[0 .. key_path.len - 1];

    var dir = std.fs.cwd().openDir(root_path, .{}) catch |err| {
        log.err("open ROOT dir: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "ROOT path not found", "error");
        return false;
    };
    defer dir.close();
    const agent_file = dir.openFile("agent/src/index.ts", .{}) catch |err| {
        log.err("open agent source: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Agent source not found (agent/src/index.ts)", "error");
        return false;
    };
    defer agent_file.close();
    const agent_source = agent_file.readToEndAlloc(allocator, 4 * 1024 * 1024) catch |err| {
        log.err("read agent: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Failed to read agent source", "error");
        return false;
    };
    defer allocator.free(agent_source);

    // Use Cloudflare tunnel if hostname is set, regardless of proxy_type
    const use_cloudflare = server.cloudflare_tunnel_hostname != null and server.cloudflare_tunnel_hostname.?.len > 0;

    log.info("Agent install DEBUG: server.ip={s} server.cloudflare_tunnel_hostname={?s} use_cloudflare={}", .{ server.ip, server.cloudflare_tunnel_hostname, use_cloudflare });

    const host = if (use_cloudflare) server.cloudflare_tunnel_hostname.? else server.ip;
    var target_buf: [256]u8 = undefined;
    const target = std.fmt.bufPrint(&target_buf, "{s}@{s}", .{ server.user, host }) catch return false;

    log.info("Agent install: target={s} use_cloudflare={} proxy_type={?s}", .{ target, use_cloudflare, server.proxy_type });

    const detect_script = "uname -m; if [ -d /run/systemd/system ]; then echo systemd; elif [ -f /sbin/openrc ]; then echo openrc; else echo generic; fi; whoami; if command -v sudo >/dev/null 2>&1; then echo has_sudo; else echo no_sudo; fi; command -v bun 2>/dev/null && bun -v || true; command -v bun 2>/dev/null || true";

    log.info("Running detection script: {s}", .{detect_script});

    var detect_args = std.ArrayList([]const u8).initCapacity(allocator, 14) catch return false;
    defer detect_args.deinit(allocator);
    try detect_args.append(allocator, "ssh");
    try detect_args.append(allocator, "-i");
    try detect_args.append(allocator, key_path_no_null);
    try detect_args.append(allocator, "-o");
    try detect_args.append(allocator, "StrictHostKeyChecking=no");
    try detect_args.append(allocator, "-o");
    try detect_args.append(allocator, "UserKnownHostsFile=/dev/null");
    try detect_args.append(allocator, "-o");
    try detect_args.append(allocator, "LogLevel=ERROR");
    try detect_args.append(allocator, "-o");
    try detect_args.append(allocator, "ConnectTimeout=30");
    const port_str = if (server.port == 22) "" else try std.fmt.allocPrint(allocator, "{d}", .{server.port});
    defer if (server.port != 22) allocator.free(port_str);
    if (server.port != 22) {
        try detect_args.append(allocator, "-p");
        try detect_args.append(allocator, port_str);
    }
    try detect_args.append(allocator, "-o");
    try detect_args.append(allocator, "ConnectTimeout=30");
    if (use_cloudflare) {
        try detect_args.append(allocator, "-o");
        try detect_args.append(allocator, "ProxyCommand=cloudflared access ssh --hostname %h");
    }
    try detect_args.append(allocator, target);
    try detect_args.append(allocator, detect_script);

    const run_result = std.process.Child.run(.{
        .allocator = allocator,
        .argv = detect_args.items,
        .max_output_bytes = 1024 * 1024,
    }) catch |err| {
        log.err("ssh detect run: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "SSH connection failed", "error");
        return false;
    };
    defer allocator.free(run_result.stdout);
    defer allocator.free(run_result.stderr);

    log.info("SSH run completed: stdout_len={d} stderr_len={d} term={any}", .{ run_result.stdout.len, run_result.stderr.len, run_result.term });

    switch (run_result.term) {
        .Exited => |code| if (code != 0) {
            const err_raw = std.mem.trim(u8, run_result.stderr, &std.ascii.whitespace);
            log.err("ssh detect exited {d} target={s} stderr: {s}", .{ code, target, err_raw });
            const msg = if (err_raw.len > 0)
                try std.fmt.allocPrint(allocator, "SSH detection failed (target: {s}): {s}", .{ target, err_raw })
            else
                try std.fmt.allocPrint(allocator, "SSH detection failed (target: {s}): Connection refused or timeout", .{target});
            defer allocator.free(msg);
            try appendSse(allocator, sse_out, "error", msg, "error");
            return false;
        },
        else => {
            try appendSse(allocator, sse_out, "error", "SSH detection aborted", "error");
            return false;
        },
    }

    const detect_str = std.mem.trim(u8, run_result.stdout, &std.ascii.whitespace);

    log.info("Detection script raw output: {s}", .{detect_str});

    var lines = std.mem.splitScalar(u8, detect_str, '\n');
    const arch_line = lines.next() orelse "";
    const init_system = lines.next() orelse "generic";
    const whoami_line = lines.next() orelse "";
    const sudo_line = lines.next() orelse "";
    _ = lines.next() orelse "";
    const bun_path_line = lines.next() orelse "";

    log.info("Detected: arch={s}, init={s}, user={s}, sudo={s}", .{ arch_line, init_system, whoami_line, sudo_line });

    log.info("Detected init system: {s}, user: {s}, has_sudo: {}", .{ init_system, whoami_line, std.mem.indexOf(u8, sudo_line, "has_sudo") != null });

    const is_root = std.mem.indexOf(u8, whoami_line, "root") != null;
    const has_sudo = std.mem.indexOf(u8, sudo_line, "has_sudo") != null;
    const sudo_prefix: []const u8 = if (has_sudo and !is_root) "sudo " else "";
    const existing_bun = std.mem.trim(u8, bun_path_line, &std.ascii.whitespace);
    const bun_path = if (existing_bun.len > 0)
        try allocator.dupe(u8, existing_bun)
    else if (is_root)
        try allocator.dupe(u8, "/root/.bun/bin/bun")
    else
        try std.fmt.allocPrint(allocator, "/home/{s}/.bun/bin/bun", .{server.user});
    defer allocator.free(bun_path);

    try appendSse(allocator, sse_out, "uploading", "Uploading source to /tmp/selfhost-agent.ts...", "in-progress");

    var upload_args = std.ArrayList([]const u8).initCapacity(allocator, 14) catch return false;
    defer upload_args.deinit(allocator);
    try upload_args.append(allocator, "ssh");
    try upload_args.append(allocator, "-i");
    try upload_args.append(allocator, key_path_no_null);
    try upload_args.append(allocator, "-o");
    try upload_args.append(allocator, "StrictHostKeyChecking=no");
    try upload_args.append(allocator, "-o");
    try upload_args.append(allocator, "UserKnownHostsFile=/dev/null");
    try upload_args.append(allocator, "-o");
    try upload_args.append(allocator, "LogLevel=ERROR");
    if (server.port != 22) {
        try upload_args.append(allocator, "-p");
        try upload_args.append(allocator, port_str);
    }
    try upload_args.append(allocator, "-o");
    try upload_args.append(allocator, "ConnectTimeout=30");
    if (use_cloudflare) {
        try upload_args.append(allocator, "-o");
        try upload_args.append(allocator, "ProxyCommand=cloudflared access ssh --hostname %h");
    }
    try upload_args.append(allocator, target);
    try upload_args.append(allocator, "cat > /tmp/selfhost-agent.ts");

    log.info("ssh upload: target={s} port={d} cloudflare={}", .{ target, server.port, use_cloudflare });

    var upload_child = std.process.Child.init(upload_args.items, allocator);
    upload_child.stdin_behavior = .Pipe;
    upload_child.stdout_behavior = .Ignore;
    upload_child.stderr_behavior = .Pipe;
    upload_child.spawn() catch |err| {
        log.err("ssh upload spawn: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "SSH upload failed to start", "error");
        return false;
    };
    if (upload_child.stdin) |stdin| {
        stdin.writeAll(agent_source) catch |err| {
            log.err("ssh upload stdin write: {any}", .{err});
        };
        stdin.close();
        upload_child.stdin = null;
    }

    var upload_stderr = std.ArrayList(u8).initCapacity(allocator, 2048) catch return false;
    defer upload_stderr.deinit(allocator);
    var drain_buf: [4096]u8 = undefined;
    if (upload_child.stderr) |*stderr_pipe| {
        while (stderr_pipe.read(drain_buf[0..])) |n| {
            if (n == 0) break;
            upload_stderr.appendSlice(allocator, drain_buf[0..n]) catch {};
        } else |_| {}
    }
    const upload_term = upload_child.wait() catch |err| {
        log.err("ssh upload wait: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "SSH upload failed", "error");
        return false;
    };
    switch (upload_term) {
        .Exited => |code| if (code != 0) {
            const err_raw = std.mem.trim(u8, upload_stderr.items, &std.ascii.whitespace);
            log.err("ssh upload exited {d} target={s} stderr_len={d}", .{ code, target, err_raw.len });
            const fallback: []const u8 = "File upload failed";
            const err_safe = sanitizeStderrForDisplay(allocator, err_raw, 400) catch fallback;
            defer if (err_safe.ptr != fallback.ptr) allocator.free(err_safe);
            const msg = if (err_safe.len > 0 and !std.mem.eql(u8, std.mem.trim(u8, err_safe, &std.ascii.whitespace), ""))
                try std.fmt.allocPrint(allocator, "File upload failed (target: {s}): {s}", .{ target, err_safe })
            else
                try std.fmt.allocPrint(allocator, "File upload failed (target: {s}): check server log for ssh details", .{target});
            defer allocator.free(msg);
            try appendSse(allocator, sse_out, "error", msg, "error");
            return false;
        },
        else => {
            try appendSse(allocator, sse_out, "error", "SSH upload failed", "error");
            return false;
        },
    }

    try appendSse(allocator, sse_out, "installing_bun", "Checking/Installing Bun runtime...", "in-progress");

    const start_sh_content = startShContent(allocator, server_url, server.id, agent_key_to_use, bun_path) catch |err| {
        log.err("startShContent: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Failed to build start script", "error");
        return false;
    };
    defer allocator.free(start_sh_content);
    const b64_enc = std.base64.standard.Encoder;
    const start_b64 = try allocator.alloc(u8, b64_enc.calcSize(start_sh_content.len));
    defer allocator.free(start_b64);
    const start_b64_len = b64_enc.encode(start_b64, start_sh_content);

    const init_system_owned = try allocator.dupe(u8, init_system);
    defer allocator.free(init_system_owned);
    const service_content = serviceFileContent(allocator, init_system_owned) catch |err| {
        log.err("serviceFileContent: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Failed to build service file", "error");
        return false;
    };
    defer allocator.free(service_content);
    const service_b64 = try allocator.alloc(u8, b64_enc.calcSize(service_content.len));
    defer allocator.free(service_b64);
    const service_b64_len = b64_enc.encode(service_b64, service_content);

    const service_path = if (std.mem.eql(u8, init_system, "systemd")) "/etc/systemd/system/selfhost-agent.service" else "/etc/init.d/selfhost-agent";
    const service_mode = if (std.mem.eql(u8, init_system, "systemd")) "644" else "755";

    const enable_cmd = if (std.mem.eql(u8, init_system, "systemd"))
        try std.fmt.allocPrint(allocator, "{s}rm -f /etc/init.d/selfhost-agent && {s}systemctl daemon-reload && {s}systemctl enable selfhost-agent && {s}systemctl restart selfhost-agent", .{ sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix })
    else
        try std.fmt.allocPrint(allocator, "{s}chmod +x /etc/init.d/selfhost-agent && {s}rc-update add selfhost-agent default && {s}rc-service selfhost-agent restart", .{ sudo_prefix, sudo_prefix, sudo_prefix });
    defer allocator.free(enable_cmd);

    const deps_cmd = if (std.mem.eql(u8, init_system, "openrc"))
        // Alpine: Check each package before installing
        try std.fmt.allocPrint(allocator, "for pkg in curl bash unzip; do command -v $pkg >/dev/null 2>&1 || MISSING=\"$MISSING $pkg\"; done; [ -n \"$MISSING\" ] && {s}apk add --no-cache $MISSING || true", .{sudo_prefix})
    else
        // Debian/Ubuntu/RHEL: Check if commands exist before installing
        try std.fmt.allocPrint(allocator, "MISSING=\"\"; for cmd in curl bash unzip; do command -v $cmd >/dev/null 2>&1 || MISSING=\"$MISSING $cmd\"; done; [ -n \"$MISSING\" ] && (({s}command -v apt-get >/dev/null 2>&1 && {s}DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends $MISSING 2>/dev/null) || ({s}command -v yum >/dev/null 2>&1 && {s}yum install -y -q $MISSING) || ({s}command -v dnf >/dev/null 2>&1 && {s}dnf install -y -q $MISSING) || true)", .{ sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix });
    defer allocator.free(deps_cmd);

    const install_block = if (existing_bun.len == 0)
        try std.fmt.allocPrint(allocator, "{s} && command -v bun >/dev/null 2>&1 || (curl -fsSL https://bun.sh/install | bash); export BUN_INSTALL=\"$HOME/.bun\"; export PATH=\"$BUN_INSTALL/bin:$PATH\"; {s}mkdir -p /var/lib/selfhost; {s}mv -f /tmp/selfhost-agent.ts /var/lib/selfhost/agent.ts; {s}chmod +x /var/lib/selfhost/agent.ts", .{ deps_cmd, sudo_prefix, sudo_prefix, sudo_prefix })
    else
        try std.fmt.allocPrint(allocator, "{s}mkdir -p /var/lib/selfhost; {s}mv -f /tmp/selfhost-agent.ts /var/lib/selfhost/agent.ts; {s}chmod +x /var/lib/selfhost/agent.ts", .{ sudo_prefix, sudo_prefix, sudo_prefix });
    defer allocator.free(install_block);

    const server_url_esc = try shellEscapeSingleQuoted(allocator, server_url);
    defer allocator.free(server_url_esc);
    const start_b64_esc = try shellEscapeSingleQuoted(allocator, start_b64_len);
    defer allocator.free(start_b64_esc);
    const service_b64_esc = try shellEscapeSingleQuoted(allocator, service_b64_len);
    defer allocator.free(service_b64_esc);

    var remote_script = std.ArrayList(u8).initCapacity(allocator, 8192) catch return false;
    defer remote_script.deinit(allocator);
    try remote_script.writer(allocator).print(
        \\set -e
        \\echo "STEP: Cleaning up..."
        \\{s}pkill -f agent.ts || true
        \\{s}pkill -f start.sh || true
        \\{s}rm -f /var/log/selfhost-agent.log /tmp/selfhost-agent-wrapper.log || true
        \\{s}
        \\{s}pkill -f start.sh || true
        \\echo "STEP: Writing start script..."
        \\echo '{s}' | base64 -d | {s}tee /var/lib/selfhost/start.sh > /dev/null && {s}chmod +x /var/lib/selfhost/start.sh
        \\echo "STEP: Writing service file..."
        \\echo '{s}' | base64 -d | {s}tee {s} > /dev/null && {s}chmod {s} {s}
        \\echo "STEP: Enabling service..."
        \\{s}
        \\echo "STEP: Done."
        \\
    ,
        .{
            sudo_prefix,
            sudo_prefix,
            sudo_prefix,
            install_block,
            sudo_prefix,
            start_b64_esc,
            sudo_prefix,
            sudo_prefix,
            service_b64_esc,
            sudo_prefix,
            service_path,
            sudo_prefix,
            service_mode,
            service_path,
            enable_cmd,
        },
    );

    try appendSse(allocator, sse_out, "starting", "Starting SelfHost Agent service...", "in-progress");

    var ssh_install_args = std.ArrayList([]const u8).initCapacity(allocator, 14) catch return false;
    defer ssh_install_args.deinit(allocator);
    try ssh_install_args.append(allocator, "ssh");
    try ssh_install_args.append(allocator, "-i");
    try ssh_install_args.append(allocator, key_path_no_null);
    try ssh_install_args.append(allocator, "-o");
    try ssh_install_args.append(allocator, "StrictHostKeyChecking=no");
    try ssh_install_args.append(allocator, "-o");
    try ssh_install_args.append(allocator, "UserKnownHostsFile=/dev/null");
    try ssh_install_args.append(allocator, "-o");
    try ssh_install_args.append(allocator, "LogLevel=ERROR");
    try ssh_install_args.append(allocator, "-o");
    try ssh_install_args.append(allocator, "ConnectTimeout=30");
    if (server.port != 22) {
        try ssh_install_args.append(allocator, "-p");
        try ssh_install_args.append(allocator, port_str);
    }
    if (use_cloudflare) {
        try ssh_install_args.append(allocator, "-o");
        try ssh_install_args.append(allocator, "ProxyCommand=cloudflared access ssh --hostname %h");
    }
    try ssh_install_args.append(allocator, target);
    try ssh_install_args.append(allocator, "bash -s");

    var ssh_child = std.process.Child.init(ssh_install_args.items, allocator);
    ssh_child.stdin_behavior = .Pipe;
    ssh_child.stdout_behavior = .Pipe;
    ssh_child.stderr_behavior = .Pipe;
    ssh_child.spawn() catch |err| {
        log.err("ssh install spawn (target: {s}): {any}", .{ target, err });
        const msg = try std.fmt.allocPrint(allocator, "SSH install failed to start (target: {s}): {any}", .{ target, err });
        defer allocator.free(msg);
        try appendSse(allocator, sse_out, "error", msg, "error");
        return false;
    };
    const stdin = ssh_child.stdin orelse {
        _ = ssh_child.wait() catch {};
        try appendSse(allocator, sse_out, "error", "No stdin to SSH", "error");
        return false;
    };
    stdin.writeAll(remote_script.items) catch |err| {
        log.err("ssh stdin write: {any}", .{err});
        _ = ssh_child.wait() catch {};
        try appendSse(allocator, sse_out, "error", "Failed to send install script", "error");
        return false;
    };
    stdin.close();
    ssh_child.stdin = null;

    var install_stdout = std.ArrayList(u8).initCapacity(allocator, 4096) catch return false;
    defer install_stdout.deinit(allocator);
    var install_stderr = std.ArrayList(u8).initCapacity(allocator, 4096) catch return false;
    defer install_stderr.deinit(allocator); // Note: ArrayList.deinit takes allocator? No, Managed ArrayList deinit() takes nothing if it stores allocator. But here we might need to check if it stores it.

    // Collect output (this waits for process to exit)
    ssh_child.collectOutput(allocator, &install_stdout, &install_stderr, 50 * 1024) catch |err| {
        log.err("ssh collectOutput error: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Failed to capture install output", "error");
        return false;
    };
    log.info("Install STDOUT: {s}", .{install_stdout.items});

    const term_result = ssh_child.term;
    const install_term = if (term_result) |t| t catch |err| {
        log.err("ssh child term error: {any}", .{err});
        try appendSse(allocator, sse_out, "error", "Install process finished with error", "error");
        return false;
    } else null;

    if (install_term) |term| {
        switch (term) {
            .Exited => |code| if (code != 0) {
                // Error handling logic (keep existing)
                const stderr_raw = std.mem.trim(u8, install_stderr.items, &std.ascii.whitespace);
                log.err("Remote install script failed with code {d}. stderr: {s}", .{ code, stderr_raw });

                const stderr_safe = sanitizeStderrForDisplay(allocator, stderr_raw, 500) catch "Install script failed";
                defer if (stderr_safe.ptr != "Install script failed".ptr) allocator.free(stderr_safe);

                const msg = if (stderr_safe.len > 0 and !std.mem.eql(u8, stderr_safe, ""))
                    try std.fmt.allocPrint(allocator, "Remote install script failed: {s}", .{stderr_safe})
                else
                    try allocator.dupe(u8, "Remote install script failed (no error details)");
                defer allocator.free(msg);

                try appendSse(allocator, sse_out, "error", msg, "error");
                return false;
            },
            else => {
                try appendSse(allocator, sse_out, "error", "Install failed (signal/stopped)", "error");
                return false;
            },
        }
    } else {
        // Term is null - check stdout for success marker
        if (std.mem.indexOf(u8, install_stdout.items, "STEP: Done.") != null) {
            log.info("Install process term is null, but found success marker. Proceeding.", .{});
        } else {
            log.err("ssh child term is null and no success marker found", .{});
            try appendSse(allocator, sse_out, "error", "Install process state unknown (no success marker)", "error");
            return false;
        }
    }

    try appendSse(allocator, sse_out, "info", "Agent installed, verifying connection...", "info");

    // Wait a moment for service to start
    std.Thread.sleep(2 * std.time.ns_per_s);

    // Verify service is running and check connection status
    const verify_cmd = if (std.mem.eql(u8, init_system, "systemd"))
        "systemctl is-active selfhost-agent && tail -20 /var/log/selfhost-agent.log | grep -E '(Connected|Connection failed|Starting)' || echo 'Service not running'"
    else
        "rc-service selfhost-agent status && tail -20 /var/log/selfhost-agent.log | grep -E '(Connected|Connection failed|Starting)' || echo 'Service not running'";

    var verify_args = std.ArrayList([]const u8).initCapacity(allocator, 10) catch return false;
    defer verify_args.deinit(allocator);
    try verify_args.append(allocator, "ssh");
    try verify_args.append(allocator, "-i");
    try verify_args.append(allocator, key_path_no_null);
    try verify_args.append(allocator, "-o");
    try verify_args.append(allocator, "StrictHostKeyChecking=no");
    try verify_args.append(allocator, "-o");
    try verify_args.append(allocator, "UserKnownHostsFile=/dev/null");
    try verify_args.append(allocator, "-o");
    try verify_args.append(allocator, "LogLevel=ERROR");
    if (use_cloudflare) {
        try verify_args.append(allocator, "-o");
        try verify_args.append(allocator, "ProxyCommand=cloudflared access ssh --hostname %h");
    }
    try verify_args.append(allocator, target);
    try verify_args.append(allocator, verify_cmd);

    const verify_result = std.process.Child.run(.{
        .allocator = allocator,
        .argv = verify_args.items,
        .max_output_bytes = 1024 * 1024,
    }) catch |err| {
        log.warn("Failed to verify agent status: {any}", .{err});
        try appendSse(allocator, sse_out, "complete", "Agent installed (verification failed)", "complete");
        return true;
    };
    defer allocator.free(verify_result.stdout);
    defer allocator.free(verify_result.stderr);

    const verify_output = std.mem.trim(u8, verify_result.stdout, &std.ascii.whitespace);
    log.info("Agent verification output: {s}", .{verify_output});

    if (std.mem.indexOf(u8, verify_output, "active") != null or std.mem.indexOf(u8, verify_output, "started") != null) {
        if (std.mem.indexOf(u8, verify_output, "Connected") != null or std.mem.indexOf(u8, verify_output, "✅") != null) {
            try appendSse(allocator, sse_out, "complete", "Agent installed and connected successfully!", "complete");
        } else if (std.mem.indexOf(u8, verify_output, "Connection failed") != null or std.mem.indexOf(u8, verify_output, "❌") != null) {
            try appendSse(allocator, sse_out, "warning", "Agent installed but connection failed - check logs", "warning");
        } else {
            try appendSse(allocator, sse_out, "complete", "Agent installed and running", "complete");
        }
    } else {
        try appendSse(allocator, sse_out, "warning", "Agent installed but service not running", "warning");
    }

    return true;
}

fn startShContent(allocator: std.mem.Allocator, server_url: []const u8, server_id: []const u8, agent_key: []const u8, bun_path: []const u8) ![]const u8 {
    var out = std.ArrayList(u8).initCapacity(allocator, 1024) catch return error.OutOfMemory;
    errdefer out.deinit(allocator);
    var w = out.writer(allocator);
    try w.print(
        \\#!/bin/sh
        \\export SELFHOST_SERVER_URL="{s}"
        \\export SELFHOST_AGENT_ID="{s}"
        \\export SELFHOST_AGENT_KEY="{s}"
        \\export BUN_INSTALL="$HOME/.bun"
        \\export PATH="$BUN_INSTALL/bin:$PATH"
        \\exec 1>>/var/log/selfhost-agent.log 2>&1
        \\echo "--- Wrapper started at $(date) (PID: $$) ---"
        \\cleanup() {{ echo "Received stop signal..."; kill -TERM "$AGENT_PID" 2>/dev/null; wait "$AGENT_PID"; exit 0; }}
        \\trap cleanup TERM INT
        \\while true; do
        \\  echo "[$(date)] Starting SelfHost Agent..."
        \\  {s} run /var/lib/selfhost/agent.ts &
        \\  AGENT_PID=$!
        \\  wait "$AGENT_PID"
        \\  EXIT_CODE=$?
        \\  echo "Agent exited with code $EXIT_CODE"
        \\  if [ "$EXIT_CODE" -eq 0 ]; then echo "Agent exited cleanly. Stopping."; exit 0; fi
        \\  echo "Restarting in 1s..."; sleep 1
        \\done
        \\
    ,
        .{ server_url, server_id, agent_key, bun_path },
    );
    return try out.toOwnedSlice(allocator);
}

fn serviceFileContent(allocator: std.mem.Allocator, init_system: []const u8) ![]const u8 {
    if (std.mem.eql(u8, init_system, "systemd")) {
        return try allocator.dupe(u8,
            \\[Unit]
            \\Description=SelfHost Agent
            \\After=network.target
            \\
            \\[Service]
            \\Type=simple
            \\ExecStart=/var/lib/selfhost/start.sh
            \\Restart=always
            \\RestartSec=1
            \\
            \\[Install]
            \\WantedBy=multi-user.target
            \\
        );
    }
    if (std.mem.eql(u8, init_system, "openrc")) {
        return try allocator.dupe(u8,
            \\#!/sbin/openrc-run
            \\description="SelfHost Agent"
            \\command="/var/lib/selfhost/start.sh"
            \\command_background="yes"
            \\pidfile="/run/selfhost-agent.pid"
            \\respawn_delay=1
            \\respawn_max=0
            \\depend() { need net; after firewall; }
            \\
        );
    }
    return try allocator.dupe(u8, "");
}
