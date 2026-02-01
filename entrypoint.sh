#!/bin/bash
echo "Debug: Checking for libfacil.io.so..."

# Find and copy libfacil.io.so to a standard location if needed
if [ ! -f /usr/local/lib/libfacil.io.so ]; then
    echo "Library not found in /usr/local/lib, searching..."
    
    # Try to find in project cache first
    if [ -d /app ]; then
        echo "Searching in /app..."
        find /app -name "libfacil.io.so" -exec ls -lh {} \; 2>/dev/null
        find /app -name "libfacil.io.so" -exec cp {} /usr/local/lib/libfacil.io.so \; 2>/dev/null
    fi
    
    # Also try the global Zig cache
    if [ ! -f /usr/local/lib/libfacil.io.so ] && [ -d /root ]; then
        echo "Searching in /root/.cache/zig..."
        find /root/.cache/zig -name "libfacil.io.so" -exec ls -lh {} \; 2>/dev/null
        find /root/.cache/zig -name "libfacil.io.so" -exec cp {} /usr/local/lib/libfacil.io.so \; 2>/dev/null
    fi
    
    ldconfig 2>/dev/null || true
fi

# Verify the library exists before starting
if [ ! -f /usr/local/lib/libfacil.io.so ]; then
    echo "ERROR: libfacil.io.so not found!"
    echo "Contents of /usr/local/lib:"
    ls -la /usr/local/lib/ 2>/dev/null | head -10
    exit 1
fi

echo "Starting selfhost-server with libfacil.io.so from $(ls -l /usr/local/lib/libfacil.io.so)"

# Start the server
exec /app/selfhost-server