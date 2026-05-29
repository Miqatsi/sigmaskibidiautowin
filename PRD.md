# Product Requirements Document (PRD)

## Sima Arome — Integrated Manufacturing Operations Platform

**Version:** 1.0  
**Date:** 2026-05-29  
**Hackathon:** CyberHack 2026 (Powered by Hackpad)  
**Team:** sigmaskibidiautowin  

---

## 1. Executive Summary

Sima Arome is an Indonesian natural extracts manufacturer serving F&B, cosmetics, and wellness brands. Their end-to-end production chain — from raw material intake through QC, PPIC scheduling, production, warehousing, to dispatch — currently relies on fragmented manual systems: notebooks, spreadsheets, chat messages, and trained human eyes.

This platform is a unified, AI-enhanced manufacturing operations system that eliminates double data entry, automates quality control, provides full lot traceability, and delivers intelligent warehouse management — all in one enterprise-ready application.

---

## 2. Problem Statement

### Core Challenge

> **How can AI and technology innovate Sima Arome's manufacturing process?**

### Key Pain Points

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Fragmented systems** | Operators re-enter the same data into multiple tools — slow, error-prone, blame-prone |
| 2 | **Manual QC bottleneck** | Colour and powder quality checks rely on trained eyes; throughput stalls when staff aren't available |
| 3 | **Storage by spreadsheet** | Drum placement, hazard segregation, and cold-chain (–4°C to –20°C) tracked in files, not systems |
| 4 | **Production opacity** | PPIC schedules, lot histories, and sample dispatches live across notebooks and chats |

### Business Impact of Problems

- **Rework & missed batches** from data entry errors
- **QC throughput stalls** when trained staff are unavailable
- **Product degradation** from misplaced cold-chain items
- **Zero traceability** when contamination or recall events occur
- **No audit trail** for compliance and customer audits

---

## 3. Solution Overview

### Product Vision

A single source of truth for Sima Arome's entire manufacturing chain — from supplier intake to customer dispatch — enhanced with AI for quality control and intelligent warehousing.

### Focus Areas Addressed

| # | Focus Area | Our Approach |
|---|-----------|--------------|
| 01 | **Integrated Operations System** | ✅ Full implementation — unified platform connecting supplier intake, warehouse, QC, PPIC, lot tracking, production, inventory, and dispatch |
| 02 | **AI for Fruit & Raw-Material QC** | ✅ Computer vision endpoint for grading incoming materials (ripeness, colour, defects) |
| 03 | **AI for Extract & Powder QC** | ✅ Visual analysis for powder colour consistency and contamination detection |
| 04 | **AI-Assisted Warehousing & Cold-Chain** | 🟡 Smart storage location suggestions, cold-chain monitoring dashboard |

---

## 4. Target Users & Roles

| Role | Responsibilities | Key Screens |
|------|-----------------|-------------|
| **Admin** | System configuration, user management, full access | All modules, user management |
| **QC Inspector** | Inspect incoming materials, approve/reject lots, run AI QC | QC module, lot status updates |
| **Warehouse Staff** | Receive materials, manage storage, track inventory | Lots, inventory, warehouse floor plan |
| **Production Operator** | Execute production orders, consume lots, record batches | Production module, lot consumption |
| **Manager / PPIC** | Schedule production, view dashboards, trace lots | Dashboard, production planning, traceability |

---

## 5. Functional Requirements

### 5.1 Authentication & Access Control

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AUTH-01 | JWT-based authentication (username or email + password) | P0 | ✅ Done |
| AUTH-02 | Role-based access control (5 roles) | P0 | ✅ Done |
| AUTH-03 | Session expiry (8h configurable) | P1 | ✅ Done |
| AUTH-04 | Password hashing (bcrypt, 10 rounds) | P0 | ✅ Done |
| AUTH-05 | Rate limiting on login (20/15min) | P1 | ✅ Done |

### 5.2 Supplier Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SUP-01 | CRUD operations for suppliers | P0 | ✅ Done |
| SUP-02 | Supplier code (unique identifier) | P0 | ✅ Done |
| SUP-03 | Contact information tracking | P1 | ✅ Done |
| SUP-04 | Soft-delete (preserve history) | P1 | ✅ Done |

### 5.3 Raw Material Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| MAT-01 | Material catalog (name, code, unit) | P0 | ✅ Done |
| MAT-02 | CRUD with pagination | P0 | ✅ Done |
| MAT-03 | Link to lots and suppliers | P0 | ✅ Done |

### 5.4 Lot Tracking (THE BACKBONE)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| LOT-01 | Receive new lots with lot number, material, supplier, quantity | P0 | ✅ Done |
| LOT-02 | Status state machine: PENDING_QC → APPROVED/REJECTED → CONSUMED | P0 | ✅ Done |
| LOT-03 | Natural key lookup by lot number | P0 | ✅ Done |
| LOT-04 | Filter by status, supplier, material | P1 | ✅ Done |
| LOT-05 | Expiry date tracking | P1 | ✅ Done |
| LOT-06 | Invalid status transitions blocked with clear error | P0 | ✅ Done |
| LOT-07 | Only QC/Admin can approve/reject | P0 | ✅ Done |

### 5.5 Quality Control

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| QC-01 | Create QC inspection (INCOMING, IN_PROCESS, FINAL) | P0 | ✅ Done |
| QC-02 | Results: PASS, FAIL, CONDITIONAL | P0 | ✅ Done |
| QC-03 | Auto-update lot status on QC result | P0 | ✅ Done |
| QC-04 | Link to raw material lot or production batch | P0 | ✅ Done |
| QC-05 | AI-powered visual QC (colour, defects, contamination) | P0 | 🟡 In Progress |
| QC-06 | Sample dispatch tracking (lab name, sent/returned dates) | P2 | ✅ Schema ready |

### 5.6 Production Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PROD-01 | Create production orders (product, quantity, planned date) | P0 | ✅ Done |
| PROD-02 | Order status: PLANNED → IN_PROGRESS → COMPLETED/CANCELLED | P0 | ✅ Done |
| PROD-03 | Create production batches (consume APPROVED lots) | P0 | ✅ Done |
| PROD-04 | Batch status: IN_PROGRESS → COMPLETED/FAILED | P0 | ✅ Done |
| PROD-05 | Lot consumption validation (only APPROVED lots) | P0 | ✅ Done |
| PROD-06 | Auto-complete order when all batches done | P1 | ✅ Done |
| PROD-07 | PPIC scheduling board (AI-assisted) | P1 | ❌ Not started |

### 5.7 Inventory & Warehousing

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| INV-01 | Inventory ledger (IN, OUT, TRANSFER, ADJUSTMENT) | P0 | ✅ Done |
| INV-02 | Storage location tracking | P0 | ✅ Done |
| INV-03 | Balance reconstruction from ledger | P0 | ✅ Done |
| INV-04 | Append-only design (immutable transactions) | P0 | ✅ Done |
| INV-05 | Warehouse floor plan visualization | P1 | ❌ Not started |
| INV-06 | Cold-chain monitoring (–4°C to –20°C) | P1 | ❌ Not started |
| INV-07 | Smart slotting suggestions (AI) | P2 | ❌ Not started |

### 5.8 Traceability (KILLER FEATURE)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| TRACE-01 | Forward trace: Raw Material → QC → Production → Inventory | P0 | ✅ Done |
| TRACE-02 | Backward trace: Finished Good → Raw Materials → Suppliers | P0 | ✅ Done |
| TRACE-03 | Cross-lot linking (all materials in a batch) | P0 | ✅ Done |
| TRACE-04 | Search by lot number | P0 | ✅ Done |
| TRACE-05 | Visual trace timeline | P1 | 🟡 Basic UI done |

### 5.9 Audit Trail

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AUDIT-01 | Log all CREATE, UPDATE, DELETE operations | P0 | ✅ Done |
| AUDIT-02 | Store: who, what, when, old value, new value, IP, user agent | P0 | ✅ Done |
| AUDIT-03 | Strict policy for critical ops (fails if audit fails) | P0 | ✅ Done |
| AUDIT-04 | Best-effort policy for non-critical ops | P1 | ✅ Done |
| AUDIT-05 | Immutable logs (append-only, no update/delete) | P0 | ✅ Done |

### 5.10 AI Features

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AI-01 | AI QC endpoint (image → quality assessment) | P0 | ❌ Not started |
| AI-02 | Fruit/raw material grading (ripeness, colour, defects) | P1 | ❌ Not started |
| AI-03 | Extract powder analysis (colour consistency, contamination) | P1 | ❌ Not started |
| AI-04 | PPIC scheduling optimization | P2 | ❌ Not started |

---

## 6. Non-Functional Requirements

### 6.1 Enterprise Readiness (30% of judging)

| Requirement | Status |
|-------------|--------|
| Audit trails on all operations | ✅ |
| RBAC with 5 roles | ✅ |
| Input validation (Zod) | ✅ |
| SQL injection prevention (Prisma parameterized) | ✅ |
| Rate limiting | ✅ |
| Security headers (Helmet) | ✅ |
| Soft-delete (preserve history) | ✅ |
| Optimistic locking (version field) | ✅ |
| Structured logging (Pino) | ✅ |
| Environment-based configuration | ✅ |
| No hardcoded secrets | ✅ |
| Pagination on all list endpoints | ✅ |
| Database indexes on FK + status + date fields | ✅ |

### 6.2 Performance

- All list endpoints paginated (default 20, max 100)
- Database indexes on all foreign keys, status fields, and date fields
- Connection pooling via Prisma adapter-pg

### 6.3 Security

- JWT tokens with configurable expiry
- bcrypt password hashing (10 rounds)
- CORS restricted to frontend origin
- Rate limiting (200 general, 20 auth per 15min)
- Request body size limit (10MB)
- No secrets in code or git history

### 6.4 UI/UX (20% of judging)

- High-contrast colors for factory environment readability
- Minimum font size: 16px (text-base)
- Large tap targets: min-h-12, px-6 for buttons
- Responsive design for tablet use on factory floor
- Loading states on all data fetches
- Clear error messages in Bahasa Indonesia

---

## 7. Technical Architecture

### 7.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + Tailwind CSS 4 + TypeScript |
| Backend | Node.js + Express 5 + TypeScript (strict) |
| Database | PostgreSQL 18 + Prisma 7 (driver adapter) |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Logging | Pino |
| AI (planned) | AWS Bedrock / OpenAI Vision API |

### 7.2 System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Next.js App   │────▶│  Express API    │────▶│  PostgreSQL  │
│   (Port 3001)   │     │  (Port 3000)    │     │  (Port 5432) │
│                 │     │                 │     │              │
│  - Dashboard    │     │  - Auth/RBAC    │     │  - 16 tables │
│  - Lot Tracking │     │  - Audit Trail  │     │  - Indexes   │
│  - QC Module    │     │  - Zod Valid.   │     │  - Audit Log │
│  - Production   │     │  - Rate Limit   │     │              │
│  - Inventory    │     │  - Modules:     │     └──────────────┘
│  - Traceability │     │    lot, qc,     │
│  - Suppliers    │     │    production,  │            ┌──────────┐
│  - Materials    │     │    inventory,   │───────────▶│  AI API  │
└─────────────────┘     │    traceability │            │(Planned) │
                        └─────────────────┘            └──────────┘
```

### 7.3 Database Schema (16 tables)

```
AUTH:           Role, Permission, RolePermission, User
SUPPLY CHAIN:  Supplier, RawMaterial, RawMaterialLot
PRODUCTION:    Product, ProductionOrder, ProductionBatch, ProductionBatchRawMaterial
WAREHOUSE:     Warehouse, StorageLocation, InventoryTransaction
QC:            QCLog, SampleDispatch
AUDIT:         AuditLog
```

### 7.4 Module Architecture Pattern

```
schema.ts → service.ts → controller.ts → routes.ts
(Zod)       (Business)    (HTTP layer)    (Express Router)
```

---

## 8. User Flows

### 8.1 Core Manufacturing Flow

```
Supplier delivers raw material
        │
        ▼
┌─────────────────┐
│ Receive Lot     │  Warehouse staff creates lot (PENDING_QC)
│ (Warehouse)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ QC Inspection   │  QC inspector checks quality → PASS/FAIL
│ (QC Staff)      │  Auto-updates lot: APPROVED or REJECTED
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Production      │  PPIC creates order, operator creates batch
│ (Operator)      │  Consumes APPROVED lots → CONSUMED
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Inventory       │  Finished goods recorded IN to storage
│ (Warehouse)     │  Location tracked, cold-chain monitored
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Dispatch        │  Sample or bulk dispatch to customers
│ (Warehouse)     │
└─────────────────┘
```

### 8.2 Traceability Flow (Recall Scenario)

```
Customer reports issue with batch FG-001
        │
        ▼
Search "FG-001" in Traceability
        │
        ▼
Backward trace reveals:
  - Raw materials: LOT-RM-001 (Citric Acid from PT Essential Oil Indo)
  - QC: PASS on 2026-05-27 (Inspector: sigma)
  - Production: Batch completed 2026-05-27
        │
        ▼
Forward trace on LOT-RM-001:
  - Also used in FG-002, FG-003
  - All affected batches identified in seconds
        │
        ▼
Targeted recall — not blanket recall
  → Saves money, preserves trust
```

---

## 9. Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Data entry reduction | 70% fewer manual entries | Single-input flows vs current 3x entry |
| QC throughput | 3x faster with AI assist | Time from lot receipt to approval |
| Traceability speed | < 5 seconds for full trace | API response time for /traceability |
| Recall precision | 100% lot-level accuracy | Forward/backward trace completeness |
| System uptime | 99.5% | Health endpoint monitoring |

---

## 10. Judging Criteria Alignment

| Criteria | Weight | Our Strengths |
|----------|--------|---------------|
| **Enterprise Readiness** | 30% | Audit trails, RBAC, Zod validation, rate limiting, Helmet, soft-delete, optimistic locking, structured logging, env-based config |
| **Problem-Solution Fit** | 20% | Directly addresses all 4 key challenges; full manufacturing chain digitized |
| **Innovation & Creativity** | 20% | AI QC (computer vision), full lot traceability, demo/offline mode |
| **User Experience & Design** | 20% | Factory-friendly UI (high contrast, large buttons), role-based views, Bahasa Indonesia error messages |
| **Pitch & Presentation** | 10% | Live demo with real data flow, traceability recall scenario |

---

## 11. Submission Deliverables

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 01 | GitHub Repository | ✅ | Public, with README and setup instructions |
| 02 | Demo Video (max 3 min) | ❌ | Show prototype running — not slides |
| 03 | Pitch Deck (PDF) | ❌ | Follow 10-slide outline |
| 04 | Live Demo Link | ❌ | Deploy via BuildPad/Vercel |

### Deadline: 23:59 WIB, 31 May 2026

---

## 12. Roadmap

### Phase 1 — MVP (Days 1-3) ✅ COMPLETE
- Database schema + migrations
- Auth + RBAC
- All CRUD modules (suppliers, materials, lots, QC, production, inventory)
- Traceability API
- Frontend dashboard with all pages connected

### Phase 2 — AI Integration (Days 4-5) 🟡 IN PROGRESS
- AI QC endpoint (image upload → quality assessment)
- Computer vision for fruit/raw material grading
- Extract powder colour analysis
- PPIC scheduling suggestions

### Phase 3 — Polish & Deploy (Days 5-6)
- UI polish (contrast, responsiveness, accessibility)
- Deploy to BuildPad/Vercel
- Demo video recording
- Pitch deck creation

### Future (Post-Hackathon)
- IoT sensor integration for cold-chain
- Warehouse floor plan visualization
- Mobile app for factory floor operators
- Multi-tenant SaaS architecture
- Advanced analytics dashboard

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| AI API latency | QC bottleneck | Async processing, fallback to manual |
| Database downtime | All operations blocked | Connection pooling, health checks |
| Demo day Wi-Fi issues | Can't show live demo | Pre-recorded demo video as backup |
| Scope creep | Miss deadline | Strict MVP-first, AI features are additive |

---

*Document maintained by: Team sigmaskibidiautowin*  
*Last updated: 2026-05-29*
