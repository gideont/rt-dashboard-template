#!/usr/bin/env bash
set -e
cd backend
if [ ! -d "venv" ]; then
  python -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt

# Start backend with auto-reload for development
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
