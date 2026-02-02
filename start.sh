#!/bin/bash
# Quick start script - run both backend and frontend

set -e

echo "🚀 Real-time Dashboard - Quick Start"
echo ""

# Start backend
echo "📦 Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
  python -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt

if [ ! -f "metrics.db" ]; then
  echo "💾 Initializing database..."
  python init_db.py
fi

echo "🟢 Starting backend on http://localhost:8000"
python main.py &
BACKEND_PID=$!

cd ..

# Start frontend
echo "📦 Setting up frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install -q
fi

echo "🟢 Starting frontend on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "✨ Dashboard is running!"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop"

wait
