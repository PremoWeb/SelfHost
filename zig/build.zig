const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Add Zap dependency
    const zap_mod = b.dependency("zap", .{
        .target = target,
        .optimize = optimize,
    });

    // Main server executable
    const root_mod = b.addModule("root", .{ .root_source_file = b.path("src/main.zig") });
    root_mod.addImport("zap", zap_mod.module("zap"));
    root_mod.resolved_target = target;
    root_mod.optimize = optimize;

    const exe = b.addExecutable(.{
        .name = "selfhost-server",
        .root_module = root_mod,
    });

    // Link against SQLite and system libraries
    exe.linkLibrary(zap_mod.artifact("facil.io"));
    exe.linkSystemLibrary("sqlite3");
    exe.linkLibC();
    exe.linkLibCpp(); // Zap may need C++

    // Install executable
    b.installArtifact(exe);

    // Run executable
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the server");
    run_step.dependOn(&run_cmd.step);

    // Test step
    const test_root = b.addModule("root_test", .{ .root_source_file = b.path("src/main.zig") });
    test_root.addImport("zap", zap_mod.module("zap"));
    test_root.resolved_target = target;
    test_root.optimize = optimize;
    const unit_tests = b.addTest(.{
        .root_module = test_root,
    });
    unit_tests.linkLibrary(zap_mod.artifact("facil.io"));
    unit_tests.linkSystemLibrary("sqlite3");
    unit_tests.linkLibC();
    unit_tests.linkLibCpp();

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
