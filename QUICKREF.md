# 🚀 SelfHost - Quick Reference

## Essential Commands

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Start with network access
bun run dev:host

# Build for production
bun run build

# Preview production build
bun run preview

# Type checking
bun run check

# Linting
bun run lint

# Format code
bun run format

# Run tests
bun run test

# Run tests with UI
bun run test:ui
```

## Docker Commands

```bash
# Start all services
docker compose -f docker-compose.dev.yml up

# Start in detached mode
docker compose -f docker-compose.dev.yml up -d

# Stop all services
docker compose -f docker-compose.dev.yml down

# View logs
docker compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker compose -f docker-compose.dev.yml logs -f sveltekit

# Rebuild services
docker compose -f docker-compose.dev.yml up --build

# Remove volumes (clean slate)
docker compose -f docker-compose.dev.yml down -v
```

## Service URLs

| SelfHost | http://localhost:5173 | UI & API (SvelteKit) |
| Local DB | `sqlite.db` | LibSQL / SQLite |

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── api/              # API client
│   │   ├── components/       # Svelte components
│   │   ├── stores/           # State management
│   │   ├── utils/            # Utilities
│   ├── routes/               # Pages (file-based routing)
│   └── app.html              # HTML template
├── static/                   # Static assets
├── docker-compose.dev.yml    # Docker setup
├── .env                      # Environment variables
└── package.json              # Dependencies
```

## File-Based Routing

| File              | Purpose              |
| ----------------- | -------------------- |
| `+page.svelte`    | Page component       |
| `+page.ts`        | Page load function   |
| `+page.server.ts` | Server-only load     |
| `+layout.svelte`  | Layout component     |
| `+layout.ts`      | Layout load function |
| `+error.svelte`   | Error page           |

## Svelte 5 Runes

```svelte
<script lang="ts">
	// Reactive state
	let count = $state(0);

	// Derived value
	let doubled = $derived(count * 2);

	// Side effects
	$effect(() => {
		console.log('Count:', count);
	});

	// Component props
	let { name, age = 0 } = $props();
</script>
```

## API Client Usage

```typescript
import { api } from '$lib/api/client';

// GET
const response = await api.get('/projects');

// POST
await api.post('/projects', { name: 'New Project' });

// PATCH
await api.patch('/projects/123', { name: 'Updated' });

// DELETE
await api.delete('/projects/123');
```

## WebSocket Updates

Agent comms are handled via the native WebSocket protocol at `/api/agent`.

# Private (Server-only)

VITE_PORT=5173
DATABASE_URL=postgres://selfhost:password@localhost:5432/selfhost

## Common Patterns

### Load Data in Page

```typescript
// +page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
  const response = await fetch(`/api/projects/${params.id}`);
  const project = await response.json();
  return { project };
};
```

### Form Handling

```svelte
<script lang="ts">
	let name = $state('');
	let loading = $state(false);

	async function handleSubmit() {
		loading = true;
		try {
			await api.post('/projects', { name });
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={handleSubmit}>
	<input bind:value={name} />
	<button disabled={loading}>Submit</button>
</form>
```

### Conditional Rendering

```svelte
{#if loading}
	<p>Loading...</p>
{:else if error}
	<p>Error: {error}</p>
{:else}
	<p>Data: {data}</p>
{/if}
```

### List Rendering

```svelte
{#each items as item (item.id)}
	<div>{item.name}</div>
{:else}
	<p>No items</p>
{/each}
```

## Tailwind CSS Classes

```svelte
<!-- Buttons -->
<button class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"> Click me </button>

<!-- Cards -->
<div class="rounded-lg bg-white p-6 shadow-md">Content</div>

<!-- Grid -->
<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
	<!-- Items -->
</div>

<!-- Dark mode -->
<div class="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">Content</div>
```

## Debugging

```bash
# Check TypeScript errors
bun run check

# View build output
bun run build --debug

# Inspect bundle
bun run build && ls -lh build/

# Clear cache
rm -rf .svelte-kit node_modules
bun install
```

## Testing

```typescript
// Component test
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  it('renders', () => {
    render(MyComponent);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Git Workflow

```bash
# Create branch
git checkout -b feature/my-feature

# Commit changes
git add .
git commit -m "feat: add my feature"

# Push
git push origin feature/my-feature
```

## Troubleshooting

| Issue            | Solution                                          |
| ---------------- | ------------------------------------------------- |
| Port in use      | Change `VITE_PORT` in `.env`                      |
| CORS errors      | Ensure backend is reachable                       |
| Module not found | Run `bun install`                                 |
| Build fails      | Run `bun run check`                               |
| Docker issues    | Run `docker compose down -v && docker compose up` |

## Resources

- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Docs](https://svelte.dev/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Bun Docs](https://bun.sh/docs)
- [Migration Plan](../SVELTEKIT_MIGRATION_PLAN.md)
- [Development Guide](./DEVELOPMENT.md)

---

**Remember:** This project uses **Bun exclusively**. Do not use npm, yarn, or pnpm!
