# 🏭 Sima Arome — Enterprise Manufacturing Platform

AI-powered manufacturing operations platform with full lot traceability, QC management, production tracking, and inventory ledger.

---

## Quick Start

### Prerequisites

- **Node.js** v18+
- **PostgreSQL** v15+ (local install or Docker)
- **npm** (comes with Node.js)

### 1. Clone & Install

```bash
git clone https://github.com/Miqatsi/sigmaskibidiautowin.git
cd sigmaskibidiautowin

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### 2. Setup Database

Make sure PostgreSQL is running, then:

```bash
cd backend

# Create database (via psql)
psql -U postgres -h localhost -c "CREATE DATABASE sima_arome;"

# Copy environment file
# Edit .env and set your PostgreSQL password
```

Create `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/sima_arome?schema=public&sslmode=disable"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="8h"
PORT=3000
NODE_ENV=development
```

### 3. Run Migrations & Seed

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

### 4. Start Servers

**Terminal 1 — Backend (port 3000):**
```bash
cd backend
npx ts-node --transpile-only src/server.ts
```

**Terminal 2 — Frontend (port 3001):**
```bash
cd frontend
npm run dev
```

### 5. Open in Browser

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000/health
- **Prisma Studio:** `npx prisma studio` (from backend folder)

---

## Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | password123 | Admin (full access) |
| qc001 | password123 | QC Inspector |
| wh001 | password123 | Warehouse |
| prod001 | password123 | Production |

Demo mode (offline): `sigma` / `skibidi`

---

## API Endpoints (25+)

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /auth/login`, `GET /auth/profile` |
| Suppliers | CRUD `/suppliers` |
| Materials | CRUD `/materials` |
| Lots | CRUD `/lots`, `PATCH /lots/:id/status` |
| QC | CRUD `/qc` (auto-updates lot status) |
| Production | `/production/orders`, `/production/batches` |
| Inventory | `/inventory/transactions`, `/inventory/balance/:id` |
| Traceability | `GET /traceability/:lotNumber` |
| AI Copilot | `POST /ai/copilot`, `GET /ai/summary` |
| Warehouses | `GET /warehouses/locations`, `GET /warehouses/products` |

All endpoints (except login) require `Authorization: Bearer <token>` header.

---

## AI Manufacturing Copilot

Ask natural language questions about your manufacturing data:

```bash
POST /ai/copilot
{
  "question": "Why did lot RM-001 fail QC?"
}
```

**Example questions:**
- "Why did lot RM-001 fail QC?" → Root cause analysis
- "What is affected if RM-001 is contaminated?" → Impact/recall analysis
- "Which supplier has the highest failure rate?" → Supplier risk
- "Trace lot FG-001" → Traceability guidance

---

## Key Features

- ✅ **Full Lot Traceability** — Forward & backward trace (Supplier → Lot → QC → Production → Inventory)
- ✅ **AI Copilot** — Manufacturing insights, risk analysis, recommendations
- ✅ **QC Auto-Approval** — QC PASS auto-updates lot to APPROVED
- ✅ **Status State Machine** — Enforced transitions (PENDING_QC → APPROVED → CONSUMED)
- ✅ **RBAC** — 5 roles with granular access control
- ✅ **Audit Trail** — Every operation logged (WHO, WHAT, WHEN, OLD, NEW)
- ✅ **Enterprise Security** — Helmet, CORS, rate limiting, Zod validation, bcrypt

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Backend | Express + TypeScript (strict) |
| Database | PostgreSQL 18 + Prisma 7 |
| Auth | JWT + bcrypt + RBAC |
| Validation | Zod |
| Logging | Pino |
| Security | Helmet + CORS + Rate Limiting |

---

## Project Structure

```
├── backend/
│   ├── prisma/           # Schema, migrations, seed
│   ├── src/
│   │   ├── app.ts        # Express app setup
│   │   ├── server.ts     # Entry point
│   │   ├── lib/          # Prisma client, logger
│   │   ├── middleware/    # Auth, RBAC, audit, logging
│   │   └── modules/      # auth, supplier, material, lot, qc,
│   │                      # production, inventory, traceability,
│   │                      # warehouse, ai
│   └── bruno/            # API test collection
├── frontend/
│   └── src/
│       ├── app/          # Next.js pages
│       ├── components/   # UI components
│       ├── lib/          # API client, auth utils
│       └── types/        # TypeScript definitions
├── docker-compose.yml    # PostgreSQL container
├── AI_LOG.md             # Development progress log
└── AI_RULES.md           # Coding standards & checklist
```

---

## Testing with Bruno

1. Install [Bruno](https://www.usebruno.com/) (free, open source)
2. Open Collection → select `backend/bruno` folder
3. Select environment: **Development**
4. **Make sure backend server is running first!**
5. Run collection (requests execute in order: login → data → AI)

---

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npx vercel
```

### Backend (Railway / Render)
- Set environment variables (DATABASE_URL, JWT_SECRET, PORT)
- Deploy from GitHub repo
- Point to PostgreSQL instance

### Database (Neon / Supabase)
- Create free PostgreSQL instance
- Update DATABASE_URL in backend .env
- Run `npx prisma migrate deploy`

---

## Team

Built for CyberHack Hackathon 2026.

---

*For AI assistants: Read `AI_LOG.md` and `AI_RULES.md` before making changes.*
