#!/bin/bash
# ============================================================
# Sima Arome — One-Command Startup Script
# ============================================================
# Usage: ./start.sh
# This starts ALL services (backend, frontend, AI)
#
# Requirements:
#   - Node.js 20+, npm
#   - Python 3.10+ with pip (ultralytics, fastapi, ortools, torch)
#   - PostgreSQL running
#   - NVIDIA GPU + CUDA (for AI, optional — falls back to CPU)

echo "🏭 Starting Sima Arome Platform..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Find Python with required packages ──
find_python() {
  # Try common locations
  for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
      if "$cmd" -c "import ultralytics, fastapi" 2>/dev/null; then
        echo "$cmd"
        return 0
      fi
    fi
  done

  # Try pipx ultralytics venv (common on Arch/dev machines)
  local pipx_python="$HOME/.local/share/pipx/venvs/ultralytics/bin/python"
  if [ -f "$pipx_python" ]; then
    echo "$pipx_python"
    return 0
  fi

  # Try common venv locations
  for venv in ./ai/venv ./ai/.venv ./.venv ./venv; do
    if [ -f "$venv/bin/python" ]; then
      if "$venv/bin/python" -c "import ultralytics, fastapi" 2>/dev/null; then
        echo "$venv/bin/python"
        return 0
      fi
    fi
  done

  return 1
}

PYTHON=$(find_python)
if [ -z "$PYTHON" ]; then
  echo -e "${YELLOW}⚠️  Python with AI packages not found.${NC}"
  echo "   Install with: pip install ultralytics fastapi uvicorn ortools python-multipart torch"
  echo "   AI services will be skipped. Backend + Frontend will still work."
  echo ""
  AI_AVAILABLE=false
else
  echo -e "${GREEN}✅ Python found: $PYTHON${NC}"
  AI_AVAILABLE=true
fi

# ── Start PostgreSQL ──
echo -e "${BLUE}[1/5]${NC} Starting PostgreSQL..."
if command -v systemctl &>/dev/null; then
  sudo systemctl start postgresql 2>/dev/null || true
elif command -v pg_isready &>/dev/null; then
  pg_isready &>/dev/null || echo "  ⚠️  Start PostgreSQL manually"
fi
sleep 1

# ── Backend ──
echo -e "${BLUE}[2/5]${NC} Starting Backend (port 3000)..."
(
  cd backend
  npm install --silent 2>/dev/null
  npx prisma generate 2>/dev/null
  npx ts-node --transpile-only src/server.ts
) &
BACKEND_PID=$!
sleep 3

# ── Frontend ──
echo -e "${BLUE}[3/5]${NC} Starting Frontend (port 3001)..."
(
  cd frontend
  npm install --silent 2>/dev/null
  npx next dev --port 3001
) &
FRONTEND_PID=$!
sleep 2

# ── AI Services (optional) ──
AI_QC_PID=""
AI_SCHED_PID=""

if [ "$AI_AVAILABLE" = true ]; then
  echo -e "${BLUE}[4/5]${NC} Starting AI QC Vision (port 8000)..."
  (cd ai && $PYTHON main.py) &
  AI_QC_PID=$!
  sleep 2

  echo -e "${BLUE}[5/5]${NC} Starting AI Scheduler (port 8001)..."
  (cd ai && $PYTHON scheduler.py) &
  AI_SCHED_PID=$!
  sleep 2
else
  echo -e "${BLUE}[4/5]${NC} Skipping AI QC Vision (Python not configured)"
  echo -e "${BLUE}[5/5]${NC} Skipping AI Scheduler (Python not configured)"
fi

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  🏭 Sima Arome — All Services Running!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  🌐 Frontend:      http://localhost:3001"
echo "  🔧 Backend API:   http://localhost:3000"
if [ "$AI_AVAILABLE" = true ]; then
  echo "  🔬 AI QC Vision:  http://localhost:8000"
  echo "  📅 AI Scheduler:  http://localhost:8001"
else
  echo "  ⚠️  AI services not running (install Python deps to enable)"
fi
echo ""
echo "  Login: sigma / skibidi"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Wait for Ctrl+C, then kill all
cleanup() {
  echo ""
  echo "Stopping all services..."
  kill $BACKEND_PID $FRONTEND_PID $AI_QC_PID $AI_SCHED_PID 2>/dev/null
  wait 2>/dev/null
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM
wait
