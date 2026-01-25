import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { stripFrontmatter } from '$lib/utils/markdown';

// Load all markdown files from static/markdown
const markdownModules = import.meta.glob('/static/markdown/**/*.md', { query: '?raw', import: 'default', eager: true });

export const load: PageServerLoad = async ({ params, url }) => {
    const slug = params.slug || 'introduction';
    
    // Support both direct .md and nested index.md
    const patterns = [
        `/static/markdown/${slug}.md`,
        `/static/markdown/${slug}/index.md`
    ];
    
    let content: string | null = null;
    let foundPath: string | null = null;
    
    for (const pattern of patterns) {
        if (markdownModules[pattern]) {
            content = markdownModules[pattern] as string;
            foundPath = pattern;
            break;
        }
    }
    
    if (!content) {
        throw error(404, `Documentation page not found: ${slug}`);
    }

    // Basic navigation structure - this could be moved to a config file eventually
    const navItems = [
        {
            section: 'Getting Started',
            items: [
                { title: 'Introduction', path: '/docs/introduction' },
                { title: 'Installation', path: '/docs/installation' }
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

    // Extract title from slug for now, or you could parse it from frontmatter
    const title = slug.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Documentation';

    return {
        slug,
        title,
        content: stripFrontmatter(content),
        navItems
    };
};
