# 🏭 Sima Arome — Enterprise Manufacturing Intelligence Platform

AI-powered manufacturing operations system for **CyberHack 2026**.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │              Next.js 16 (App Router + Tailwind 4)                    │   │
│   │                      http://localhost:3001                           │   │
│   │                                                                     │   │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│   │  │Dashboard │ │Visual QC │ │  PPIC    │ │Traceabi- │ │   Lot    │ │   │
│   │  │ Overview │ │Inspector │ │Scheduler │ │  lity    │ │ Tracking │ │   │
│   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                          │              │              │                     │
└──────────────────────────┼──────────────┼──────────────┼─────────────────────┘
                           │              │              │
                    REST API calls   Image Upload    Schedule Request
                           │              │              │
┌──────────────────────────┼──────────────┼──────────────┼─────────────────────┐
│                    BACKEND SERVICES                                           │
│                                                                              │
│  ┌────────────────────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │     Express API (Port 3000)    │  │  AI QC Vision   │  │ AI Scheduler │  │
│  │                                │  │  (Port 8000)    │  │ (Port 8001)  │  │
│  │  • JWT Auth + RBAC (5 roles)   │  │                 │  │              │  │
│  │  • Zod Input Validation        │  │  • YOLOv8 GPU   │  │ • OR-Tools   │  │
│  │  • Audit Trail (immutable)     │  │  • OpenCV HSV   │  │   CP-SAT     │  │
│  │  • Rate Limiting + Helmet      │  │  • Powder QC    │  │ • Makespan   │  │
│  │                                │  │  • Defect Det.  │  │   Minimize   │  │
│  │  Modules:                      │  │                 │  │ • No-overlap │  │
│  │  ├── /auth (login, profile)    │  │  FastAPI +      │  │   Constraint │  │
│  │  ├── /lots (status machine)    │  │  PyTorch CUDA   │  │              │  │
│  │  ├── /qc (auto-update lots)    │  └─────────────────┘  │  FastAPI +   │  │
│  │  ├── /production (orders)      │                        │  Python      │  │
│  │  ├── /inventory (ledger)       │  ┌─────────────────┐  └──────────────┘  │
│  │  ├── /traceability (genealogy) │  │  AI Copilot     │                    │
│  │  ├── /ai/copilot (NLP Q&A)    │  │  (Built-in)     │                    │
│  │  └── /ai/schedule (OR-Tools)  │  │                 │                    │
│  │                                │  │  • Intent Det.  │                    │
│  │  Prisma 7 ORM                  │  │  • Context Agg. │                    │
│  └────────────────┬───────────────┘  │  • Evidence     │                    │
│                   │                   └─────────────────┘                    │
└───────────────────┼──────────────────────────────────────────────────────────┘
                    │
              SQL Queries (Prisma Adapter-PG)
                    │
┌───────────────────┼──────────────────────────────────────────────────────────┐
│              DATABASE LAYER                                                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL (Port 5432)                               │  │
│  │                                                                        │  │
│  │  AUTH:        roles, permissions, users                                 │  │
│  │  SUPPLY:      suppliers, raw_materials, raw_material_lots               │  │
│  │  PRODUCTION:  products, production_orders, production_batches           │  │
│  │  WAREHOUSE:   warehouses, storage_locations, inventory_transactions     │  │
│  │  QC:          qc_logs, sample_dispatches                                │  │
│  │  AUDIT:       audit_logs (immutable, append-only)                       │  │
│  │                                                                        │  │
│  │  16 tables │ Full indexes │ Soft-delete │ Optimistic locking            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
```
Raw Material → Receive Lot → QC Inspection (AI Vision) → Approve/Reject
                                                              │
                                    ┌─────────────────────────┘
                                    ▼
              PPIC Schedule (OR-Tools) → Production Order → Batch → Consume Lots
                                                                        │
                                                                        ▼
                                              Inventory IN → Warehouse → Dispatch
                                                                        │
                                                                        ▼
                                              Traceability: Full genealogy (any direction)
```

---

## 🚀 Quick Start (One Command)

```bash
chmod +x start.sh
./start.sh
```

Open **http://localhost:3001** → Login: `sigma` / `skibidi`

---

## Manual Setup (Step by Step)

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 15+ | `pg_isready` |
| Python | 3.10+ | `python3 --version` |
| NVIDIA GPU + CUDA | (for AI) | `nvidia-smi` |

### Step 1: Clone & Install

```bash
git clone https://github.com/Miqatsi/sigmaskibidiautowin.git
cd sigmaskibidiautowin

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install Python AI dependencies
pip install ultralytics fastapi uvicorn python-multipart ortools torch torchvision Pillow numpy opencv-python
```

### Step 2: Database Setup

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database (first time only)
sudo -u postgres psql -c "CREATE DATABASE sima_arome;" 2>/dev/null
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'sima_secret';"

# Run migrations and seed data
cd backend
npx prisma generate
npx prisma migrate deploy
npx ts-node --transpile-only prisma/seed.ts
cd ..
```

You should see:
```
🌱 SEEDING COMPLETE!
  Login: sigma / skibidi (Admin)
```

### Step 3: Start Backend (port 3000)

```bash
cd backend
npx ts-node --transpile-only src/server.ts
```

Verify: `curl http://localhost:3000/health` → `{"status":"ok"}`

### Step 4: Start Frontend (port 3001)

Open a **new terminal**:
```bash
cd frontend
npm run dev
```

Verify: Open http://localhost:3001 → you should see the login page.

### Step 5: Start AI Services (needs NVIDIA GPU)

Open a **new terminal**:
```bash
cd ai
python main.py
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok","models":{"primary_qc":true}}`

Open another **new terminal**:
```bash
cd ai
python scheduler.py
```

Verify: `curl http://localhost:8001/health` → `{"status":"ok","engine":"Google OR-Tools CP-SAT"}`

> **Note:** Model weights (`best.pt`) and dataset are included in the repo. No training needed.

---

## ✅ Test Each Feature

After all services are running, login at http://localhost:3001 with `sigma` / `skibidi`:

| Feature | How to Test |
|---------|-------------|
| **Login** | Enter sigma / skibidi → redirects to dashboard |
| **Lot Tracking** | Go to `/dashboard/lots` → see 35 lots with statuses |
| **QC Logs** | Go to `/dashboard/qc` → see inspection history |
| **Visual QC (AI)** | Go to `/dashboard/visual-qc` → upload any fruit image → see detection |
| **PPIC Schedule** | Go to `/dashboard/ppic` → click "Generate AI Schedule" → see 22 orders scheduled |
| **Production** | Go to `/dashboard/production` → see orders |
| **Inventory** | Go to `/dashboard/inventory` → see transactions |
| **Traceability** | Go to `/dashboard/traceability` → search `FG-BATCH-001` → see full genealogy |
| **Suppliers** | Go to `/dashboard/suppliers` → see 5 suppliers |
| **Materials** | Go to `/dashboard/materials` → see 10 raw materials |

---

## Login Credentials

| Username | Password | Role |
|----------|----------|------|
| **sigma** | **skibidi** | Admin (full access) |
| manager | password123 | PPIC Manager |
| qc001 | password123 | QC Inspector |
| prod001 | password123 | Production Operator |
| wh001 | password123 | Warehouse Staff |

---

## Services Overview

| Service | Port | What it does |
|---------|------|-------------|
| Frontend | 3001 | Next.js dashboard UI |
| Backend | 3000 | Express REST API + PostgreSQL |
| AI Vision | 8000 | YOLO defect detection + powder colour analysis |
| AI Scheduler | 8001 | Google OR-Tools production scheduling |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED` on port 3000 | Backend not running. Run `cd backend && npx ts-node --transpile-only src/server.ts` |
| `ECONNREFUSED` on port 5432 | PostgreSQL not running. Run `sudo systemctl start postgresql` |
| Login fails | Run seed: `cd backend && npx ts-node --transpile-only prisma/seed.ts` |
| AI Vision not working | Start AI service: `cd ai && python main.py` |
| PPIC shows "Rule-based" | Start scheduler: `cd ai && python scheduler.py` |
| `ModuleNotFoundError: ultralytics` | Install: `pip install ultralytics fastapi uvicorn ortools torch` |
| Database doesn't exist | Run: `sudo -u postgres psql -c "CREATE DATABASE sima_arome;"` |
| Frontend blank page | Clear localStorage in browser, refresh |

---

## Project Structure

```
sigmaskibidiautowin/
├── backend/              # Express + Prisma + TypeScript (port 3000)
├── frontend/             # Next.js 16 + Tailwind 4 (port 3001)
├── ai/                   # Python AI services
│   ├── main.py           # QC Vision API (port 8000)
│   ├── scheduler.py      # OR-Tools Scheduler (port 8001)
│   ├── train.py          # YOLO training (optional)
│   └── runs/detect/train/weights/best.pt  # Trained model (6MB)
├── dataset/              # Training dataset (included)
├── start.sh              # One-command startup script
├── PRD.md                # Product Requirements Document
├── AI_LOG.md             # Development log
└── AI_RULES.md           # AI coding standards
```

---

## Tech Stack

- **Frontend:** Next.js 16 + Tailwind CSS 4 + TypeScript
- **Backend:** Express 5 + Prisma 7 + PostgreSQL + Zod
- **AI Vision:** YOLOv8 + OpenCV + FastAPI + CUDA
- **AI Scheduling:** Google OR-Tools CP-SAT + FastAPI
- **Security:** JWT + bcrypt + RBAC (5 roles) + audit trails

---

## Team

**sigmaskibidiautowin** — CyberHack 2026, ITS Surabaya
