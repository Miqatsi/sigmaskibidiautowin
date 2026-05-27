# AI Development Log — Sima Arome

> This file tracks what has been built, decisions made, and current state of the project.
> Updated by AI assistants working on this codebase.

---

## Project Overview

**App:** Sima Arome — Enterprise-Ready AI Manufacturing App
**Purpose:** Lot traceability, QC management, production tracking, inventory ledger for manufacturing
**Stack:** Node.js (Express) + TypeScript (strict) + PostgreSQL + Prisma 7 + Next.js (frontend, not started)

---

## Current State: Full Manufacturing Chain Complete & Verified

### ✅ Phase 1 — Infrastructure Setup

| Item | Status | Notes |
|------|--------|-------|
| PostgreSQL 18 (local install) | ✅ | Running on localhost:5432, db: `sima_arome` |
| Docker Compose | ✅ | `docker-compose.yml` at root (postgres:15 image, alternative) |
| Prisma 7 + adapter-pg | ✅ | Driver adapter pattern (required by Prisma 7) |
| Initial migration | ✅ | `20260527095939_init_schema` |
| Index hardening migration | ✅ | `20260527101717_add_indexes_and_audit_fields` |
| Seed data | ✅ | Roles, Users, Suppliers, Materials, Products, Warehouse |
| Prisma Studio | ✅ | Works via `npx prisma studio` |

### ✅ Phase 2 — Security & Middleware

| Item | Status | Notes |
|------|--------|-------|
| Helmet (security headers) | ✅ | Applied globally |
| CORS | ✅ | Configurable via CORS_ORIGIN env |
| Rate limiting | ✅ | 200/15min general, 20/15min auth |
| Request logger (pino) | ✅ | Method, path, status, duration, IP |
| Zod validation | ✅ | All inputs validated before processing |

### ✅ Phase 3 — Audit Logging (Configurable Policy)

| Item | Status | Notes |
|------|--------|-------|
| AuditLog model | ✅ | WHO, WHAT, WHEN, OLD, NEW + IP + UserAgent |
| Strict policy | ✅ | Critical ops (lot status, QC) — fails if audit fails |
| Best-effort policy | ✅ | Non-critical ops (login) — logs warning, continues |
| Audit helpers | ✅ | `auditCreate()`, `auditUpdate()`, `auditDelete()` |
| Verified in DB | ✅ | Full old/new JSON stored correctly |

### ✅ Phase 4 — Auth + JWT + RBAC

| Item | Status | Notes |
|------|--------|-------|
| POST /auth/login | ✅ | Returns JWT, supports username or email |
| GET /auth/profile | ✅ | Protected endpoint |
| JWT middleware | ✅ | Bearer token extraction + verification |
| RBAC middleware | ✅ | `authorize('QC', 'Admin')` pattern |
| Token expiry | ✅ | 8h default (configurable) |

### ✅ Phase 5 — Supplier Module

| Item | Status | Notes |
|------|--------|-------|
| POST /suppliers | ✅ | Create (Admin, Warehouse) |
| GET /suppliers | ✅ | List with pagination (all roles) |
| GET /suppliers/:id | ✅ | Detail with recent lots |
| PATCH /suppliers/:id | ✅ | Update (Admin, Warehouse) |
| DELETE /suppliers/:id | ✅ | Soft-delete (Admin only) |
| Zod validation | ✅ | CreateSupplierSchema, UpdateSupplierSchema |
| Audit logging | ✅ | All CUD operations logged |

### ✅ Phase 6 — Raw Material Module

| Item | Status | Notes |
|------|--------|-------|
| POST /materials | ✅ | Create (Admin, Warehouse) |
| GET /materials | ✅ | List with pagination |
| GET /materials/:id | ✅ | Detail with recent lots |
| PATCH /materials/:id | ✅ | Update |
| DELETE /materials/:id | ✅ | Soft-delete |
| Audit logging | ✅ | All CUD operations logged |

### ✅ Phase 7 — Lot Module (THE BACKBONE)

| Item | Status | Notes |
|------|--------|-------|
| POST /lots | ✅ | Receive new lot (Warehouse, Admin) |
| GET /lots | ✅ | List with filters (status, supplier, material) |
| GET /lots/:id | ✅ | Detail with QC logs |
| GET /lots/number/:lotNumber | ✅ | Natural key lookup (manufacturing standard) |
| PATCH /lots/:id/status | ✅ | Status transition (QC, Production, Admin) |
| Status state machine | ✅ | PENDING_QC → APPROVED/REJECTED → CONSUMED |
| Invalid transition blocked | ✅ | Returns 422 with clear message |
| RBAC enforced | ✅ | Warehouse can't approve, only QC/Admin can |
| Strict audit | ✅ | Status changes use strict audit policy |

**Lot Status Flow:**
```
PENDING_QC → APPROVED → CONSUMED (terminal)
PENDING_QC → REJECTED → PENDING_QC (re-inspection allowed)
```

### ✅ Phase 8 — QC Module

| Item | Status | Notes |
|------|--------|-------|
| POST /qc | ✅ | Create inspection (auto-updates lot status) |
| GET /qc | ✅ | List with filters (type, result, lotId, batchId) |
| GET /qc/:id | ✅ | Detail with sample dispatches |
| PATCH /qc/:id | ✅ | Update result (re-inspection) |
| Auto lot status update | ✅ | PASS→APPROVED, FAIL→REJECTED, CONDITIONAL→no change |
| Strict audit | ✅ | QC is compliance-critical |

### ✅ Phase 9 — Production Module

| Item | Status | Notes |
|------|--------|-------|
| POST /production/orders | ✅ | Create order (Admin, Production, Manager) |
| GET /production/orders | ✅ | List with status filter |
| PATCH /production/orders/:id/status | ✅ | Status transitions |
| POST /production/batches | ✅ | Create batch (consumes APPROVED lots) |
| GET /production/batches | ✅ | List with filters |
| PATCH /production/batches/:id/status | ✅ | Complete/fail batch |
| Lot consumption validation | ✅ | Only APPROVED lots can be consumed |
| Auto order completion | ✅ | Order → COMPLETED when all batches done |

### ✅ Phase 10 — Inventory Ledger

| Item | Status | Notes |
|------|--------|-------|
| POST /inventory/transactions | ✅ | Record movement (IN/OUT/TRANSFER/ADJUST/CONSUME/SHIP) |
| GET /inventory/transactions | ✅ | Transaction history with filters |
| GET /inventory/balance/:locationId | ✅ | Reconstructed stock from ledger |
| Append-only design | ✅ | Never update/delete transactions |

### ✅ Phase 11 — Traceability API (THE KILLER FEATURE)

| Item | Status | Notes |
|------|--------|-------|
| GET /traceability/:lotNumber | ✅ | Full lot genealogy |
| Forward trace (RM → FG) | ✅ | Raw material → QC → Production → Inventory |
| Backward trace (FG → RM) | ✅ | Finished good → Raw materials → Suppliers |
| Cross-lot linking | ✅ | Shows all materials used in a batch |

**Demo scenario:**
```
Q: "Where did contaminated lot FG-E2E-001 come from?"
A: Citric Acid (Lot: RM-E2E-001) from PT Essential Oil Indo — 150 kg
   QC: PASS (INCOMING)
   Production: FG-E2E-001 (COMPLETED)
   Inventory: +100 bottle at Rak A1
```

---

## End-to-End Test Results (Full Chain)

| Step | Action | Result |
|------|--------|--------|
| 1 | Receive lot (RM-E2E-001) | ✅ 201, status: PENDING_QC |
| 2 | QC inspection (PASS) | ✅ 201, lot auto-updated to APPROVED |
| 3 | Create production order | ✅ 201 |
| 4 | Create batch (consumes lot) | ✅ 201, lot → CONSUMED |
| 5 | Complete batch | ✅ 200, batch → COMPLETED |
| 6 | Record inventory IN | ✅ 201, +100 bottle |
| 7a | Trace RM-E2E-001 (forward) | ✅ 200, shows QC + production + inventory |
| 7b | Trace FG-E2E-001 (backward) | ✅ 200, shows raw materials + suppliers |

| Test | Result | Details |
|------|--------|---------|
| Health check | ✅ 200 | `GET /health` |
| Login (admin) | ✅ 200 | Token returned with role |
| Login (qc001) | ✅ 200 | QC role in payload |
| Profile (with token) | ✅ 200 | User + role data |
| Profile (no token) | ✅ 401 | Rejected |
| GET /suppliers | ✅ 200 | 3 seeded suppliers with pagination |
| GET /materials | ✅ 200 | 5 seeded materials |
| POST /lots (create) | ✅ 201 | Lot created with PENDING_QC status |
| PATCH /lots/:id/status (QC approve) | ✅ 200 | PENDING_QC → APPROVED, version incremented |
| PATCH /lots/:id/status (invalid) | ✅ 422 | APPROVED → REJECTED blocked |
| PATCH /lots/:id/status (wrong role) | ✅ 403 | Warehouse user blocked from status change |
| Audit log verification | ✅ | Full old/new JSON, user, IP, timestamp stored |

---

## Database Schema (16 tables)

```
AUTH:           Role, Permission, RolePermission, User
SUPPLY CHAIN:  Supplier, RawMaterial, RawMaterialLot
PRODUCTION:    Product, ProductionOrder, ProductionBatch, ProductionBatchRawMaterial
WAREHOUSE:     Warehouse, StorageLocation, InventoryTransaction
QC:            QCLog, SampleDispatch
AUDIT:         AuditLog
```

**Indexes on:** lotNumber, status, supplierId, materialId, productId, orderId, batchId, createdAt, expiryDate, plannedDate, startedAt, type, result, action

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── prisma.config.ts
├── src/
│   ├── app.ts                          # Express app (helmet, cors, rate-limit, all routes)
│   ├── server.ts                       # Entry point (port 3000)
│   ├── lib/
│   │   ├── prisma.ts                   # PrismaClient singleton (adapter-pg)
│   │   └── logger.ts                   # Pino logger
│   ├── middleware/
│   │   ├── index.ts                    # Barrel export
│   │   ├── audit.ts                    # Audit logging (strict/best-effort policy)
│   │   ├── authenticate.ts             # JWT verification
│   │   ├── authorize.ts                # RBAC role check
│   │   └── requestLogger.ts            # HTTP request logging
│   ├── modules/
│   │   ├── auth/                       # POST /login, GET /profile
│   │   ├── supplier/                   # CRUD /suppliers
│   │   ├── material/                   # CRUD /materials
│   │   ├── lot/                        # /lots + status machine
│   │   ├── qc/                         # /qc (auto-updates lot status)
│   │   ├── production/                 # /production/orders + /production/batches
│   │   ├── inventory/                  # /inventory/transactions + /inventory/balance
│   │   └── traceability/               # GET /traceability/:lotNumber (KILLER FEATURE)
│   └── types/
│       └── express.ts
├── .env
├── package.json
└── tsconfig.json
```

---

## Key Technical Decisions

1. **Prisma 7 driver adapter** — `@prisma/adapter-pg` required. No `datasourceUrl` in constructor.
2. **Audit policy: strict vs best-effort** — Critical ops (lot status, QC) fail if audit fails. Non-critical (login) continue.
3. **Lot status state machine** — Enforced in service layer, not just DB constraints. Clear error messages.
4. **Soft delete everywhere** — `deletedAt` field. Manufacturing keeps history. Never hard delete.
5. **Optimistic locking** — `version` field incremented on every update.
6. **Zod validation** — All request bodies validated before touching DB.
7. **Module pattern** — schema → service → controller → routes. Business logic in service only.
8. **Natural key lookup** — `/lots/number/:lotNumber` for manufacturing floor usage.

---

## Seeded Data

| Table | Records | Details |
|-------|---------|---------|
| Roles | 5 | Admin, QC, Warehouse, Production, Manager |
| Users | 4 | admin, qc001, wh001, prod001 (password: `password123`) |
| Suppliers | 3 | PT Aroma Nusantara, CV Bahan Kimia Jaya, PT Essential Oil Indo |
| Raw Materials | 5 | Orange Oil, Coffee Extract, Vanilla, Ethanol, Citric Acid |
| Products | 3 | Orange Extract, Coffee Flavour, Vanilla Flavour |
| Warehouses | 1 | Gudang Utama |
| Storage Locations | 3 | Rak A1, Rak B1, Cold Storage |

---

## How to Run

```bash
cd backend

# Start server
npx ts-node --transpile-only src/server.ts

# Database commands
npx prisma migrate dev          # Run migrations
npx prisma db seed              # Seed data
npx prisma studio               # Visual DB browser
npx prisma generate             # Regenerate client after schema changes
```

---

## What's Next (Not Started)

Priority order:

1. **Swagger/OpenAPI** — `localhost:3000/docs`
2. **Frontend** — Next.js App Router + Tailwind (high-contrast factory UI)
3. **Testing** — Vitest + Supertest
4. **Dispatch Module** — Sample dispatch to labs, finished goods dispatch
5. **Dashboard analytics** — KPIs, charts, real-time status

---

## Environment

- **OS:** Windows
- **Node:** (check with `node -v`)
- **PostgreSQL:** v18, local install (password: in .env, not here)
- **Prisma:** v7.8.0
- **TypeScript:** strict mode
- **Port:** 3000

---

*Last updated: 2026-05-27 (Phase 11 complete — full traceability chain verified)*

---

## Session: 2026-05-27 — Frontend Setup + Demo Login

### AI Self-Review Protocol

```
Date: 2026-05-27
Task: Setup Next.js frontend + demo login (sigma/skibidi)
Files Changed:
  - frontend/ (entire new directory — Next.js 16 + Tailwind 4 + TypeScript)
  - frontend/src/app/ (layout, page, login, dashboard + 7 module pages)
  - frontend/src/components/ (Sidebar, Header, Button, Input, Card, Badge)
  - frontend/src/lib/ (api.ts, auth.ts)
  - frontend/src/types/ (index.ts — all model interfaces)
  - frontend/.env.local (NEXT_PUBLIC_API_URL)
  - frontend/next.config.ts (port 3001)
  - backend/prisma/seed.ts (added sigma user with password skibidi)
Completed:
  - Next.js App Router project initialized (port 3001)
  - Tailwind CSS configured with high-contrast factory-friendly styles
  - Login page with demo/offline fallback (sigma/skibidi works without backend)
  - Dashboard layout with sidebar navigation (8 nav items)
  - Dashboard overview page with summary cards + quick actions
  - Lot tracking page (table with status badges)
  - QC inspection page (table with type/result)
  - Production orders page (table with status)
  - Inventory transactions page (table with type badges)
  - Suppliers page (table)
  - Materials page (table)
  - Traceability page (search + forward/backward trace display)
  - Reusable UI components (Button, Input, Card, Badge with status mapping)
  - Centralized API client with auth headers, error handling, network error resilience
  - Auth utilities (setAuth, getUser, logout, isAuthenticated)
  - TypeScript interfaces for all backend models
  - Build verified: 0 errors, all routes compile
Remaining:
  - Role-based views (show/hide nav items based on role)
  - Create/edit forms (lots, QC, production, suppliers, materials)
  - Real-time data refresh / polling
  - Loading states on navigation
  - AI features (endpoint, QC parsing, PPIC)
  - Accessibility improvements
  - Mobile responsive testing
Risks:
  - Demo mode uses fake token — dashboard pages show error when backend is down
  - No form validation on frontend yet (relies on backend Zod)
Technical Debt:
  - Demo login credentials hardcoded in frontend (acceptable for hackathon)
  - No refresh token flow
  - No client-side caching/SWR
Bugs:
  - None known (build passes clean)
Security Concerns:
  - Demo token is a plain string, not a real JWT — only for offline demo
  - localStorage for token storage (standard SPA pattern, acceptable)
Next Priority:
  - Start backend (PostgreSQL + seed) so frontend loads real data
  - Add create/edit forms for lots and QC (most demo-impactful)
  - AI features integration
```

### Frontend Architecture

```
frontend/ (Next.js 16 + Tailwind 4)
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (metadata)
│   │   ├── page.tsx                # Redirect → /login or /dashboard
│   │   ├── globals.css             # Tailwind + factory styles
│   │   ├── login/page.tsx          # Login with demo fallback
│   │   └── dashboard/
│   │       ├── layout.tsx          # Auth guard + sidebar + header
│   │       ├── page.tsx            # Overview (stats + quick actions)
│   │       ├── lots/page.tsx       # Lot tracking table
│   │       ├── qc/page.tsx         # QC inspection logs
│   │       ├── production/page.tsx # Production orders
│   │       ├── inventory/page.tsx  # Inventory transactions
│   │       ├── suppliers/page.tsx  # Supplier management
│   │       ├── materials/page.tsx  # Raw materials catalog
│   │       └── traceability/page.tsx # Lot tracing (search)
│   ├── components/
│   │   ├── layout/ (Sidebar, Header)
│   │   └── ui/ (Button, Input, Card, Badge)
│   ├── lib/ (api.ts, auth.ts)
│   └── types/ (index.ts)
├── .env.local                      # NEXT_PUBLIC_API_URL=http://localhost:3000
├── next.config.ts                  # Dev port 3001
└── package.json
```

### Key Decisions

1. **Demo/offline login** — Frontend works without backend using hardcoded sigma/skibidi credentials. Tries backend first, falls back to local auth.
2. **Port 3001** — Frontend on 3001, backend on 3000 (matches CORS_ORIGIN in backend).
3. **High-contrast UI** — Large fonts (text-base minimum), big buttons (min-h-12), clear status badges per AI_RULES.
4. **Centralized API client** — Single `api.ts` handles auth headers, 401 redirect, network errors.
5. **Status badge mapping** — Consistent color coding: green=approved/pass, yellow=pending, red=rejected/fail.

### Seeded Users (Updated)

| Username | Password | Role | Notes |
|----------|----------|------|-------|
| sigma | skibidi | Admin | Demo account (primary) |
| admin | password123 | Admin | Original admin |
| qc001 | password123 | QC | QC inspector |
| wh001 | password123 | Warehouse | Warehouse staff |
| prod001 | password123 | Production | Production operator |

---

*Last updated: 2026-05-27 (Frontend setup complete — demo login working)*

---

## Session: 2026-05-27 — Backend + Frontend Full Integration

### AI Self-Review Protocol

```
Date: 2026-05-27
Task: Get backend running and connected to frontend (lots, QC, production, inventory, suppliers, materials, traceability)
Files Changed:
  - backend/prisma/seed.ts (sigma user already added from previous session)
  - frontend/src/app/login/page.tsx (fixed: send 'username' field instead of 'login')
  - frontend/src/app/dashboard/traceability/page.tsx (rewritten to match actual API response)
  - frontend/src/lib/api.ts (network error handling, demo mode detection)
  - frontend/src/lib/auth.ts (handle role as string from backend)
  - frontend/src/types/index.ts (AuthResponse role type flexibility)
Completed:
  - PostgreSQL initialized (initdb on Arch Linux)
  - Database 'sima_arome' created with password auth
  - Prisma migrations deployed (2 migrations)
  - Seed data loaded (roles, users, suppliers, materials, products, warehouse, storage locations)
  - Backend server running on port 3000
  - Frontend dev server running on port 3001
  - CORS verified (frontend origin allowed)
  - Login flow working end-to-end (sigma/skibidi → real JWT)
  - Fixed login payload (username field, not login)
  - Fixed auth response handling (role as string → normalized to object)
  - Fixed traceability page to match actual API response structure
  - Created sample data via API:
    - 3 raw material lots (LOT-RM-001, LOT-RM-002, LOT-RM-003)
    - 3 QC inspections (2 PASS, 1 FAIL — auto-updated lot statuses)
    - 2 production orders (PO-2026-001, PO-2026-002)
    - 2 inventory transactions (IN movements)
  - All frontend pages verified loading real data:
    - /dashboard — stats cards with totals
    - /dashboard/lots — 3 lots with status badges
    - /dashboard/qc — 3 inspections with results
    - /dashboard/production — 2 orders
    - /dashboard/inventory — 2 transactions
    - /dashboard/suppliers — 3 suppliers
    - /dashboard/materials — 5 materials
    - /dashboard/traceability — LOT-RM-001 trace shows QC history
Remaining:
  - Role-based views (hide nav items per role)
  - Create/edit forms (inline or modal)
  - AI features (endpoint, QC parsing, PPIC)
  - Accessibility improvements
  - Deployment
Risks:
  - PostgreSQL service not enabled on boot (manual start required)
  - No refresh token — 8h session expiry
Technical Debt:
  - Demo login fallback still in code (harmless, useful for demos)
  - No client-side caching (every page load hits API)
Bugs:
  - None known — full stack verified working
Security Concerns:
  - None new — all existing security measures intact
Next Priority:
  - Create/edit forms for lots and QC (most demo-impactful)
  - AI features integration
  - Polish UI for demo
```

### Infrastructure Setup (Arch Linux)

```bash
# PostgreSQL setup (one-time)
sudo -u postgres initdb -D /var/lib/postgres/data
sudo systemctl start postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'sima_secret';"
sudo -u postgres psql -c "CREATE DATABASE sima_arome;"

# Backend startup
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npx ts-node --transpile-only prisma/seed.ts
npx ts-node --transpile-only src/server.ts  # port 3000

# Frontend startup
cd frontend
npm install
npm run dev  # port 3001
```

### Verified API Endpoints (All Working)

| Endpoint | Method | Status | Frontend Page |
|----------|--------|--------|---------------|
| /health | GET | ✅ 200 | — |
| /auth/login | POST | ✅ 200 | /login |
| /lots | GET | ✅ 200 | /dashboard/lots |
| /lots | POST | ✅ 201 | /dashboard/lots |
| /qc | GET | ✅ 200 | /dashboard/qc |
| /qc | POST | ✅ 201 | /dashboard/qc |
| /production/orders | GET | ✅ 200 | /dashboard/production |
| /production/orders | POST | ✅ 201 | /dashboard/production |
| /inventory | GET | ✅ 200 | /dashboard/inventory |
| /inventory/transactions | POST | ✅ 201 | /dashboard/inventory |
| /suppliers | GET | ✅ 200 | /dashboard/suppliers |
| /materials | GET | ✅ 200 | /dashboard/materials |
| /traceability/:lotNumber | GET | ✅ 200 | /dashboard/traceability |

### Sample Data in Database

| Table | Records | Details |
|-------|---------|---------|
| Roles | 5 | Admin, QC, Warehouse, Production, Manager |
| Users | 5 | sigma (skibidi), admin, qc001, wh001, prod001 |
| Suppliers | 3 | PT Aroma Nusantara, CV Bahan Kimia Jaya, PT Essential Oil Indo |
| Raw Materials | 5 | Orange Oil, Coffee Extract, Vanilla, Ethanol, Citric Acid |
| Products | 3 | Orange Extract, Coffee Flavour, Vanilla Flavour |
| Raw Material Lots | 3 | LOT-RM-001 (APPROVED), LOT-RM-002 (APPROVED), LOT-RM-003 (REJECTED) |
| QC Logs | 3 | 2 PASS, 1 FAIL |
| Production Orders | 2 | PO-2026-001, PO-2026-002 (PLANNED) |
| Inventory Transactions | 2 | IN movements |
| Warehouses | 1 | Gudang Utama |
| Storage Locations | 3 | Rak A1, Rak B1, Cold Storage |

---

*Last updated: 2026-05-27 (Full stack integration complete — frontend connected to backend with real data)*
