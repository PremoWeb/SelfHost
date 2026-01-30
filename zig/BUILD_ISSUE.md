# Build Issue - Zig 0.15.2

## Problem

When running `zig build`, we get this error:
```
/home/nick/Projects/selfhost/zig/build.zig.zon:2:13: error: expected enum literal
    .name = "selfhost-server",
            ^~~~~~~~~~~~~~~~~
```

## Current build.zig.zon

```zig
.{
    .name = "selfhost-server",
    .version = "0.1.0",
    .paths = .{""},
    .dependencies = .{
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/refs/heads/main.tar.gz",
            .hash = "",
        },
    },
}
```

## Possible Causes

1. **Zig 0.15.2 format change** - The build.zig.zon format may have changed
2. **Empty hash** - The empty hash field might be causing parsing issues
3. **Parser bug** - There might be a bug in Zig 0.15.2's build.zig.zon parser

## Workarounds

### Option 1: Fetch dependency first
```bash
zig fetch .
```
This should populate the hash field, but it requires network access.

### Option 2: Use a known hash
If you have the hash from a previous successful fetch, add it to the `.hash` field.

### Option 3: Temporarily remove build.zig.zon
We can modify `build.zig` to fetch the dependency directly without using build.zig.zon.

## Next Steps

1. Try fetching the dependency with network access to get the hash
2. Check Zig 0.15.2 documentation for build.zig.zon format changes
3. Consider downgrading to Zig 0.12 if format compatibility is needed
