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

    log.info("Agent will connect back to: {s}", .{server_url});

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
    // Line 5 = path from "command -v bun" (when bun exists), line 6 = version from "bun -v"
    const bun_path_line = lines.next() orelse "";
    _ = lines.next() orelse "";

    log.info("Detected: arch={s}, init={s}, user={s}, sudo={s}", .{ arch_line, init_system, whoami_line, sudo_line });

    log.info("Detected init system: {s}, user: {s}, has_sudo: {}", .{ init_system, whoami_line, std.mem.indexOf(u8, sudo_line, "has_sudo") != null });

    const is_root = std.mem.indexOf(u8, whoami_line, "root") != null;
    const has_sudo = std.mem.indexOf(u8, sudo_line, "has_sudo") != null;
    const sudo_prefix: []const u8 = if (has_sudo and !is_root) "sudo " else "";
    const bun_path_trimmed = std.mem.trim(u8, bun_path_line, &std.ascii.whitespace);
    // Line 5 is path from "command -v bun"; if it looks like a version (e.g. 1.3.6) ignore it
    const is_valid_path = bun_path_trimmed.len > 0 and std.mem.indexOf(u8, bun_path_trimmed, "/") != null;
    // When we install Bun ourselves we use fixed path so systemd (no HOME) finds it.
    const bun_path = if (is_valid_path)
        try allocator.dupe(u8, bun_path_trimmed)
    else
        try allocator.dupe(u8, "/var/lib/selfhost/.bun/bin/bun");
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

    // BUN_INSTALL dir for start.sh: strip "/bin/bun" from path so service finds Bun when systemd doesn't set HOME
    const bun_install_dir: []const u8 = if (std.mem.endsWith(u8, bun_path, "/bin/bun"))
        bun_path[0 .. bun_path.len - 8]
    else
        "/var/lib/selfhost/.bun";
    const start_sh_content = startShContent(allocator, server_url, server.id, agent_key_to_use, bun_path, bun_install_dir) catch |err| {
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
        try std.fmt.allocPrint(allocator, "{s}rm -f /etc/init.d/selfhost-agent && {s}systemctl daemon-reload && {s}systemctl enable selfhost-agent && {s}systemctl restart selfhost-agent < /dev/null > /dev/null 2>&1", .{ sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix })
    else
        try std.fmt.allocPrint(allocator, "{s}chmod +x /etc/init.d/selfhost-agent && {s}rc-update add selfhost-agent default && {s}rc-service selfhost-agent restart < /dev/null > /dev/null 2>&1", .{ sudo_prefix, sudo_prefix, sudo_prefix });
    defer allocator.free(enable_cmd);

    const deps_cmd = if (std.mem.eql(u8, init_system, "openrc"))
        // Alpine: Check each package before installing
        try std.fmt.allocPrint(allocator, "for pkg in curl bash unzip; do command -v $pkg >/dev/null 2>&1 || MISSING=\"$MISSING $pkg\"; done; [ -n \"$MISSING\" ] && {s}apk add --no-cache $MISSING || true", .{sudo_prefix})
    else
        // Debian/Ubuntu/RHEL: Check if commands exist before installing
        try std.fmt.allocPrint(allocator, "MISSING=\"\"; for cmd in curl bash unzip; do command -v $cmd >/dev/null 2>&1 || MISSING=\"$MISSING $cmd\"; done; [ -n \"$MISSING\" ] && (({s}command -v apt-get >/dev/null 2>&1 && {s}DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends $MISSING 2>/dev/null) || ({s}command -v yum >/dev/null 2>&1 && {s}yum install -y -q $MISSING) || ({s}command -v dnf >/dev/null 2>&1 && {s}dnf install -y -q $MISSING) || true)", .{ sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix, sudo_prefix });
    defer allocator.free(deps_cmd);

    // When installing Bun, use a fixed path under /var/lib/selfhost so the service finds it
    // regardless of $HOME (systemd/OpenRC often leave HOME unset). Must pass BUN_INSTALL into
    // the shell that runs the install script: with "curl | bash", the right-hand bash does NOT
    // inherit BUN_INSTALL from the left side, so we use "env BUN_INSTALL=... bash -c 'curl | bash'".
    const bun_fixed_path = "/var/lib/selfhost/.bun";
    const need_install_bun = std.mem.eql(u8, bun_path, "/var/lib/selfhost/.bun/bin/bun");
    const install_block = if (need_install_bun)
        try std.fmt.allocPrint(allocator, "{s} && {s}mkdir -p /var/lib/selfhost && command -v bun >/dev/null 2>&1 || ({s}env BUN_INSTALL={s} bash -c 'curl -fsSL https://bun.sh/install | bash'); {s}mv -f /tmp/selfhost-agent.ts /var/lib/selfhost/agent.ts; {s}chmod +x /var/lib/selfhost/agent.ts", .{ deps_cmd, sudo_prefix, sudo_prefix, bun_fixed_path, sudo_prefix, sudo_prefix })
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
        \\echo "STEP: Writing start script..."
        \\echo '{s}' | base64 -d | {s}tee /var/lib/selfhost/start.sh > /dev/null && {s}chmod +x /var/lib/selfhost/start.sh
        \\echo "STEP: Writing service file..."
        \\echo '{s}' | base64 -d | {s}tee {s} > /dev/null && {s}chmod {s} {s}
        \\echo "STEP: Enabling service..."
        \\{s}
        \\echo "STEP: Done."
        \\sync
        \\exit 0
    ,
        .{
            sudo_prefix,
            sudo_prefix,
            sudo_prefix,
            install_block,
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

    var ssh_install_args = std.ArrayList([]const u8).initCapacity(allocator, 25) catch return false;
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
    try ssh_install_args.append(allocator, "BatchMode=yes");
    try ssh_install_args.append(allocator, "-o");
    try ssh_install_args.append(allocator, "ConnectTimeout=15");
    try ssh_install_args.append(allocator, "-o");
    try ssh_install_args.append(allocator, "ServerAliveInterval=15");
    try ssh_install_args.append(allocator, "-o");
    try ssh_install_args.append(allocator, "ServerAliveCountMax=3");
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
    log.info("Sending installation script to SSH...", .{});
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

    var verify_args = std.ArrayList([]const u8).initCapacity(allocator, 14) catch return false;
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
    try verify_args.append(allocator, "-o");
    try verify_args.append(allocator, "ConnectTimeout=45");
    if (server.port != 22) {
        try verify_args.append(allocator, "-p");
        try verify_args.append(allocator, port_str);
    }
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

/// Build start.sh content. bun_install_dir is the Bun install directory (e.g. /var/lib/selfhost/.bun)
/// so BUN_INSTALL is set correctly when systemd does not set HOME.
fn startShContent(allocator: std.mem.Allocator, server_url: []const u8, server_id: []const u8, agent_key: []const u8, bun_path: []const u8, bun_install_dir: []const u8) ![]const u8 {
    var out = std.ArrayList(u8).initCapacity(allocator, 1024) catch return error.OutOfMemory;
    errdefer out.deinit(allocator);
    var w = out.writer(allocator);
    try w.print(
        \\#!/bin/sh
        \\exec </dev/null
        \\exec >>/var/log/selfhost-agent.log
        \\exec 2>&1
        \\export SELFHOST_SERVER_URL="{s}"
        \\export SELFHOST_AGENT_ID="{s}"
        \\export SELFHOST_AGENT_KEY="{s}"
        \\export BUN_INSTALL="{s}"
        \\export PATH="$BUN_INSTALL/bin:$PATH"
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
        .{ server_url, server_id, agent_key, bun_install_dir, bun_path },
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
            \\stdout_log="/var/log/selfhost-agent.log"
            \\stderr_log="/var/log/selfhost-agent.log"
            \\respawn_delay=1
            \\respawn_max=0
            \\depend() { need net; after firewall; }
            \\
        );
    }
    return try allocator.dupe(u8, "");
}

/// Remote diagnostic script: init system, service status, Bun paths, agent log, unit/script.
const diagnose_script =
    \\echo "========== INIT SYSTEM =========="
    \\if [ -d /run/systemd/system ]; then echo "systemd"; systemctl is-active selfhost-agent 2>/dev/null || true; systemctl status selfhost-agent --no-pager 2>/dev/null || true
    \\elif [ -f /sbin/openrc ]; then echo "openrc"; rc-service selfhost-agent status 2>/dev/null || true
    \\else echo "unknown"; fi
    \\
    \\echo ""
    \\echo "========== BUN / START SCRIPT =========="
    \\echo "Bun at fixed path:"; ls -la /var/lib/selfhost/.bun/bin/bun 2>/dev/null || echo "(not found)"
    \\echo "Bun in PATH:"; command -v bun 2>/dev/null || echo "(not found)"
    \\echo "start.sh BUN_INSTALL line:"; grep -E "^export BUN_INSTALL=" /var/lib/selfhost/start.sh 2>/dev/null || echo "(no start.sh or no BUN_INSTALL)"
    \\echo "start.sh first 20 lines:"; head -20 /var/lib/selfhost/start.sh 2>/dev/null || echo "(no start.sh)"
    \\
    \\echo ""
    \\echo "========== AGENT LOG (last 80 lines) =========="
    \\if [ -f /var/log/selfhost-agent.log ]; then tail -80 /var/log/selfhost-agent.log; else echo "(no log file)"; fi
    \\
    \\echo ""
    \\echo "========== SERVICE UNIT (if systemd) =========="
    \\[ -f /etc/systemd/system/selfhost-agent.service ] && cat /etc/systemd/system/selfhost-agent.service || true
    \\echo ""
    \\echo "========== OPENRC SCRIPT (if openrc) =========="
    \\[ -f /etc/init.d/selfhost-agent ] && head -30 /etc/init.d/selfhost-agent || true
;

/// SSH to server (tunnel or direct) and run diagnostic script. Caller owns returned string.
pub fn runDiagnoseAgent(
    allocator: std.mem.Allocator,
    server: *servers_service.Server,
    private_key_pem: []const u8,
) ![]const u8 {
    var rand_buf: [8]u8 = undefined;
    std.crypto.random.bytes(&rand_buf);
    const hex_suffix = std.fmt.bytesToHex(rand_buf, .lower);
    var key_path_buf: [64]u8 = undefined;
    const key_path = std.fmt.bufPrintZ(&key_path_buf, "/tmp/selfhost-key-{s}", .{hex_suffix}) catch return error.OutOfMemory;
    const key_file = std.fs.createFileAbsolute(key_path[0 .. key_path.len - 1], .{ .mode = 0o600 }) catch |err| {
        log.err("diagnose: create temp key file: {any}", .{err});
        return err;
    };
    defer key_file.close();
    defer std.posix.unlink(key_path) catch {};
    key_file.writeAll(private_key_pem) catch |err| {
        log.err("diagnose: write key: {any}", .{err});
        return err;
    };
    const key_path_no_null = key_path[0 .. key_path.len - 1];

    const use_cloudflare = server.cloudflare_tunnel_hostname != null and server.cloudflare_tunnel_hostname.?.len > 0;
    const host = if (use_cloudflare) server.cloudflare_tunnel_hostname.? else server.ip;
    var target_buf: [256]u8 = undefined;
    const target = std.fmt.bufPrint(&target_buf, "{s}@{s}", .{ server.user, host }) catch return error.OutOfMemory;
    const port_str = if (server.port == 22) "" else try std.fmt.allocPrint(allocator, "{d}", .{server.port});
    defer if (server.port != 22) allocator.free(port_str);

    var argv = std.ArrayList([]const u8).initCapacity(allocator, 18) catch return error.OutOfMemory;
    defer argv.deinit(allocator);
    try argv.append(allocator, "ssh");
    try argv.append(allocator, "-i");
    try argv.append(allocator, key_path_no_null);
    try argv.append(allocator, "-o");
    try argv.append(allocator, "StrictHostKeyChecking=no");
    try argv.append(allocator, "-o");
    try argv.append(allocator, "UserKnownHostsFile=/dev/null");
    try argv.append(allocator, "-o");
    try argv.append(allocator, "LogLevel=ERROR");
    try argv.append(allocator, "-o");
    try argv.append(allocator, "ConnectTimeout=45");
    if (server.port != 22) {
        try argv.append(allocator, "-p");
        try argv.append(allocator, port_str);
    }
    if (use_cloudflare) {
        try argv.append(allocator, "-o");
        try argv.append(allocator, "ProxyCommand=cloudflared access ssh --hostname %h");
    }
    try argv.append(allocator, target);
    try argv.append(allocator, "bash -s");

    var child = std.process.Child.init(argv.items, allocator);
    child.stdin_behavior = .Pipe;
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Pipe;
    child.spawn() catch |err| {
        log.err("diagnose: ssh spawn failed: {any}", .{err});
        return err;
    };
    const stdin = child.stdin orelse {
        _ = child.wait() catch {};
        return error.NoStdin;
    };
    stdin.writeAll(diagnose_script) catch |err| {
        log.err("diagnose: write script: {any}", .{err});
        _ = child.wait() catch {};
        return err;
    };
    stdin.close();
    child.stdin = null;

    var stdout = std.ArrayList(u8).initCapacity(allocator, 8192) catch return error.OutOfMemory;
    defer stdout.deinit(allocator);
    var stderr = std.ArrayList(u8).initCapacity(allocator, 2048) catch return error.OutOfMemory;
    defer stderr.deinit(allocator);
    child.collectOutput(allocator, &stdout, &stderr, 256 * 1024) catch |err| {
        log.err("diagnose: collectOutput: {any}", .{err});
        return err;
    };
    _ = child.wait() catch {};

    var out = std.ArrayList(u8).initCapacity(allocator, stdout.items.len + stderr.items.len + 64) catch return error.OutOfMemory;
    defer out.deinit(allocator);
    out.appendSlice(allocator, stdout.items) catch return error.OutOfMemory;
    if (stderr.items.len > 0) {
        out.appendSlice(allocator, "\n--- stderr ---\n") catch return error.OutOfMemory;
        out.appendSlice(allocator, stderr.items) catch return error.OutOfMemory;
    }
    return try out.toOwnedSlice(allocator);
}
