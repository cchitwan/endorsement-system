#!/bin/bash

# Determine script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=================================================="
echo "🚀 Starting Endorsement Management System..."
echo "=================================================="

# Check if backend port 5001 is active
if lsof -i :5001 > /dev/null; then
    echo "⚠️ Warning: Port 5001 (Backend) is already in use. Attempting to stop..."
    kill -9 $(lsof -t -i :5001) 2>/dev/null
    sleep 1
fi

# Check if frontend port 3000 is active
if lsof -i :3000 > /dev/null; then
    echo "⚠️ Warning: Port 3000 (Frontend) is already in use. Attempting to stop..."
    kill -9 $(lsof -t -i :3000) 2>/dev/null
    sleep 1
fi

# Start Backend
echo "📡 Launching Spring Boot Backend on port 5001..."
cd "$DIR/backend" || exit
nohup mvn spring-boot:run > "$DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started in background. PID: $BACKEND_PID, Logging to backend.log"

# Start Frontend
echo "💻 Launching Vite React Frontend on port 3000..."
cd "$DIR/frontend" || exit
nohup npm run dev > "$DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started in background. PID: $FRONTEND_PID, Logging to frontend.log"

echo "=================================================="
echo "✨ Both services are booting up!"
echo "   - Employer & Insurer App: http://localhost:3000"
echo "   - Backend Swagger Specs: http://localhost:5001/swagger-ui/index.html"
echo "   - Live database console: http://localhost:5001/h2-console"
echo "=================================================="
