---
title: Impersonation & Context Switching
description: Understanding God mode, user impersonation, and team/company context switching
---

# Impersonation & Context Switching

SelfHost provides powerful administrative features that allow God users (super administrators) to impersonate other users and switch between different team and company contexts. This enables administrators to troubleshoot issues, verify permissions, and manage resources from different perspectives.

## Overview

The system supports two main types of administrative actions:

1. **User Impersonation**: Temporarily act as another user, seeing exactly what they see
2. **Context Switching**: View data and resources from a specific team or company's perspective without fully impersonating a user

## User Impersonation

User impersonation allows God users to temporarily log in as another user, experiencing the application exactly as that user would. This is useful for:

- Debugging user-specific issues
- Verifying permissions and access controls
- Testing workflows from a user's perspective
- Providing support for user problems

### How It Works

When you impersonate a user:

1. A prominent yellow banner appears at the top of the screen indicating you're in impersonation mode
2. The banner shows:
   - Who you're impersonating
   - Who you're logged in as (the God user)
   - An "Exit Impersonation" button
3. All data, permissions, and UI elements reflect the impersonated user's perspective
4. Actions taken while impersonating are attributed to the impersonated user, not the God user

### Using User Impersonation

1. Navigate to the **Context Switcher** (available in the sidebar for God users)
2. Find the user you want to impersonate
3. Click the **User Check** icon (✓) next to their name
4. The page will reload, and you'll be viewing the application as that user

### Exiting Impersonation

- Click the **Exit Impersonation** button in the yellow banner at the top of the screen
- Or use the context switcher to stop impersonating

## Context Switching

Context switching allows God users to view data and resources from a specific team or company's perspective without fully impersonating a user. This is useful for:

- Viewing team-specific projects, servers, and deployments
- Managing resources for a specific team or company
- Understanding what data a team can access
- Testing team-level permissions

### Team Context Switching

When you switch to a team context:

1. A yellow banner appears indicating you're viewing a different context
2. The dashboard and all pages show data filtered to that team:
   - Projects belonging to that team
   - Servers assigned to that team
   - Deployment counts for that team
   - Team-specific settings and configurations
3. You can create projects, manage servers, and perform actions as if you were operating within that team's context
4. However, permissions are still checked based on the team owner's permissions, not your God user permissions

### Company Context Switching

Similar to team context switching, but for company-level resources:

- View company-wide data and resources
- Manage company-level settings
- See all teams and users within the company

### Using Context Switching

1. Navigate to the **Context Switcher** in the sidebar
2. Find the team or company you want to view
3. Click on the team or company name (not the User Check icon)
4. The page will reload with that context active

### Returning to God Mode

- Click the **Return to God Mode** button in the yellow banner
- Or switch to an empty team context using the context switcher

## God Mode

When you're logged in as a God user without any active impersonation or context switching, you're in "God Mode". In this mode:

- You can see **all** projects, servers, and deployments across the entire system
- Dashboard statistics show global counts
- You can create projects without being part of a team
- You can share projects with any team
- You have access to all administrative features

### Creating Projects in God Mode

God users can create projects even without an active team context. These projects will have `teamId: null` and can be:

- Assigned to teams later
- Shared with multiple teams
- Managed directly by the God user

## The Impersonation Banner

A prominent yellow banner appears at the top of the screen whenever:

- You're actively impersonating a user
- You're viewing a different team or company context as a God user

The banner provides:

- **Clear indication** of the current mode (impersonation vs. context switching)
- **Context information** showing who/what you're viewing
- **Quick exit** button to return to normal mode or God mode

> **Security Note**: The banner is always visible and cannot be dismissed without exiting impersonation or context switching. This prevents accidental actions while in an elevated state.

## Security Considerations

### Permission Checks

When impersonating or switching context:

- **User Impersonation**: All permission checks use the impersonated user's permissions
- **Team Context**: Permission checks use the team owner's permissions, not the God user's
- **Company Context**: Permission checks use the company owner's permissions

This ensures that God users can't accidentally bypass security controls or see data they shouldn't have access to in a specific context.

### Audit Trail

All actions taken while impersonating or in a switched context are logged with:

- The actual user who performed the action (impersonated user or team owner)
- The God user who initiated the impersonation/context switch
- Timestamp and action details

### Best Practices

1. **Use sparingly**: Only impersonate or switch context when necessary for support or debugging
2. **Exit promptly**: Always exit impersonation or return to God mode when finished
3. **Verify permissions**: Double-check that you're seeing the correct data for the context
4. **Document actions**: Note what you did while impersonating for audit purposes

## Technical Details

### How It Works Under the Hood

1. **User Impersonation**: Uses Better Auth's admin plugin to set an `impersonatedBy` cookie
2. **Context Switching**: Sets custom cookies (`impersonated_type`, `impersonated_id`, `impersonated_by`) to track the active context
3. **Session Management**: The active team/company context is stored in the session record
4. **Data Filtering**: Server-side hooks (`hooks.server.ts`) read the impersonation/context state and filter all data queries accordingly

### Cookie Management

The system automatically manages cookies for:

- Better Auth session
- Impersonation state
- Active team/company context

All cookies are properly scoped with appropriate security flags (httpOnly, secure, sameSite).

## Troubleshooting

### Banner Not Appearing

If the impersonation banner doesn't appear:

1. Check that you're actually in impersonation or context switching mode
2. Verify your browser isn't blocking cookies
3. Try refreshing the page
4. Check browser console for any errors

### Can't Exit Impersonation

If you can't exit impersonation:

1. Try clicking the exit button multiple times
2. Clear your browser cookies for the domain
3. Log out and log back in as the God user

### Data Not Filtering Correctly

If data isn't being filtered to the active context:

1. Verify the context switch was successful (check the banner)
2. Refresh the page
3. Check server logs for any errors in the hooks or data loading

## Related Features

- [Projects](/docs/projects) - Learn about project management
- [Security](/security) - Security and permissions overview
