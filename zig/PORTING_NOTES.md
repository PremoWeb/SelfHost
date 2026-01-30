# Porting Notes - Staying True to Original

## Authentication & Authorization

### Original Structure
- Uses Better Auth for session management
- `requireApiAuth(locals)` in all API routes
- `locals.user`, `locals.team`, `locals.company` from hooks
- Casbin for RBAC (super_admin role)
- God users bypass all checks

### Zig Port
- ✅ Session validation (`auth/session.zig`)
- ✅ Permission checks (`auth/permissions.zig`)
- ✅ Auth middleware (`auth/middleware.zig`)
- ⚠️ Header extraction needs Zap API verification
- ⚠️ Casbin integration pending (C library needed)

## API Route Structure

### Original Pattern
```typescript
export const GET: RequestHandler = async ({ locals }) => {
    await requireApiAuth(locals);
    if (!locals.team) return json({ data: [] });
    const servers = await getServersByTeam(locals.team.id);
    return json({ data: servers });
};
```

### Zig Port Pattern
```zig
fn handleServers(r: Request, method: Method, ctx: *RequestContext) void {
    const team_id = ctx.team_id;
    const servers = try getServersByTeam(allocator, db, team_id);
    // ... serialize and send
}
```

## Service Layer

### Original Structure
- Services in `src/lib/server/services/`
- Functions like `getServersByTeam`, `createServer`, etc.
- Use Drizzle ORM for queries
- Return typed objects

### Zig Port
- Services in `zig/src/services/`
- Same function names and signatures where possible
- Use raw SQLite queries
- Return Zig structs matching original types

## Database Queries

### Original
- Uses Drizzle query builder
- Type-safe with TypeScript
- Relations handled automatically

### Zig Port
- Raw SQL queries (for now)
- Manual struct mapping
- TODO: Consider query builder library or macros

## Next Steps

1. **Complete Header Extraction** - Verify Zap API and implement properly
2. **Port More Services** - Companies, Projects, etc.
3. **Casbin Integration** - Link C library for RBAC
4. **Better Auth Compatibility** - Ensure session tokens work with existing auth
5. **Error Handling** - Match original error responses
