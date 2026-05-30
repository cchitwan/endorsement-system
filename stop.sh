#!/bin/bash

echo "=================================================="
echo "🛑 Stopping Endorsement Management System..."
echo "=================================================="

# Stop Frontend (Port 3000)
if lsof -i :3000 > /dev/null; then
    PID=$(lsof -t -i :3000)
    echo "Stopping Frontend on port 3000 (PID: $PID)..."
    kill -15 "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null
else
    echo "Frontend (port 3000) is not running."
fi

# Stop Backend (Port 5001)
if lsof -i :5001 > /dev/null; then
    PID=$(lsof -t -i :5001)
    echo "Stopping Backend on port 5001 (PID: $PID)..."
    kill -15 "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null
else
    echo "Backend (port 5001) is not running."
fi

# Also kill node/vite or spring-boot run if they are orphaned
echo "🧹 Cleaning up any orphaned service processes..."
pkill -f "mvn spring-boot:run" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "=================================================="
echo "✅ Services successfully stopped!"
echo "=================================================="
