#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting SearchForge API on :8000..."
cd "$ROOT"
source venv/bin/activate
uvicorn api.main:app --reload --port 8000 &
API_PID=$!

echo "Starting SearchForge frontend on :5173..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  API:      http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $API_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
