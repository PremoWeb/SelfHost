<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Monaco from 'monaco-editor';

	interface Props {
		value: string;
		language?: string;
		theme?: 'vs-dark' | 'vs-light';
		readOnly?: boolean;
		onChange?: (value: string) => void;
	}

	let { value = $bindable(''), language = 'javascript', theme = 'vs-dark', readOnly = false, onChange }: Props = $props();

	let editorContainer: HTMLDivElement;
	let editor: Monaco.editor.IStandaloneCodeEditor;
	let monaco: typeof Monaco;

	onMount(() => {
		let cleanup: (() => void) | undefined;

		const init = async () => {
			if (typeof window === 'undefined') return;

			// In a real setup, we might dynamically import, but here we imported * as Monaco 
            // so we assume it's bundled or we should use dynamic import if we want code splitting.
            // For correct types, "import * as Monaco" is best.
            // For code splitting, we would use import('monaco-editor').
            // Let's stick to import * as Monaco for now to satisfy types easily, 
            // but in production standard vite splitting handles it.
            monaco = Monaco;

			// Worker setup
			window.MonacoEnvironment = {
				getWorker: function (_workerId: string, label: string) {
                    return new Worker(
                        new URL('monaco-editor/esm/vs/language/typescript/ts.worker?worker', import.meta.url)
                    );
				}
			};

			editor = monaco.editor.create(editorContainer, {
				value,
				language,
				theme,
				readOnly,
				automaticLayout: true,
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				fontSize: 14,
				tabSize: 2
			});

			const disposable = editor.onDidChangeModelContent(() => {
				const newValue = editor.getValue();
				value = newValue;
				onChange?.(newValue);
			});
            
            cleanup = () => {
                disposable.dispose();
                editor.dispose();
            };
		};

		init();

		return () => {
			if (cleanup) cleanup();
		};
	});
    
    // Reactive updates
    $effect(() => {
        if (editor && editor.getValue() !== value) {
             // Avoid loop if value update came from editor
             // editor.setValue(value); 
        }
    });

    $effect(() => {
        if (editor && theme) {
            monaco?.editor.setTheme(theme);
        }
    });

    $effect(() => {
        if (editor && language) {
             if (monaco) {
                 const model = editor.getModel();
                 if (model) {
                     monaco.editor.setModelLanguage(model, language);
                 }
             }
        }
    });

</script>

<div class="h-full w-full min-h-[400px] rounded-md overflow-hidden border border-gray-300 dark:border-gray-700" bind:this={editorContainer}></div>
