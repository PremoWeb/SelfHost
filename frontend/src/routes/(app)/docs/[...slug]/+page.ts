import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { stripFrontmatter } from '$lib/utils/markdown';

const NAV_ITEMS = [
	{
		section: 'Getting Started',
		items: [
			{ title: 'Introduction', path: '/docs/introduction' },
			{ title: 'Installation', path: '/docs/installation' },
			{ title: 'FAQs', path: '/docs/faqs' }
		]
	},
	{
		section: 'Core Concepts',
		items: [
			{ title: 'Projects', path: '/docs/projects' },
			{ title: 'Servers', path: '/docs/servers' },
			{ title: 'SelfHost Agent', path: '/docs/agent' },
			{ title: 'Cloud Providers', path: '/docs/cloud-providers' },
			{ title: 'Deployment Sources', path: '/docs/sources' },
			{ title: 'Applications', path: '/docs/applications' },
			{ title: 'Git Hosting', path: '/docs/git-hosting' }
		]
	},
	{
		section: 'Networking',
		items: [
			{ title: 'Vanity DNS', path: '/docs/vanity-dns' },
			{ title: 'Cloudflare Integration', path: '/docs/cloudflare' }
		]
	},
	{
		section: 'Administration',
		items: [
			{ title: 'Impersonation & Context Switching', path: '/docs/impersonation' },
			{ title: 'Action Logs', path: '/docs/action-logs' }
		]
	}
];

function slugToTitle(slug: string): string {
	return slug
		.split('/')
		.pop()
		?.replace(/-/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Documentation';
}

export const load: PageLoad = async ({ params, fetch }) => {
	const rawSlug = (params as Record<string, string | undefined>)['...slug'] ?? params?.slug;
	const slug = (typeof rawSlug === 'string' ? rawSlug.trim() : '') || 'introduction';
	const normalizedSlug = slug.split('/')[0] || 'introduction';

	// Import all markdown files eagerly as raw strings
	const modules = import.meta.glob('../../../../lib/docs/*.md', { 
		query: '?raw',
		import: 'default',
		eager: true 
	});

	const path = `../../../../lib/docs/${normalizedSlug}.md`;
	
	if (!(path in modules)) {
		// Redirect missing or invalid doc to introduction
		throw redirect(302, '/docs/introduction');
	}

	const raw = modules[path] as string;
	const content = stripFrontmatter(raw);
	const title = slugToTitle(normalizedSlug);

	return {
		slug: normalizedSlug,
		title,
		content,
		navItems: NAV_ITEMS,
		showPublicHeader: false
	};
};
