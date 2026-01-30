// Shared SQLite C bindings
// All files should import this instead of doing their own @cImport
// This ensures all files use the same opaque type

pub const sqlite = @cImport({
    @cInclude("sqlite3.h");
});
