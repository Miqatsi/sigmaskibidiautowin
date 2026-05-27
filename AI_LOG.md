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
