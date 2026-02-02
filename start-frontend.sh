#!/usr/bin/env bash
set -e
cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi

# Start Vite dev server (hot reload)
npm run dev
