import { spawn } from "bun";

console.log("🚀 Starting Cloudflare Tunnel Test...");

// 1. Start cloudflared
console.log("👉 Spawning 'cloudflared tunnel --url http://localhost:3000'...");
const tunnelProcess = spawn(["cloudflared", "tunnel", "--url", "http://localhost:3000"], {
    stderr: "pipe",
    stdout: "ignore", // logs are usually in stderr
});

let tunnelUrl: string | null = null;
let foundUrl = false;

// Function to cleanup
const cleanup = () => {
    console.log("\n🧹 Cleaning up...");
    tunnelProcess.kill();
    process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// 2. Read stderr to find the URL
const stream = new ReadableStream({
    start(controller) {
        // @ts-ignore
        const reader = tunnelProcess.stderr.getReader();
        const readChunk = async () => {
            const { done, value } = await reader.read();
            if (done) return;
            const text = new TextDecoder().decode(value);
            process.stdout.write(text); // Mirror output to console

            // Looking for lines like: https://random-name.trycloudflare.com
            const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match && !foundUrl) {
                foundUrl = true;
                tunnelUrl = match[0];
                console.log(`\n🎉 Tunnel URL Found: ${tunnelUrl}`);
                testConnection(tunnelUrl);
            }
            readChunk();
        };
        readChunk();
    }
});

// 3. Test Connection
async function testConnection(httpUrl: string) {
    const wsUrl = httpUrl.replace("https://", "wss://") + "/api/agent";
    console.log(`\n🔌 Testing WebSocket Connection to: ${wsUrl}`);
    console.log("⏳ Waiting 5s for tunnel to propagate...");
    await new Promise(r => setTimeout(r, 5000));

    console.log("🚀 Connecting...");
    
    try {
        const ws = new WebSocket(wsUrl, {
            headers: {
                "x-selfhost-agent-id": "tunnel-test-agent",
                "x-selfhost-agent-key": "test-key", // The backend should return 401, but that means CONNECTION SUCCEEDED
            }
        });

        ws.onopen = () => {
             console.log("✅ WebSocket Open! (This is unexpected if auth is invalid, but means connection works)");
             ws.close();
             // cleanup(); // Don't cleanup, let user keep tunnel
             console.log("\n🛑 Tunnel is still running. Press Ctrl+C to stop.");
        };

        ws.onclose = (event) => {
             console.log(`ℹ️ WebSocket Closed with code: ${event.code} (Reason: ${event.reason})`);
             // cleanup();
        };

        ws.onerror = (event: any) => {
            if (event.message?.includes("Expected 101")) {
                console.log("\n✅ VICTORY: Server Responded! (Received 401 Unauthorized)");
                console.log("   This confirms the Tunnel is UP and passing traffic to your Backend.");
                console.log("   The 'Expected 101' is because we used a fake key, so backend rejected auth (HTTP 401).");
                console.log(`   You can use this URL for your Agent: ${wsUrl.replace('/api/agent', '')}`);
                console.log("\n🛑 Tunnel is still running. Press Ctrl+C to stop.");
            } else {
                console.error("\n❌ WebSocket Connection Failed:", event.message || event);
                console.log("   Possible causes: Tunnel not propagated, Vite blocking Host header, or Backend down.");
            }
            cleanup();
        };

    } catch (e: any) {
        console.error("❌ Exception:", e.message);
        cleanup();
    }
}
