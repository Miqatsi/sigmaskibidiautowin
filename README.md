# 🏭 Sima Arome — Enterprise Manufacturing Intelligence Platform

AI-powered manufacturing operations system for **CyberHack 2026**.

## 🚀 Quick Start (One Command)

```bash
./start.sh
```

This starts everything: backend, frontend, AI vision, AI scheduler.

Open **http://localhost:3001** → Login: `sigma` / `skibidi`

---

## Manual Setup (Step by Step)

### Prerequisites

- Node.js 20+, PostgreSQL, Python 3.10+, NVIDIA GPU (for AI)

### Step 1: Database

```bash
sudo systemctl start postgresql
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npx ts-node --transpile-only prisma/seed.ts
```

### Step 2: Backend (port 3000)

```bash
cd backend
npx ts-node --transpile-only src/server.ts
```

### Step 3: Frontend (port 3001)

```bash
cd frontend
npm install
npm run dev
```

### Step 4: AI Services (optional — needs NVIDIA GPU)

```bash
cd ai

# QC Vision — detects defects, analyzes powder colour (port 8000)
python main.py

# OR-Tools Scheduler — optimal production scheduling (port 8001)
python scheduler.py
```

> **Note:** AI model weights (`best.pt`) and dataset are included in the repo. No training needed.

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

## Features

| Feature | URL | Description |
|---------|-----|-------------|
| Dashboard | `/dashboard` | Overview with stats |
| Lot Tracking | `/dashboard/lots` | Raw material lots + status |
| Quality Control | `/dashboard/qc` | QC inspection logs |
| **Visual QC (AI)** | `/dashboard/visual-qc` | Upload image → AI detects defects |
| Production | `/dashboard/production` | Production orders |
| **PPIC Schedule (AI)** | `/dashboard/ppic` | OR-Tools optimal scheduling |
| Inventory | `/dashboard/inventory` | Warehouse transactions |
| Traceability | `/dashboard/traceability` | Full lot genealogy |
| Suppliers | `/dashboard/suppliers` | Supplier management |
| Materials | `/dashboard/materials` | Raw material catalog |

---

## Services

| Service | Port | What it does |
|---------|------|-------------|
| Frontend | 3001 | Next.js dashboard |
| Backend | 3000 | Express REST API |
| AI Vision | 8000 | YOLO + OpenCV (defect detection, powder analysis) |
| AI Scheduler | 8001 | Google OR-Tools (optimal production scheduling) |

---

## Tech Stack

- **Frontend:** Next.js 16 + Tailwind CSS 4 + TypeScript
- **Backend:** Express 5 + Prisma 7 + PostgreSQL + Zod
- **AI Vision:** YOLOv8 + OpenCV + FastAPI + CUDA
- **AI Scheduling:** Google OR-Tools CP-SAT + FastAPI
- **Security:** JWT + bcrypt + RBAC + audit trails

---

## Team

**sigmaskibidiautowin** — CyberHack 2026, ITS Surabaya
