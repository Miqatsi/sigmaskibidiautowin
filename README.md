# 🏭 Sima Arome

**Enterprise Manufacturing Intelligence Platform**

AI-powered manufacturing operations — lot traceability, QC automation, recall simulation, warehouse intelligence, production scheduling.

> Built for **CyberHack 2026** by Team sigmaskibidiautowin

---

## Quick Start

```bash
git clone https://github.com/Miqatsi/sigmaskibidiautowin.git
cd sigmaskibidiautowin

# Backend
cd backend
cp .env.example .env        # Edit DATABASE_URL with your PostgreSQL password
npm install
npx prisma migrate deploy
npx prisma db seed
npx ts-node --transpile-only src/server.ts

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:3001** → Login below.

---

## Access

| URL | Description |
|-----|-------------|
| http://localhost:3001 | Dashboard (Frontend) |
| http://localhost:3000/api-docs | Swagger API Documentation |
| http://localhost:3000/system/health | System Health Monitor |

---

## Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| Demo Admin | sigma | skibidi |
| Manager | manager | password123 |
| QC Inspector | qc001 | password123 |
| Production | prod001 | password123 |
| Warehouse | wh001 | password123 |

---

## Core Features

| Feature | Description |
|---------|-------------|
| 🧠 **AI Manufacturing Copilot** | Ask natural language questions about operations |
| 🚨 **Recall Impact Simulator** | Simulate contamination → see affected batches, inventory, customers |
| 🏪 **Warehouse Intelligence** | Cold chain monitoring, smart slotting, hazard segregation |
| 🔬 **Visual QC (YOLO)** | Upload images → AI detects defects and contamination |
| 📅 **PPIC Scheduling** | OR-Tools optimized production scheduling |
| 🔍 **Lot Traceability** | Full genealogy: Supplier → Lot → QC → Production → Inventory |
| 📊 **Intelligence Reports** | AI-generated executive manufacturing summaries |
| 🚨 **Operational Alerts** | Auto-detected risks (QC failures, expiry, supplier risk) |

---

## For Judges — 3-Minute Demo Walkthrough

1. **Login** → `sigma` / `skibidi`
2. **Intelligence Center** → See Plant Health Score + live alerts
3. **AI Copilot** → Ask: *"Why is PT Bahan Murah Jaya risky?"* → See evidence-based analysis
4. **Recall Simulator** → Select lot `RM-2026-001` → See contamination flow graph
5. **Warehouse Intelligence** → See floor map, cold chain alerts, smart slot recommendation
6. **Visual QC** → Upload any fruit/food image → See AI defect detection
7. **Generate Report** → Click "Generate Report" in Intelligence Center → Full executive summary

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Backend | Express + TypeScript + Prisma 7 + PostgreSQL |
| AI Vision | YOLOv8 + OpenCV + FastAPI |
| AI Scheduling | Google OR-Tools CP-SAT |
| Security | JWT + bcrypt + RBAC (5 roles) + Audit Trail |

---

## Architecture

```
Frontend (Next.js :3001)
    ↕ REST API
Backend (Express :3000) ←→ PostgreSQL (:5432)
    ↕                         16 tables, full indexes
AI Vision (FastAPI :8000)     AI Scheduler (FastAPI :8001)
    YOLOv8 + OpenCV              OR-Tools CP-SAT
```

> AI services are **optional** — platform works in Demo Mode without them.

---

📄 See [README-TECHNICAL.md](./README-TECHNICAL.md) for detailed setup, troubleshooting, and architecture docs.
