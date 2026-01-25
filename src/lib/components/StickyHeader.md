# StickyHeader Component

A reusable component for creating sticky page headers that remain visible when scrolling.

## Features

- Automatically sticks to the top of the page when scrolling
- Proper z-index layering
- Background color that matches the theme
- Optional bottom border
- Customizable content via Svelte snippets
- Negative margins to extend edge-to-edge

## Usage

### Basic Example

```svelte
<script>
	import StickyHeader from '$lib/components/StickyHeader.svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<StickyHeader>
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Page Title</h1>
			<p class="text-muted-foreground mt-1">Page description</p>
		</div>
		<Button>Action Button</Button>
	</div>
</StickyHeader>
```

### With Multiple Sections

```svelte
<StickyHeader class="space-y-4">
	<!-- Header section -->
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold tracking-tight">Title</h1>
		<Button>Action</Button>
	</div>

	<!-- Search or filters -->
	<div class="relative">
		<Input type="search" placeholder="Search..." />
	</div>
</StickyHeader>
```

### Without Border

```svelte
<StickyHeader showBorder={false}>
	<h1 class="text-3xl font-bold tracking-tight">Title</h1>
</StickyHeader>
```

### With Custom Classes

```svelte
<StickyHeader class="bg-muted/50 space-y-6">
	<!-- Your content -->
</StickyHeader>
```

## Props

| Prop         | Type      | Default  | Description                              |
| ------------ | --------- | -------- | ---------------------------------------- |
| `class`      | `string`  | `''`     | Additional CSS classes for the container |
| `showBorder` | `boolean` | `true`   | Whether to show the bottom border        |
| `children`   | `Snippet` | Required | Content to display in the header         |

## Examples in the Codebase

### Sources List Page

```svelte
<StickyHeader>
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Sources</h1>
			<p class="text-muted-foreground mt-1">
				Connect your Git providers to deploy application source code.
			</p>
		</div>
		<Button onclick={() => (showCreateModal = true)}>
			<Plus class="mr-2 size-4" />
			Add Source
		</Button>
	</div>
</StickyHeader>
```

### Source Detail Page (with search)

```svelte
<StickyHeader class="space-y-4">
	<div class="flex items-start justify-between">
		<div class="flex items-center gap-4">
			<div class="bg-muted rounded-lg p-3">
				<Icon class="size-6" />
			</div>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{source.name}</h1>
				<p class="text-muted-foreground mt-1">{source.description}</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<Badge>GitHub App</Badge>
			<Button variant="outline" size="sm">Refresh</Button>
		</div>
	</div>

	<div class="relative">
		<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2" />
		<Input type="search" placeholder="Search..." class="pl-10" />
	</div>
</StickyHeader>
```

## Best Practices

1. **Use for list pages** - Pages with scrollable content benefit most
2. **Include key actions** - Put important buttons in the sticky header
3. **Keep it concise** - Don't make the header too tall
4. **Use space-y classes** - Add spacing between sections with `class="space-y-4"`
5. **Consistent structure** - Follow the pattern: title/description on left, actions on right

## Styling

The component uses these Tailwind classes by default:

- `sticky top-0` - Sticks to top when scrolling
- `z-10` - Ensures it stays above content
- `bg-background` - Matches theme background
- `pb-4` - Bottom padding
- `-mx-8 px-8 pt-6 -mt-6` - Extends edge-to-edge
- `border-b` - Optional bottom border

## Accessibility

- Ensure heading hierarchy is maintained (use `h1` for page titles)
- Interactive elements should be keyboard accessible
- Use semantic HTML within the component
