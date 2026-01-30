import { marked } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';

// Cache for the shiki highlighter
let highlighter: Highlighter | null = null;

// Define heading type
export type Heading = {
	id: string;
	text: string;
	level: number;
};

/**
 * Strip YAML frontmatter from markdown content
 */
export function stripFrontmatter(content: string): string {
    if (!content.trim().startsWith('---')) {
        return content;
    }
    
    const parts = content.split('---');
    if (parts.length < 3) {
        return content;
    }
    
    return parts.slice(2).join('---').trim();
}

/**
 * Initialize Shiki highlighter
 */
async function getHighlighter() {
    if (!highlighter) {
        highlighter = await createHighlighter({
            themes: ['vitesse-dark', 'vitesse-light'],
            langs: [
                'javascript', 'typescript', 'tsx', 'jsx',
                'bash', 'shell',
                'yaml', 'toml',
                'json', 'jsonc', 'json5',
                'svelte', 'html', 'css', 'scss', 'sass',
                'sql',
                'dockerfile',
                'python',
                'rust', 'go', 'java',
                'markdown',
                'xml', 'diff', 'git-commit',
                'plaintext'
            ]
        });
    }
    return highlighter;
}

/**
 * Process markdown content and convert to HTML
 */
export async function processMarkdown(content: string): Promise<string> {
    try {
        const shiki = await getHighlighter();
        const renderer = new marked.Renderer();

        // Custom renderer for code blocks
        renderer.code = ({ text, lang }) => {
            const language = lang?.toLowerCase() || 'text';
            
            // Handle Mermaid diagrams
            if (language === 'mermaid') {
                // Escape the mermaid code for HTML embedding
                const escapedCode = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                return `<div class="mermaid-diagram" data-mermaid-code="${escapedCode}"></div>`;
            }
            
            // Handle custom agent architecture diagram
            if (language === 'agent-architecture' || (language === 'text' && text.trim().startsWith('AGENT_ARCH_DIAGRAM'))) {
                return `<div class="agent-architecture-diagram-placeholder"></div>`;
            }
            
            try {
                // Normalize language aliases to valid Shiki language IDs
                const langMap: Record<string, string> = {
                    'js': 'javascript',
                    'ts': 'typescript',
                    'yml': 'yaml',
                    'py': 'python',
                    'sh': 'bash',
                    'zsh': 'bash',
                    'shell': 'bash',
                    'docker': 'dockerfile',
                    'md': 'markdown',
                    'text': 'plaintext',
                    'mysql': 'sql',
                    'postgresql': 'sql',
                    'conf': 'plaintext',
                    'apache': 'plaintext',
                    'nginx': 'plaintext'
                };
                const normalizedLang = langMap[language] || language;
                
                // Try to get HTML with syntax highlighting
                let html: string;
                try {
                    html = shiki.codeToHtml(text, {
                        lang: normalizedLang,
                        themes: {
                            light: 'vitesse-light',
                            dark: 'vitesse-dark'
                        }
                    });
                } catch (highlightError) {
                    // If language is not supported, fall back to plaintext
                    html = shiki.codeToHtml(text, {
                        lang: 'plaintext',
                        themes: {
                            light: 'vitesse-light',
                            dark: 'vitesse-dark'
                        }
                    });
                }
                
                // Extract line count for line numbers
                const lines = text.split('\n');
                const lineCount = lines.length;
                const showLineNumbers = lineCount > 1 && lineCount < 100; // Only show for reasonable line counts
                
                // Process HTML to add line numbers if needed
                let processedHtml = html;
                if (showLineNumbers) {
                    // Shiki wraps lines in <span class="line">, we'll add data attributes
                    let lineNum = 0;
                    processedHtml = html.replace(/<span class="line">/g, () => {
                        lineNum++;
                        return `<span class="line" data-line="${lineNum}">`;
                    });
                }
                
                // Wrap with enhanced styling and copy functionality
                return `<div class="code-wrapper relative group" data-lang="${normalizedLang}" data-lines="${lineCount}">
                    <div class="code-header flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                        <span class="language-label">${normalizedLang}</span>
                        <button class="copy-button flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/50 border border-border/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:border-accent-foreground/20 active:scale-95 focus-visible:opacity-100" aria-label="Copy code" data-copy-target type="button">
                            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                            <span class="copy-text">Copy</span>
                        </button>
                    </div>
                    <div class="code-content relative ${showLineNumbers ? 'with-line-numbers' : ''}">
                        ${processedHtml}
                    </div>
                </div>`;
            } catch (err) {
                // Fallback for unsupported languages
                const escapedText = text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                return `<div class="code-wrapper relative group" data-lang="${language}">
                    <div class="code-header flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
                        <span class="language-label text-xs font-semibold uppercase tracking-wider text-muted-foreground">${language}</span>
                        <button class="copy-button flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-background/50 border border-border/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-accent hover:border-accent-foreground/20 active:scale-95" aria-label="Copy code" data-copy-target>
                            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                            <span class="copy-text">Copy</span>
                        </button>
                    </div>
                    <div class="code-content">
                        <pre class="p-4 overflow-x-auto"><code class="language-${language}">${escapedText}</code></pre>
                    </div>
                </div>`;
            }
        };

        // Custom renderer for blockquotes (Alerts/Admonitions)
        renderer.blockquote = ({ text }) => {
            const alerts = {
                NOTE: { icon: 'info', color: 'blue' },
                TIP: { icon: 'lightbulb', color: 'green' },
                WARNING: { icon: 'alert-triangle', color: 'amber' },
                IMPORTANT: { icon: 'zap', color: 'purple' },
                CAUTION: { icon: 'alert-circle', color: 'red' }
            };

            for (const [key, config] of Object.entries(alerts)) {
                if (text.includes(`[!${key}]`)) {
                    const cleanText = text.replace(`<p>[!${key}]`, '<p>').replace(`[!${key}]`, '');
                    return `
                        <div class="admonition admonition-${config.color} my-6 p-4 rounded-lg border-l-4 bg-${config.color}-500/5 border-${config.color}-500/50">
                            <div class="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider text-${config.color}-500">
                                <span class="admonition-icon-${config.icon}"></span>
                                ${key}
                            </div>
                            <div class="prose-sm prose-slate dark:prose-invert">
                                ${cleanText}
                            </div>
                        </div>
                    `;
                }
            }
            return `<blockquote class="border-l-4 border-primary/20 pl-4 py-1 my-6 italic text-muted-foreground">${text}</blockquote>`;
        };

        const parsedContent = marked.parse(content, { renderer });
        return typeof parsedContent === 'string' ? parsedContent : await parsedContent;
    } catch (e) {
        console.error('Error parsing markdown:', e);
        return `<p>Error parsing content: ${e instanceof Error ? e.message : String(e)}</p>`;
    }
}

/**
 * Add IDs and process DOM elements for documentation
 */
export function addIdsToHeadings(html: string): string {
    if (typeof DOMParser === 'undefined') return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const headings = doc.querySelectorAll('h1, h2, h3, h4');
    const usedIds = new Set<string>();
    
    headings.forEach((heading, index) => {
        const text = heading.textContent?.trim() || '';
        let baseId = heading.id || text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
        if (!baseId) baseId = `section-${index}`;
        
        let uniqueId = baseId;
        let counter = 1;
        while (usedIds.has(uniqueId)) {
            uniqueId = `${baseId}-${counter}`;
            counter++;
        }
        heading.id = uniqueId;
        usedIds.add(uniqueId);
    });
    
    return doc.body.innerHTML;
}

/**
 * Extract headings from processed HTML
 */
export function extractHeadingsFromHtml(html: string): Heading[] {
    if (typeof DOMParser === 'undefined') return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('h1, h2, h3, h4')).map(el => ({
        id: el.id,
        text: el.textContent || '',
        level: parseInt(el.tagName.substring(1), 10)
    }));
}
