// JSON Serialization Helpers
// Converts Zig structs to JSON strings for API responses

const std = @import("std");

pub fn serializeServer(allocator: std.mem.Allocator, server: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    try writer.print(
        \\{{"id":"{s}","name":"{s}","ip":"{s}","port":{d},"user":"{s}","status":"{s}","application_count":{d},"database_count":{d},"created_at":{d},"updated_at":{d}
    ,
        .{
            server.id,
            server.name,
            server.ip,
            server.port,
            server.user,
            server.status,
            server.application_count,
            server.database_count,
            server.created_at,
            server.updated_at,
        },
    );

    // Add optional fields
    if (server.description) |desc| {
        try writer.print(",\"description\":\"{s}\"", .{desc});
    }
    if (server.ipv6) |ipv6| {
        try writer.print(",\"ipv6\":\"{s}\"", .{ipv6});
    }
    if (server.region) |region| {
        try writer.print(",\"region\":\"{s}\"", .{region});
    }
    if (server.team_id) |team_id| {
        try writer.print(",\"team_id\":\"{s}\"", .{team_id});
    }
    if (server.owner_type) |owner_type| {
        try writer.print(",\"owner_type\":\"{s}\"", .{owner_type});
    }
    if (server.owner_id) |owner_id| {
        try writer.print(",\"owner_id\":\"{s}\"", .{owner_id});
    }
    if (server.provider_name) |provider_name| {
        try writer.print(",\"provider_name\":\"{s}\"", .{provider_name});
    }
    if (server.provider_type) |provider_type| {
        try writer.print(",\"provider_type\":\"{s}\"", .{provider_type});
    }
    if (server.private_key_id) |private_key_id| {
        try writer.print(",\"private_key_id\":\"{s}\"", .{private_key_id});
    }
    if (server.connection_type) |connection_type| {
        try writer.print(",\"connection_type\":\"{s}\"", .{connection_type});
    }
    if (server.tags) |tags| {
        try writer.print(",\"tags\":{s}", .{tags});
    }
    try writer.print(",\"health_cpu\":{d},\"health_memory\":{d},\"health_disk\":{d}", .{
        server.health_cpu,
        server.health_memory,
        server.health_disk,
    });
    if (server.health_updated_at) |health_updated_at| {
        try writer.print(",\"health_updated_at\":{d}", .{health_updated_at});
    }
    if (server.proxy_type) |proxy_type| {
        try writer.print(",\"proxy_type\":\"{s}\"", .{proxy_type});
    }
    if (server.proxy_status) |proxy_status| {
        try writer.print(",\"proxy_status\":\"{s}\"", .{proxy_status});
    }
    if (server.agent_key) |agent_key| {
        try writer.print(",\"agent_key\":\"{s}\"", .{agent_key});
    }
    if (server.agent_checksum) |agent_checksum| {
        try writer.print(",\"agent_checksum\":\"{s}\"", .{agent_checksum});
    }
    if (server.agent_version) |agent_version| {
        try writer.print(",\"agent_version\":\"{s}\"", .{agent_version});
    }
    if (server.agent_installed_at) |agent_installed_at| {
        try writer.print(",\"agent_installed_at\":{d}", .{agent_installed_at});
    }

    try writer.print("}}", .{});

    return try json.toOwnedSlice(allocator);
}

pub fn serializeServerArray(allocator: std.mem.Allocator, servers: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    try writer.print("{{\"data\":[", .{});

    for (servers.items, 0..) |server, i| {
        if (i > 0) {
            try writer.print(",", .{});
        }

        const server_json = try serializeServer(allocator, server);
        defer allocator.free(server_json);
        try writer.print("{s}", .{server_json});
    }

    try writer.print("]}}", .{});

    return try json.toOwnedSlice(allocator);
}

/// Serialize company to JSON
pub fn serializeCompany(allocator: std.mem.Allocator, company: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    const id_escaped = try escapeJson(allocator, company.id);
    defer allocator.free(id_escaped);
    const name_escaped = try escapeJson(allocator, company.name);
    defer allocator.free(name_escaped);
    const slug_escaped = try escapeJson(allocator, company.slug);
    defer allocator.free(slug_escaped);
    const created_by_escaped = try escapeJson(allocator, company.created_by);
    defer allocator.free(created_by_escaped);

    try writer.print(
        \\{{"id":"{s}","name":"{s}","slug":"{s}","created_by":"{s}","settings":{s},"created_at":{d},"updated_at":{d}
    ,
        .{
            id_escaped,
            name_escaped,
            slug_escaped,
            created_by_escaped,
            company.settings, // Already JSON
            company.created_at,
            company.updated_at,
        },
    );

    if (company.description) |desc| {
        const desc_escaped = try escapeJson(allocator, desc);
        defer allocator.free(desc_escaped);
        try writer.print(",\"description\":\"{s}\"", .{desc_escaped});
    }
    if (company.billing_profile_id) |bpid| {
        const bpid_escaped = try escapeJson(allocator, bpid);
        defer allocator.free(bpid_escaped);
        try writer.print(",\"billing_profile_id\":\"{s}\"", .{bpid_escaped});
    }

    try writer.print("}}", .{});

    return try json.toOwnedSlice(allocator);
}

/// Serialize company array to JSON
pub fn serializeCompanyArray(allocator: std.mem.Allocator, companies: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    try writer.print("{{\"data\":[", .{});

    for (companies.items, 0..) |company, i| {
        if (i > 0) {
            try writer.print(",", .{});
        }

        const company_json = try serializeCompany(allocator, company);
        defer allocator.free(company_json);
        try writer.print("{s}", .{company_json});
    }

    try writer.print("]}}", .{});

    return try json.toOwnedSlice(allocator);
}

/// Serialize user to JSON (id, name, email, email_verified, is_god, image)
pub fn serializeUser(allocator: std.mem.Allocator, user: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    const id_escaped = try escapeJson(allocator, user.id);
    defer allocator.free(id_escaped);
    const name_escaped = try escapeJson(allocator, user.name);
    defer allocator.free(name_escaped);
    const email_escaped = try escapeJson(allocator, user.email);
    defer allocator.free(email_escaped);

    try writer.print(
        \\{{"id":"{s}","name":"{s}","email":"{s}","email_verified":{},"is_god":{}
    ,
        .{
            id_escaped,
            name_escaped,
            email_escaped,
            user.email_verified,
            user.is_god,
        },
    );
    if (user.image) |img| {
        const img_escaped = try escapeJson(allocator, img);
        defer allocator.free(img_escaped);
        try writer.print(",\"image\":\"{s}\"", .{img_escaped});
    } else {
        try writer.print(",\"image\":null", .{});
    }
    try writer.print("}}", .{});
    return try json.toOwnedSlice(allocator);
}

/// Serialize user array to JSON { "data": [ ... ] }
pub fn serializeUserArray(allocator: std.mem.Allocator, users: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    try writer.print("{{\"data\":[", .{});
    for (users.items, 0..) |user, i| {
        if (i > 0) try writer.print(",", .{});
        const user_json = try serializeUser(allocator, user);
        defer allocator.free(user_json);
        try writer.print("{s}", .{user_json});
    }
    try writer.print("]}}", .{});
    return try json.toOwnedSlice(allocator);
}

/// Serialize VPS provider to JSON (omit api_key for security)
pub fn serializeVpsProvider(allocator: std.mem.Allocator, provider: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 384) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    const id_escaped = try escapeJson(allocator, provider.id);
    defer allocator.free(id_escaped);
    const name_escaped = try escapeJson(allocator, provider.name);
    defer allocator.free(name_escaped);
    const type_escaped = try escapeJson(allocator, provider.type_name);
    defer allocator.free(type_escaped);

    try writer.print(
        \\{{"id":"{s}","name":"{s}","type":"{s}","dns_enabled":{},"server_count":{d},"application_count":{d},"database_count":{d},"domain_count":{d},"created_at":{d},"updated_at":{d}
    ,
        .{
            id_escaped,
            name_escaped,
            type_escaped,
            provider.dns_enabled,
            provider.server_count,
            provider.application_count,
            provider.database_count,
            provider.domain_count,
            provider.created_at,
            provider.updated_at,
        },
    );
    try writer.print("}}", .{});
    return try json.toOwnedSlice(allocator);
}

/// Serialize VPS provider array to JSON { "data": [ ... ] }
pub fn serializeVpsProviderArray(allocator: std.mem.Allocator, providers: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    try writer.print("{{\"data\":[", .{});
    for (providers.items, 0..) |provider, i| {
        if (i > 0) try writer.print(",", .{});
        const prov_json = try serializeVpsProvider(allocator, provider);
        defer allocator.free(prov_json);
        try writer.print("{s}", .{prov_json});
    }
    try writer.print("]}}", .{});
    return try json.toOwnedSlice(allocator);
}

/// Serialize Cloudflare token to JSON (omit client_secret for security in list; include in create response if needed)
pub fn serializeCloudflareToken(allocator: std.mem.Allocator, token: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 384) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    const id_escaped = try escapeJson(allocator, token.id);
    defer allocator.free(id_escaped);
    const name_escaped = try escapeJson(allocator, token.name);
    defer allocator.free(name_escaped);
    const client_id_escaped = try escapeJson(allocator, token.client_id);
    defer allocator.free(client_id_escaped);

    try writer.print(
        \\{{"id":"{s}","name":"{s}","client_id":"{s}","created_at":{d},"updated_at":{d}
    ,
        .{
            id_escaped,
            name_escaped,
            client_id_escaped,
            token.created_at,
            token.updated_at,
        },
    );
    if (token.description) |desc| {
        const desc_escaped = try escapeJson(allocator, desc);
        defer allocator.free(desc_escaped);
        try writer.print(",\"description\":\"{s}\"", .{desc_escaped});
    }
    try writer.print("}}", .{});
    return try json.toOwnedSlice(allocator);
}

/// Serialize Cloudflare token array to JSON { "data": [ ... ] }
pub fn serializeCloudflareTokenArray(allocator: std.mem.Allocator, tokens: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    try writer.print("{{\"data\":[", .{});
    for (tokens.items, 0..) |token, i| {
        if (i > 0) try writer.print(",", .{});
        const tok_json = try serializeCloudflareToken(allocator, token);
        defer allocator.free(tok_json);
        try writer.print("{s}", .{tok_json});
    }
    try writer.print("]}}", .{});
    return try json.toOwnedSlice(allocator);
}

/// Escape JSON string (simple version - escapes quotes and backslashes)
pub fn escapeJson(allocator: std.mem.Allocator, str: []const u8) ![]const u8 {
    var result = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer result.deinit(allocator);

    for (str) |char| {
        switch (char) {
            '"' => try result.writer(allocator).print("\\\"", .{}),
            '\\' => try result.writer(allocator).print("\\\\", .{}),
            '\n' => try result.writer(allocator).print("\\n", .{}),
            '\r' => try result.writer(allocator).print("\\r", .{}),
            '\t' => try result.writer(allocator).print("\\t", .{}),
            else => try result.append(allocator, char),
        }
    }

    return try result.toOwnedSlice(allocator);
}

/// Serialize project to JSON
pub fn serializeProject(allocator: std.mem.Allocator, project: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    const id_escaped = try escapeJson(allocator, project.id);
    defer allocator.free(id_escaped);
    const name_escaped = try escapeJson(allocator, project.name);
    defer allocator.free(name_escaped);

    try writer.print(
        \\{{"id":"{s}","name":"{s}","created_at":{d},"updated_at":{d}
    ,
        .{
            id_escaped,
            name_escaped,
            project.created_at,
            project.updated_at,
        },
    );

    if (project.description) |desc| {
        const desc_escaped = try escapeJson(allocator, desc);
        defer allocator.free(desc_escaped);
        try writer.print(",\"description\":\"{s}\"", .{desc_escaped});
    }
    if (project.team_id) |tid| {
        const tid_escaped = try escapeJson(allocator, tid);
        defer allocator.free(tid_escaped);
        try writer.print(",\"team_id\":\"{s}\"", .{tid_escaped});
    }
    if (project.client_id) |cid| {
        const cid_escaped = try escapeJson(allocator, cid);
        defer allocator.free(cid_escaped);
        try writer.print(",\"client_id\":\"{s}\"", .{cid_escaped});
    }
    if (project.category_id) |cid| {
        const cid_escaped = try escapeJson(allocator, cid);
        defer allocator.free(cid_escaped);
        try writer.print(",\"category_id\":\"{s}\"", .{cid_escaped});
    }
    if (project.billing_profile_id) |bpid| {
        const bpid_escaped = try escapeJson(allocator, bpid);
        defer allocator.free(bpid_escaped);
        try writer.print(",\"billing_profile_id\":\"{s}\"", .{bpid_escaped});
    }
    if (project.company_id) |cid| {
        const cid_escaped = try escapeJson(allocator, cid);
        defer allocator.free(cid_escaped);
        try writer.print(",\"company_id\":\"{s}\"", .{cid_escaped});
    }

    try writer.print("}}", .{});

    return try json.toOwnedSlice(allocator);
}

/// Serialize project array to JSON
pub fn serializeProjectArray(allocator: std.mem.Allocator, projects: anytype) ![]const u8 {
    var json = std.ArrayList(u8).initCapacity(allocator, 256) catch return error.OutOfMemory;
    errdefer json.deinit(allocator);
    var writer = json.writer(allocator);

    try writer.print("{{\"data\":[", .{});

    for (projects.items, 0..) |project, i| {
        if (i > 0) {
            try writer.print(",", .{});
        }

        const project_json = try serializeProject(allocator, project);
        defer allocator.free(project_json);
        try writer.print("{s}", .{project_json});
    }

    try writer.print("]}}", .{});

    return try json.toOwnedSlice(allocator);
}
