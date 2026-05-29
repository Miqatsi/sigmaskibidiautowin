# 🏭 Sima Arome — Enterprise Manufacturing Intelligence Platform

AI-powered manufacturing operations system for Sima Arome, an Indonesian natural extracts manufacturer. Built for **CyberHack 2026**.

## Features

- **Integrated Operations** — Unified platform: suppliers, warehouse, QC, PPIC, production, inventory, dispatch
- **AI Visual QC** — YOLOv8 defect detection + OpenCV colour/powder analysis (GPU-accelerated)
- **PPIC Scheduling** — Google OR-Tools CP-SAT solver for optimal production scheduling
- **Full Traceability** — Forward/backward lot genealogy (raw material → finished good → customer)
- **AI Manufacturing Copilot** — Natural language Q&A about operations
- **Enterprise Security** — JWT + RBAC + audit trails + Zod validation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS 4 + TypeScript |
| Backend | Node.js + Express 5 + TypeScript + Prisma 7 |
| Database | PostgreSQL |
| AI Vision | YOLOv8 (Ultralytics) + OpenCV + FastAPI + PyTorch + CUDA |
| AI Scheduling | Google OR-Tools CP-SAT Solver + FastAPI |
| Auth | JWT + bcrypt + RBAC (5 roles) |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Python 3.10+ with NVIDIA GPU (CUDA) for AI features
- npm

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env  # Edit DATABASE_URL, JWT_SECRET

# Database setup
npx prisma generate
npx prisma migrate deploy
npx ts-node --transpile-only prisma/seed.ts

# Start server (port 3000)
npx ts-node --transpile-only src/server.ts
```

### 2. Frontend

```bash
cd frontend
npm install

# Start dev server (port 3001)
npm run dev
```

### 3. AI Services (requires NVIDIA GPU)

```bash
cd ai

# Install Python dependencies (in ultralytics venv or system)
pip install -r requirements.txt
pip install ortools

# Train YOLO model (first time only — needs dataset)
# Download dataset from Roboflow into ../dataset/sima_qc_data/
python train.py

# Start AI QC Vision service (port 8000)
python main.py

# Start OR-Tools Scheduling service (port 8001)
python scheduler.py
```

### 4. Login

Open `http://localhost:3001` and login:
- **Username:** `sigma`
- **Password:** `skibidi`

## Services Overview

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3001 | Next.js dashboard |
| Backend API | 3000 | Express REST API |
| AI QC Vision | 8000 | YOLO + OpenCV (FastAPI) |
| AI Scheduler | 8001 | OR-Tools CP-SAT (FastAPI) |
| PostgreSQL | 5432 | Database |

## API Endpoints

### Backend (port 3000)
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | JWT authentication |
| GET | /lots | Raw material lots |
| POST | /qc | QC inspections |
| GET | /production/orders | Production orders |
| GET | /inventory | Inventory transactions |
| GET | /traceability/:lotNumber | Full lot genealogy |
| POST | /ai/schedule | AI production scheduling |
| POST | /ai/copilot | AI manufacturing Q&A |

### AI Vision (port 8000)
| Method | Path | Description |
|--------|------|-------------|
| POST | /predict | YOLO defect detection |
| POST | /analyze-color | Colour consistency analysis |
| POST | /analyze-powder | Powder QC (colour + contamination) |
| POST | /full-inspect | Combined YOLO + colour |

### AI Scheduler (port 8001)
| Method | Path | Description |
|--------|------|-------------|
| POST | /optimize-schedule | OR-Tools CP-SAT scheduling |

## Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| sigma | skibidi | Admin |
| admin | password123 | Admin |
| qc001 | password123 | QC |
| wh001 | password123 | Warehouse |
| prod001 | password123 | Production |
| manager | password123 | Manager |

## Project Structure

```
├── backend/          # Express + Prisma + TypeScript
├── frontend/         # Next.js 16 + Tailwind 4
├── ai/               # Python AI services
│   ├── main.py       # QC Vision API (port 8000)
│   ├── scheduler.py  # OR-Tools Scheduler (port 8001)
│   ├── train.py      # YOLO training script
│   └── evaluate.py   # Model metrics
├── dataset/          # Training data (gitignored)
├── PRD.md            # Product Requirements Document
├── AI_LOG.md         # Development log
└── AI_RULES.md       # AI coding standards
```

## Team

**sigmaskibidiautowin** — CyberHack 2026, ITS Surabaya

## License

MIT
