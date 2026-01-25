---
title: Action Logs
description: Comprehensive audit logging and action tracking system
---

# Action Logs & Audit Trail

SelfHost includes a comprehensive action logging system that tracks every action taken in the UI. This provides a complete audit trail for security, debugging, and compliance purposes.

## Overview

The action logging system records:

- **User Actions**: Every action taken by users in the UI
- **Impersonation Context**: Actions taken while impersonating other users
- **Request Details**: HTTP method, path, IP address, user agent
- **Resource Information**: What resource was affected (project, server, etc.)
- **Success/Failure**: Whether the action succeeded or failed
- **Error Messages**: Detailed error information for failed actions

## Accessing Action Logs

Action logs are accessible to **God users only** through the Action Logs page:

1. Navigate to **Action Logs** in the sidebar
2. View, filter, and search through all logged actions
3. Click on any log entry to see full details

## Logged Actions

The system automatically logs actions such as:

- **Project Operations**: Create, update, delete, share projects
- **Server Management**: Create, update, delete servers
- **User Management**: User creation, updates, role changes
- **Impersonation**: User impersonation start/stop
- **Context Switching**: Team and company context changes
- **Security Operations**: SSH key management, API token creation
- **And More**: Any action that modifies data or changes system state

## Log Entry Details

Each log entry contains:

### User Information

- **User ID**: The user who performed the action
- **User Name/Email**: Cached user information for quick reference
- **Impersonation Context**: If the action was taken while impersonating

### Action Information

- **Action**: The action type (e.g., `project.create`, `server.delete`)
- **Resource Type**: Type of resource affected (project, server, user, etc.)
- **Resource ID**: Specific resource identifier

### Request Context

- **HTTP Method**: GET, POST, PUT, DELETE, etc.
- **Path**: The API endpoint or page path
- **IP Address**: Client IP address
- **User Agent**: Browser/client information

### Team/Company Context

- **Team ID**: Active team when action was taken
- **Company ID**: Active company when action was taken

### Action Data

- **Metadata**: Additional context data (JSON)
- **Request Body**: Request payload (sensitive data redacted)
- **Success Status**: Whether the action succeeded
- **Error Message**: Error details if the action failed

### Timestamps

- **Created At**: When the action was logged

## Filtering Logs

The Action Logs page provides extensive filtering options:

### User Filters

- **User ID**: Filter by specific user
- **Impersonated By**: Find actions taken while impersonating

### Action Filters

- **Action**: Filter by action type (e.g., `project.create`)
- **Resource Type**: Filter by resource type (project, server, etc.)
- **Resource ID**: Find actions for a specific resource

### Context Filters

- **Team ID**: Filter by team context
- **Company ID**: Filter by company context

### Status Filters

- **Success**: Filter by success or failure status

### Date Filters

- **Start Date**: Filter actions after a specific date
- **End Date**: Filter actions before a specific date

## Sensitive Data Protection

The logging system automatically redacts sensitive information from request bodies:

- Passwords
- Secrets
- Tokens (API keys, access tokens, refresh tokens)
- Private keys
- SSH keys
- Credentials

Sensitive fields are replaced with `[REDACTED]` in the logs to protect sensitive data while maintaining audit trail usefulness.

## Database Storage

Action logs are stored in a **separate database** (`sqlite-logs.db` by default) to:

- Keep logs isolated from application data
- Allow independent backup and archival strategies
- Improve query performance
- Enable log retention policies

### Configuration

The logging database location can be configured:

```bash
LOGGING_DATABASE_URL=file:sqlite-logs.db
```

For remote databases:

```bash
LOGGING_DATABASE_URL=libsql://your-database-url
```

## Log Retention

Currently, logs are retained indefinitely. For production deployments, consider:

- **Automated Archival**: Archive old logs to cold storage
- **Retention Policies**: Implement log rotation and deletion policies
- **Backup Strategy**: Regularly backup the logging database
- **Performance Monitoring**: Monitor database size and query performance

## Use Cases

### Security Auditing

- Track who accessed what resources
- Identify suspicious activity patterns
- Investigate security incidents
- Comply with audit requirements

### Debugging

- Understand what actions led to an error
- Trace user workflows
- Identify system issues
- Reconstruct events leading to problems

### Compliance

- Maintain audit trails for regulatory compliance
- Document system access and changes
- Provide evidence for audits
- Track data access and modifications

### Performance Analysis

- Identify frequently performed actions
- Understand system usage patterns
- Optimize based on actual usage
- Plan capacity based on activity

## Querying Logs Programmatically

While the UI provides comprehensive filtering, you can also query logs programmatically using the `queryActionLogs` function:

```typescript
import { queryActionLogs } from '$lib/server/services/action-logger';

const logs = await queryActionLogs({
  userId: 'user-id',
  action: 'project.create',
  startDate: new Date('2024-01-01'),
  limit: 100
});
```

## Best Practices

### Regular Review

- Review logs regularly for security issues
- Monitor for unusual patterns
- Investigate failed actions promptly

### Log Analysis

- Use filters to focus on specific areas
- Export logs for external analysis if needed
- Set up alerts for critical failures

### Privacy

- Be mindful of logged data when sharing logs
- Redact additional sensitive information if exporting
- Follow data protection regulations

### Performance

- Use date filters to limit query scope
- Avoid querying all logs at once
- Consider pagination for large result sets

## Limitations

- **Storage**: Logs grow over time and require storage management
- **Performance**: Very large log databases may impact query performance
- **Privacy**: Some logged data may contain user information
- **Retention**: Currently no automatic log rotation (manual management required)

## Related Features

- [Impersonation & Context Switching](/docs/impersonation) - Understanding impersonation logging
- [Security](/security) - Security and access control
- [Projects](/docs/projects) - Project management
