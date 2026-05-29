# Sima Arome — Technical Documentation

Detailed setup, architecture, and troubleshooting for developers.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| PostgreSQL | 15+ | `pg_isready` |
| Python | 3.10+ (for AI services) | `python --version` |
| NVIDIA GPU + CUDA (optional) | For AI Vision | `nvidia-smi` |

---

## Full Setup (Step by Step)

### 1. Clone & Install

```bash
git clone https://github.com/Miqatsi/sigmaskibidiautowin.git
cd sigmaskibidiautowin

cd backend && npm install && cd ..
cd frontend && npm install && cd ..
pip install -r ai/requirements.txt  # Optional: AI services
```

### 2. Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE sima_arome;"

# Configure
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL with your PostgreSQL password

# Migrate + Seed
npx prisma migrate deploy
npx prisma db seed
```

### 3. Start Services

**Demo Mode (Backend + Frontend only):**
```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

**Full Mode (includes AI):**
```bash
# Windows
start.bat ai

# Linux/Mac — AI services start automatically if Python deps available
./start.sh
```

**Manual start:**
```bash
# Terminal 1: Backend
cd backend && npx ts-node --transpile-only src/server.ts

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: AI Vision (optional)
cd ai && python main.py

# Terminal 4: AI Scheduler (optional)
cd ai && python scheduler.py
```

---

## Services & Ports

| Service | Port | Required |
|---------|------|----------|
| Backend API | 3000 | ✅ Yes |
| Frontend | 3001 | ✅ Yes |
| PostgreSQL | 5432 | ✅ Yes |
| AI Vision (YOLO) | 8000 | ❌ Optional |
| AI Scheduler (OR-Tools) | 8001 | ❌ Optional |

---

## Environment Variables

See `backend/.env.example` for all variables:

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | ✅ | PostgreSQL connection string |
| JWT_SECRET | ✅ | JWT signing secret |
| PORT | ✅ | Backend port (default: 3000) |
| CORS_ORIGIN | ❌ | Frontend URL (default: localhost:3001) |
| YOLO_API_URL | ❌ | AI Vision service URL |
| PPIC_API_URL | ❌ | PPIC Scheduler URL |
| DEMO_MODE | ❌ | true = graceful degradation |
| AI_PROVIDER | ❌ | mock (default) or openai |

---

## Project Structure

```
sigmaskibidiautowin/
├── backend/                    # Express + Prisma + TypeScript
│   ├── src/
│   │   ├── app.ts             # Express app (routes, middleware)
│   │   ├── server.ts          # Entry point
│   │   ├── swagger.ts         # OpenAPI spec
│   │   ├── lib/               # Prisma client, logger
│   │   ├── middleware/        # Auth, RBAC, audit, logging
│   │   └── modules/           # Feature modules
│   │       ├── auth/
│   │       ├── supplier/
│   │       ├── material/
│   │       ├── lot/
│   │       ├── qc/
│   │       ├── production/
│   │       ├── inventory/
│   │       ├── warehouse/
│   │       ├── traceability/
│   │       ├── ai/
│   │       ├── alerts/
│   │       └── health/
│   ├── prisma/                # Schema, migrations, seed
│   └── bruno/                 # API test collection
├── frontend/                  # Next.js 16 + Tailwind 4
│   └── src/app/dashboard/     # 19 pages
├── ai/                        # Python AI services
│   ├── main.py                # YOLO + OpenCV (port 8000)
│   ├── scheduler.py           # OR-Tools (port 8001)
│   └── runs/detect/train/weights/best.pt
├── dataset/                   # YOLO training data
├── start.sh                   # Linux/Mac startup
├── start.bat                  # Windows startup
├── docker-compose.yml         # PostgreSQL container
├── PRD.md                     # Product Requirements
├── AI_LOG.md                  # Development history
└── AI_RULES.md                # Coding standards
```

---

## API Documentation

Interactive Swagger UI: **http://localhost:3000/api-docs**

30+ endpoints grouped by:
- Authentication
- Master Data (Suppliers, Materials)
- Operations (Lots, QC, Production)
- Inventory
- Warehouse Intelligence
- AI Services (Copilot, Reports, Alerts)
- Analytics (Traceability, Recall)

---

## Database Schema (16 tables)

```
AUTH:        roles, permissions, role_permissions, users
SUPPLY:      suppliers, raw_materials, raw_material_lots
PRODUCTION:  products, production_orders, production_batches, production_batch_raw_materials
WAREHOUSE:   warehouses, storage_locations, inventory_transactions
QC:          qc_logs, sample_dispatches
AUDIT:       audit_logs
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED :3000` | Start backend: `cd backend && npx ts-node --transpile-only src/server.ts` |
| `ECONNREFUSED :5432` | Start PostgreSQL |
| `EADDRINUSE` | Kill old processes: `taskkill /F /IM node.exe` (Windows) |
| Login fails | Run seed: `cd backend && npx prisma db seed` |
| AI Vision offline | Start: `cd ai && python main.py` (or use Demo Mode) |
| Laptop freezes | Don't run AI services — use Demo Mode (Backend + Frontend only) |
| Frontend hydration error | Browser extension conflict — harmless, suppressed |

---

## Testing with Bruno

1. Install [Bruno](https://www.usebruno.com/)
2. Open Collection → `backend/bruno/`
3. Select environment: Development
4. Run collection (19 requests, sequential)

---

## Team

**sigmaskibidiautowin** — CyberHack 2026
