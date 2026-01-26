#!/bin/bash

# Profile script for bun preview - monitors CPU and memory usage

echo "🚀 Starting preview server with profiling..."
echo "=========================================="
echo ""

# Start preview in background
# Start production server directly (bypassing vite preview overhead)
PORT=4173 BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-build-secret-dummy} bun --bun build/index.js &
PREVIEW_PID=$!

# Wait a moment for server to start
sleep 3

# Check if process is still running
if ! kill -0 $PREVIEW_PID 2>/dev/null; then
    echo "❌ Preview server failed to start"
    exit 1
fi

echo "✅ Preview server started (PID: $PREVIEW_PID)"
echo "📊 Monitoring resource usage (Process Tree)..."
echo ""
echo "Press Ctrl+C to stop monitoring and server"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping preview server..."
    # Kill the whole process group
    pkill -P $PREVIEW_PID 2>/dev/null
    kill $PREVIEW_PID 2>/dev/null
    wait $PREVIEW_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Monitor loop
while kill -0 $PREVIEW_PID 2>/dev/null; do
    # Get all related PIDs (process tree)
    # Get children PIDs
    CHILD_PIDS=$(pgrep -P $PREVIEW_PID -d',' 2>/dev/null)
    
    if [ -n "$CHILD_PIDS" ]; then
        ALL_PIDS="$PREVIEW_PID,$CHILD_PIDS"
    else
        ALL_PIDS="$PREVIEW_PID"
    fi
    
    # Get stats for all PIDs
    # Outputs: %cpu %mem rss vsz
    STATS=$(ps -p "$ALL_PIDS" -o %cpu,%mem,rss,vsz --no-headers 2>/dev/null)
    
    # Get Uptime from main process
    UPTIME=$(ps -p $PREVIEW_PID -o etime --no-headers 2>/dev/null)
    
    if [ -n "$STATS" ]; then
        # Sum up stats using awk
        read CPU MEM RSS VSZ <<< $(echo "$STATS" | awk '{cpu+=$1; mem+=$2; rss+=$3; vsz+=$4} END {print cpu, mem, rss, vsz}')
        
        # Convert RSS/VSZ from KB to MB
        RSS_MB=$(awk -v val="$RSS" 'BEGIN {printf "%.2f", val / 1024}')
        VSZ_MB=$(awk -v val="$VSZ" 'BEGIN {printf "%.2f", val / 1024}')
        
        # Clear line and print stats
        printf "\r⏱️  Uptime: %-8s | CPU: %5s%% | Memory: %5s%% | RSS: %8s MB | VSZ: %10s MB" \
            "$UPTIME" "$CPU" "$MEM" "$RSS_MB" "$VSZ_MB"
    fi
    
    sleep 1
done

cleanup
