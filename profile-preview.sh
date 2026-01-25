#!/bin/bash

# Profile script for bun preview - monitors CPU and memory usage

echo "🚀 Starting preview server with profiling..."
echo "=========================================="
echo ""

# Start preview in background
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-build-secret-dummy} bun preview &
PREVIEW_PID=$!

# Wait a moment for server to start
sleep 3

# Check if process is still running
if ! kill -0 $PREVIEW_PID 2>/dev/null; then
    echo "❌ Preview server failed to start"
    exit 1
fi

echo "✅ Preview server started (PID: $PREVIEW_PID)"
echo "📊 Monitoring resource usage..."
echo ""
echo "Press Ctrl+C to stop monitoring and server"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping preview server..."
    kill $PREVIEW_PID 2>/dev/null
    wait $PREVIEW_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Monitor loop
while kill -0 $PREVIEW_PID 2>/dev/null; do
    # Get process stats
    STATS=$(ps -p $PREVIEW_PID -o pid,%cpu,%mem,rss,vsz,etime --no-headers 2>/dev/null)
    
    if [ -n "$STATS" ]; then
        # Parse stats
        PID=$(echo $STATS | awk '{print $1}')
        CPU=$(echo $STATS | awk '{print $2}')
        MEM=$(echo $STATS | awk '{print $3}')
        RSS=$(echo $STATS | awk '{print $4}')
        VSZ=$(echo $STATS | awk '{print $5}')
        ETIME=$(echo $STATS | awk '{print $6}')
        
        # Convert RSS from KB to MB
        RSS_MB=$(echo "scale=2; $RSS / 1024" | bc)
        VSZ_MB=$(echo "scale=2; $VSZ / 1024" | bc)
        
        # Clear line and print stats
        printf "\r⏱️  Uptime: %-8s | CPU: %5s%% | Memory: %5s%% | RSS: %8.1f MB | VSZ: %10.1f MB" \
            "$ETIME" "$CPU" "$MEM" "$RSS_MB" "$VSZ_MB"
    fi
    
    sleep 1
done

cleanup
