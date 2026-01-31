import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type DbUpdateEvent = {
    type: 'db_update';
    operation: 'insert' | 'update' | 'delete';
    table: string;
    rowid: number;
    timestamp?: number;
};

type WsMessage = DbUpdateEvent | { type: string; [key: string]: any };

function createWebSocketStore() {
    const { subscribe, set, update } = writable<{
        status: WsStatus;
        lastMessage: WsMessage | null;
    }>({
        status: 'disconnected',
        lastMessage: null
    });

    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;
    let retries = 0;

    function connect() {
        if (!browser) return;
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

        update(s => ({ ...s, status: 'connecting' }));

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use the current host to leverage the proxy setup in vite.config.ts
        const url = `${protocol}//${window.location.host}/ws`;

        console.debug('[WS] Connecting to:', url);
        socket = new WebSocket(url);

        socket.onopen = () => {
            console.debug('[WS] Connected');
            update(s => ({ ...s, status: 'connected' }));
            retries = 0;
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Ensure unique identity for Svelte 5 equality checks
                if (!data.timestamp) data.timestamp = Date.now();
                update(s => ({ ...s, lastMessage: data }));
            } catch (e) {
                console.error('[WS] Failed to parse message', e);
            }
        };

        socket.onclose = () => {
            console.debug('[WS] Disconnected');
            update(s => ({ ...s, status: 'disconnected' }));
            socket = null;
            
            // Exponential backoff for reconnect
            const timeout = Math.min(1000 * Math.pow(2, retries), 30000);
            retries++;
            
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connect, timeout);
        };

        socket.onerror = (error) => {
            console.error('[WS] Error', error);
            update(s => ({ ...s, status: 'error' }));
        };
    }

    return {
        subscribe,
        connect
    };
}

export const wsStore = createWebSocketStore();
