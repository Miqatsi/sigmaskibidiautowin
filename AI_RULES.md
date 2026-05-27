# AI Rules — Sima Arome (Enterprise-Ready AI Manufacturing App)

## Tech Stack

- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Backend:** Node.js (Express)
- **Language:** TypeScript (strict mode)

## Security (Enterprise-Ready)

- JANGAN PERNAH hardcode API keys, secrets, atau credentials di dalam kode.
- Selalu gunakan `process.env.VARIABLE_NAME` untuk mengakses konfigurasi sensitif.
- Simpan semua secrets di file `.env` yang sudah di-ignore oleh Git.
- Validasi semua input dari user di sisi backend sebelum diproses.

## TypeScript Interfaces

Selalu definisikan TypeScript interfaces untuk setiap model database:

```typescript
interface Lot {
  id: string;
  // ... field lainnya
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}

interface User {
  id: string;
  // ... field lainnya
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}

interface QCLog {
  id: string;
  // ... field lainnya
  created_at: Date;
  updated_at: Date;
  updated_by: string;
}
```

## Audit Trails

Setiap operasi database WAJIB mengimplementasikan audit trail:

- `created_at` — timestamp saat record dibuat
- `updated_at` — timestamp saat record terakhir diubah
- `updated_by` — user ID yang melakukan perubahan

Tidak boleh ada operasi CREATE atau UPDATE tanpa mengisi field audit trail.

## UI/UX Design

- Gunakan **high-contrast colors** agar mudah dibaca di lingkungan pabrik.
- Font size minimal `text-base` (16px), gunakan `text-lg` atau `text-xl` untuk elemen penting.
- Tombol harus besar dan mudah di-tap (`min-h-12`, `px-6`).
- Gunakan Tailwind CSS utility classes secara konsisten.
- Desain harus responsif dan mobile-friendly untuk operator yang menggunakan tablet.

## Code Quality

- **Modular:** Maksimal 50 baris per fungsi. Jika lebih, pecah menjadi fungsi-fungsi kecil.
- **Error Handling:** Selalu gunakan `try-catch` di setiap endpoint backend API.
- **Error Messages:** Berikan pesan error yang jelas dan informatif ke client.

```typescript
// Contoh pattern backend API
export async function handler(req: Request, res: Response) {
  try {
    // logic here (max 50 lines)
    const result = await someOperation();
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('[EndpointName] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
    });
  }
}
```

## Konvensi Umum

- Gunakan `camelCase` untuk variabel dan fungsi.
- Gunakan `PascalCase` untuk interfaces, types, dan komponen React.
- Gunakan `UPPER_SNAKE_CASE` untuk environment variables.
- Setiap file harus memiliki satu tanggung jawab utama (Single Responsibility).
- Tambahkan komentar untuk logic yang kompleks.

---

## AI Workflow Protocol (Hackathon Mode)

Setiap AI assistant yang bekerja di project ini WAJIB mengikuti protocol berikut:

### PHASE 0 — PROJECT MEMORY (MANDATORY)

1. Baca `AI_LOG.md` **sepenuhnya** sebelum merespons.
2. Treat `AI_LOG.md` sebagai source of truth untuk:
   - Arsitektur yang sudah ada
   - Keputusan yang sudah dibuat
   - Constraints & limitations
   - APIs yang digunakan
   - Tech stack
   - Fitur yang sudah diimplementasi
   - Bugs & known issues
   - Prioritas tim
   - Deadlines
3. Jika `AI_LOG.md` konflik dengan instruksi baru:
   - Highlight konfliknya
   - Tanya mana yang harus di-override
4. Setelah menyelesaikan task:
   - Suggest entry untuk di-append ke `AI_LOG.md`
   - Include: tanggal, perubahan, reasoning, files affected, next steps

### PHASE 1 — UNDERSTAND THE TASK

Sebelum coding:
- Restate the goal
- Identify assumptions
- Identify risks
- List edge cases
- Ask clarifying questions jika ambigu

### PHASE 2 — THINK LIKE A HACKATHON TEAM

Optimize for (urutan prioritas):
1. Demo impact
2. Fast implementation
3. Reliability
4. Enterprise readiness
5. Scalability
6. Clean UX
7. Judge appeal
8. Maintainability

Prefer:
- Existing services/APIs over reinventing
- MVP-first implementations
- Production-capable architecture
- Features with visible value

Reject:
- Overengineering
- Premature optimization
- Unnecessary complexity

### PHASE 3 — PLAN BEFORE BUILDING

Provide:
- A. Recommended approach
- B. Alternative approaches
- C. Tradeoffs
- D. Estimated implementation difficulty
- E. Risks
- F. Fastest MVP path

### PHASE 4 — CODE

Requirements:
- Production-style code
- Modular architecture (schema → service → controller → routes)
- Error handling (try-catch di setiap endpoint)
- Security considerations (Zod validation, RBAC, audit)
- Environment variable usage (JANGAN hardcode)
- Minimal technical debt
- Reusable components
- Clear folder structure

### PHASE 5 — OUTPUT FORMAT

Selalu respond dengan:
1. Goal summary
2. Existing context dari AI_LOG.md
3. Recommended solution
4. Tradeoffs
5. Implementation steps
6. Code
7. Complexity/performance notes
8. Deployment considerations
9. Demo strategy (how to impress judges)
10. AI_LOG.md update suggestion

### PHASE 6 — SELF REVIEW

Sebelum finalize, check:
- Does this maximize hackathon scoring?
- Is there a faster approach?
- Is it demo-friendly?
- Would judges understand value in <60 seconds?
- Is it enterprise-ready?
- Are security and scalability addressed?

**RULE: Never code immediately. Think → compare → optimize → implement → review → update AI_LOG.md.**


---

## AI Master Checklist (Day 1–6)

> **Purpose:** Track progress automatically. Before coding, AI must read `AI_LOG.md` and reference this checklist.
> After completing work, update `AI_LOG.md` with status changes.
>
> Legend: ✅ Finished | 🟡 Partial | ❌ Not Started | ⚠️ Needs Improvement | 🚫 Blocked

---

### DAY 1 — Scope, Architecture & Setup

**Scope & Planning**
- ✅ Define MVP scope (AI PPIC Scheduling, Digital QC, Lot Tracking)
- ✅ Define user roles: Admin, QC, Operator/Production, Warehouse, Manager
- ❌ Create PRD document

**Architecture**
- ✅ Design ERD: Products, Lots, QC Logs, Users, Audit Logs, Suppliers, Production, Inventory
- ✅ Add audit fields: created_at, updated_at, updated_by, deleted_at, version
- ❌ Design system architecture diagram

**Setup**
- ✅ Initialize Git repository
- ✅ Setup frontend (Next.js)
- ✅ Setup backend (Express + TypeScript + Prisma 7)
- ❌ Configure CI/CD
- ✅ Setup env variables (.env with DATABASE_URL, JWT_SECRET, PORT)
- ✅ Prevent hardcoded secrets (.gitignore, env pattern)

**Deliverables:** ERD ✅ | Working Repo ✅ | PRD ❌ | Architecture Diagram ❌

**Enterprise Checks:**
- ✅ Audit support
- ✅ Secure configuration
- ✅ Scalability considered (indexes, pagination, connection pooling)

---

### DAY 2 — RBAC, APIs & Audit

**Authentication**
- ✅ JWT Auth
- ✅ Login (username or email)
- ✅ Password hashing (bcrypt, 10 rounds)
- ❌ Refresh tokens

**RBAC**
- ✅ Admin permissions
- ✅ QC permissions
- ✅ Operator/Production permissions
- ✅ Warehouse permissions
- ✅ Manager permissions
- 🟡 Granular access control (role-based, not permission-based yet)

**APIs**
- ❌ Products CRUD (schema exists, no routes yet)
- ✅ Suppliers CRUD
- ✅ Materials CRUD
- ✅ Lots CRUD + status machine
- ✅ QC CRUD (auto-updates lot status)
- ✅ Production Orders + Batches
- ✅ Inventory Ledger

**Validation**
- ✅ Input validation (Zod on all endpoints)
- ✅ Sanitization (Express JSON parser limits)
- ✅ Injection prevention (Prisma parameterized queries)

**Audit Trail**
- ✅ Global audit middleware (strict/best-effort policy)

**Audit log fields:**
- ✅ action (CREATE, UPDATE, DELETE)
- ✅ user_id
- 🟡 role (stored via user relation, not denormalized)
- ✅ table (tableName)
- ✅ record_id
- ✅ old_value (JSON)
- ✅ new_value (JSON)
- ✅ timestamp (createdAt)
- ✅ ip_address
- ✅ user_agent

**Deliverables:** Working Auth ✅ | CRUD APIs ✅ | Swagger ❌ | Audit logs ✅

**Enterprise Checks:**
- ✅ Immutable logs (append-only, no update/delete on audit_logs)
- ✅ Secure auth (JWT + bcrypt + rate limiting)

---

### DAY 3 — Frontend & AI Integration

**Frontend**
- ✅ Dashboard layout
- ✅ Navigation
- ❌ Role-based views

**AI**
- ❌ AI endpoint
- ❌ QC AI parsing
- ❌ PPIC optimization

**Reliability**
- ✅ Timeout handling (rate limiting)
- ✅ Error fallback (try-catch on all endpoints)
- ✅ Logging (Pino structured logging)

**Integration**
- ✅ Connect frontend → backend
- ✅ Lot tracking UI
- ✅ QC forms
- ✅ Tables

**Deliverables:** Dashboard ✅ | AI endpoint ❌ | Functional frontend ✅

**Enterprise Checks:**
- ✅ Error handling (all endpoints)
- ✅ Loading states
- ❌ Accessibility

---

### DAY 4 — Dashboards & Workflow

**Manufacturing Workflow**
- ✅ Raw Material (receive lots)
- ✅ QC (inspect + approve/reject)
- ✅ Production (orders + batches + consume lots)
- 🟡 Dispatch (schema exists, no dedicated module yet)

**Interfaces**
- ❌ QC approval page
- ❌ PPIC scheduling board

**Tracking**
- ✅ Lot traceability (forward + backward)
- ❌ Cold chain visualization
- ❌ IoT mock data
- ❌ Dispatch workflow UI

**Performance**
- ✅ Pagination (all list endpoints)
- ✅ Efficient queries (indexes on all FK + status + date fields)

**Testing**
- ✅ End-to-end testing (full chain verified via script)

**Deliverables:** Full MVP workflow (backend) ✅

**Enterprise Checks:**
- ✅ No dead ends (all status transitions validated)
- ✅ Stable data flow (atomic operations, strict audit on critical ops)

---

### DAY 5 — Polish & Deployment

**UI/UX**
- ❌ Improve contrast
- ❌ Improve usability
- ❌ Improve responsiveness

**Deployment**
- ❌ Deploy frontend
- ❌ Deploy backend
- ❌ Setup production DB
- ✅ Populate mock data (seed script)

**Production Readiness**
- ❌ HTTPS
- ✅ Environment variables
- ❌ Production build
- ✅ No exposed secrets

**Documentation**
- ✅ README (basic)
- ❌ Setup guide
- ❌ Architecture docs
- ❌ Security docs

**Deliverables:** Live demo ❌ | Production deployment ❌ | Docs ❌

---

### DAY 6 — Pitch & Submission

**Presentation**
- ❌ Pitch deck

**Demo**
- ❌ Screen recording
- ❌ Demo footage

**Video**
- ❌ Voiceover
- ❌ Annotation
- ❌ Final edit

**Submission Review**
- ❌ Check judging criteria
- ❌ Verify links
- ❌ Verify repo
- ❌ Verify deployment

---

### AI Self-Review Protocol (MANDATORY)

Every session, update `AI_LOG.md` with:

```
Date:
Task:
Files Changed:
Completed:
Remaining:
Risks:
Technical Debt:
Bugs:
Security Concerns:
Next Priority:
```

---

### Priority Order (Always Follow This)

1. Blocking issues
2. Security
3. Audit trail
4. Authentication
5. Core workflow (Lot → QC → Production → Inventory → Traceability)
6. AI features
7. UI polish
8. Deployment
9. Pitch

**RULE: Never skip unfinished blockers. Never jump to lower priority if higher priority is incomplete.**
