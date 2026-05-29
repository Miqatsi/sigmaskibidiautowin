#!/bin/bash
# ============================================================
# Sima Arome — One-Command Startup Script
# ============================================================
# Usage: ./start.sh
# This starts ALL services (backend, frontend, AI)

echo "🏭 Starting Sima Arome Platform..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Start PostgreSQL
echo -e "${BLUE}[1/5]${NC} Starting PostgreSQL..."
sudo systemctl start postgresql 2>/dev/null || echo "  ⚠️  PostgreSQL may already be running or needs manual start"
sleep 1

# 2. Backend
echo -e "${BLUE}[2/5]${NC} Starting Backend (port 3000)..."
cd backend
npm install --silent 2>/dev/null
npx prisma generate --schema=prisma/schema.prisma 2>/dev/null
npx ts-node --transpile-only src/server.ts &
BACKEND_PID=$!
cd ..
sleep 3

# 3. Frontend
echo -e "${BLUE}[3/5]${NC} Starting Frontend (port 3001)..."
cd frontend
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!
cd ..
sleep 2

# 4. AI QC Vision Service
echo -e "${BLUE}[4/5]${NC} Starting AI QC Vision (port 8000)..."
cd ai
/home/qims/.local/share/pipx/venvs/ultralytics/bin/python main.py &
AI_QC_PID=$!
cd ..
sleep 2

# 5. AI Scheduler Service
echo -e "${BLUE}[5/5]${NC} Starting AI Scheduler (port 8001)..."
cd ai
/home/qims/.local/share/pipx/venvs/ultralytics/bin/python scheduler.py &
AI_SCHED_PID=$!
cd ..
sleep 2

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  🏭 Sima Arome — All Services Running!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  🌐 Frontend:      http://localhost:3001"
echo "  🔧 Backend API:   http://localhost:3000"
echo "  🔬 AI QC Vision:  http://localhost:8000"
echo "  📅 AI Scheduler:  http://localhost:8001"
echo ""
echo "  Login: sigma / skibidi"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping all services...'; kill $BACKEND_PID $FRONTEND_PID $AI_QC_PID $AI_SCHED_PID 2>/dev/null; exit 0" SIGINT
wait
