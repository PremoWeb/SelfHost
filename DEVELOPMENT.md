# SelfHost Development Guide

## 🎯 Overview

This guide will help you get started with developing the SvelteKit frontend for SelfHost.

## 📋 Prerequisites Checklist

- [ ] Bun 1.3.7+ installed (`bun --version`)
- [ ] Docker and Docker Compose installed
- [ ] Git repository cloned
- [ ] Familiarity with Svelte 5 (Runes API)
- [ ] Basic understanding of SvelteKit (Full-stack)

## 🚨 Rules

- **ALWAYS** use `bun` instead of `node` or `npm`.
- **ALWAYS** use `@types/bun` instead of `@types/node`.
- **NEVER** use `process` from Node.js types, rely on Bun globals.

## 🚦 Getting Started

### 1. Initial Setup

```bash
# Navigate to the project directory (already there)
cd ./

# Dependencies should already be installed, but if needed:
bun install

# Copy environment file (usually already done)
cp .env.example .env
```

### 2. Start Development Environment

**Option A: Full Stack with Docker (Recommended)**

```bash
# Start all services (frontend, backend, database, etc.)
docker compose -f docker-compose.dev.yml up

# Or run in detached mode
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f sveltekit
```

**Option B: Frontend Only**

```bash
# Make sure backend services are running separately
bun run dev

# Or with network access (for testing on other devices)
bun run dev:host
```

- Frontend & API: http://localhost:5173
- Local DB: `sqlite.db` (created automatically)
- Health Check: http://localhost:5173/api/health

## 🏗️ Architecture Overview

SelfHost is a **Full-stack SvelteKit** application. The SvelteKit server handles everything from routing and UI to database orchestration and authentication.

```
┌─────────────────────┐
│    SvelteKit App    │
│    (UI + API)       │
│    (Port 5173)      │
└──────────┬──────────┘
           │
           │ Direct DB Access (Drizzle)
           │ Native Auth & Sessions
           ↓
┌─────────────────────┐
│  LibSQL / SQLite    │
│  (local sqlite.db)  │
└─────────────────────┘
```

The platform interacts with remote servers via SSH or the **SelfHost Agent**.

````

## 📁 Key Directories

### `src/lib/`

- **`api/`** - API client and resource endpoints
    - `client.ts` - Axios-based API client
    - `resources/` - Resource-specific API methods
- **`components/`** - Reusable Svelte components
    - `forms/` - Form components (Input, Button, etc.)
    - `layout/` - Layout components (Navbar, Sidebar)
- **`stores/`** - Svelte stores for global state
    - `auth.ts` - Authentication state
    - `team.ts` - Team/organization state
- **`server/`** - Server-side code
    - **`db/`** - Database configuration and schema
        - `client.ts` - Drizzle client
        - `schema.ts` - Database schema definitions
    - **`services/`** - Backend business logic
    - **`auth/`** - Authentication logic
- **`utils/`** - Utility functions

### `src/routes/`

SvelteKit uses file-based routing:

- `+page.svelte` - Page component
- `+page.ts` - Page load function (runs on both server and client)
- `+page.server.ts` - Server-only load function
- `+layout.svelte` - Layout component
- `+layout.ts` - Layout load function

## 🔧 Common Development Tasks

### Creating a New Page

```bash
# Example: Create a projects page
mkdir -p src/routes/projects
touch src/routes/projects/+page.svelte
touch src/routes/projects/+page.ts
````

**src/routes/projects/+page.svelte:**

```svelte
<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<h1>Projects</h1>
<ul>
	{#each data.projects as project}
		<li>{project.name}</li>
	{/each}
</ul>
```

**src/routes/projects/+page.ts:**

```typescript
import type { PageLoad } from './$types';
import { projectsApi } from '$lib/api/resources/projects';

export const load: PageLoad = async () => {
  const response = await projectsApi.getAll();
  return {
    projects: response.data.data,
  };
};
```

### Creating a New Component

```bash
# Example: Create a ProjectCard component
touch src/lib/components/ProjectCard.svelte
```

**src/lib/components/ProjectCard.svelte:**

```svelte
<script lang="ts">
	import type { Project } from '$lib/types';

	interface Props {
		project: Project;
	}

	let { project }: Props = $props();
</script>

<div class="card">
	<h3>{project.name}</h3>
	<p>{project.description}</p>
</div>

<style>
	.card {
		@apply rounded-lg bg-white p-4 shadow;
	}
</style>
```

### Adding an API Endpoint

```bash
# Create a new resource API file
touch src/lib/api/resources/servers.ts
```

**src/lib/api/resources/servers.ts:**

```typescript
import { api } from '../client';
import type { Server } from '$lib/types';

export const serversApi = {
  getAll: () => api.get<{ data: Server[] }>('/servers'),

  getById: (uuid: string) =>
    api.get<{ data: Server }>(`/servers/${uuid}`),

  create: (data: Partial<Server>) =>
    api.post<{ data: Server }>('/servers', data),

  update: (uuid: string, data: Partial<Server>) =>
    api.patch<{ data: Server }>(`/servers/${uuid}`, data),

  delete: (uuid: string) =>
    api.delete(`/servers/${uuid}`),
};
```

### WebSocket Integration

SelfHost uses a custom Vite plugin to handle WebSocket upgrades for agent communication in development. In production, this is handled by the SvelteKit server directly via the integrated WebSocket protocol.

## 🗄️ Database Management

SelfHost uses **Drizzle ORM** with **PostgreSQL**.

### Commands

```bash
# Generate migrations from schema
bun run drizzle-kit generate

# Push schema changes to database (Development)
bun run drizzle-kit push

# Open Drizzle Studio to explore data
bun run drizzle-kit studio
```

### Schema

The database schema is defined in `src/lib/server/db/schema.ts`. When adding new tables or columns:

1. Update `schema.ts`.
2. Run `bun run drizzle-kit push` to sync with your local database.
3. Export the new types using the `typeof table.$inferSelect` pattern at the bottom of the file.

## 🎨 Styling Guidelines

### Use Tailwind CSS Classes

```svelte
<button class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"> Click me </button>
```

### Component-Scoped Styles

```svelte
<style>
	.custom-class {
		@apply text-lg font-bold text-gray-800;
	}
</style>
```

### Dark Mode Support

```svelte
<div class="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">Content</div>
```

## 🧪 Testing

### Writing Component Tests

```typescript
// src/lib/components/Button.test.ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Button from './Button.svelte';

describe('Button', () => {
  it('renders with text', () => {
    render(Button, { props: { children: 'Click me' } });
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test --watch

# Run tests with UI
bun run test:ui
```

## 🐛 Debugging

### Browser DevTools

- Install [Svelte DevTools](https://chrome.google.com/webstore/detail/svelte-devtools/ckolcbmkjpjmangdbmnkpjigpkddpogn)
- Use Chrome/Firefox DevTools for network inspection

### Logging

```typescript
// In components
console.log('Debug:', $state.value);

// In load functions
export const load: PageLoad = async () => {
  console.log('Loading page data...');
  // ...
};
```

### Common Issues

**Issue: "Cannot find module"**

```bash
# Clear cache and reinstall
rm -rf node_modules bun.lock
bun install
```

**Issue: "Port already in use"**

```bash
# Change port in .env
VITE_PORT=5174

# Or kill the process
lsof -ti:5173 | xargs kill -9
```

**Issue: "CORS errors"**

- Ensure the backend service is reachable.
- Check browser console for specific origin errors.

## 📦 Building for Production

```bash
# Build the application
bun run build

# Preview the production build
bun run preview
```

The build output will be in the `build/` directory.

## 🔄 Git Workflow

```bash
# Create a feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/new-feature
```

## 📚 Resources

### Documentation

- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Tutorial](https://svelte.dev/tutorial)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Bun Documentation](https://bun.sh/docs)

### Svelte 5 Runes (New API)

- `$state()` - Reactive state
- `$derived()` - Derived values
- `$effect()` - Side effects
- `$props()` - Component props

### Example Runes Usage

```svelte
<script lang="ts">
	// State
	let count = $state(0);

	// Derived value
	let doubled = $derived(count * 2);

	// Effect
	$effect(() => {
		console.log('Count changed:', count);
	});

	// Props
	interface Props {
		initialValue?: number;
	}
	let { initialValue = 0 }: Props = $props();
</script>
```

## 🤝 Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Run `bun run lint` and `bun run format` before committing
5. Ensure all tests pass with `bun run test`

## 💡 Tips

- Use TypeScript for type safety
- Leverage SvelteKit's load functions for data fetching
- Keep components small and focused
- Use stores for global state
- Implement proper error handling
- Add loading states for async operations
- Use semantic HTML
- Ensure accessibility (ARIA labels, keyboard navigation)

## 🆘 Getting Help

- Check the [SvelteKit Discord](https://svelte.dev/chat)
- Review the [SelfHost Discord](https://discord.gg/selfhostgg)
- Read the [Svelte 5 Documentation](https://svelte.dev/docs)

---

Happy coding! 🚀
