# Magnolia Sales App — C.A Outlet & Working Schedule Module

**Spec & Assumptions Document** · Prototype for technical assessment · Author: Hoàng Phúc

*(Tiếng Việt: [`Spec.vi.md`](./Spec.vi.md))*

---

## 1. Overview

A prototype module for Magnolia's internal sales management app. The sales team acquires new outlets (C.A Outlets — cafes, bars, restaurants, hotels, bakeries) and moves them through a sales funnel. Progress through the funnel is driven by **field visits ("đi tuyến")**, and every stage transition must be backed by **evidence** collected during a visit.

**Core flow:**

```
Create/edit outlet → optionally schedule a visit → outlet saved →
visit auto-created in Working Schedule (deduplicated) →
sales completes visit, records result + evidence →
stage transition (only if evidence exists) → stage history logged
```

**Business insight this module encodes:** stage progression cannot be self-reported. A sales rep can only advance an outlet's stage through a completed visit with at least one piece of evidence. This gives sales managers a verifiable audit trail (StageHistory → Visit → Evidence).

---

## 2. Domain Concepts

| Concept | Definition |
|---|---|
| **C.A Outlet** | A prospective customer outlet, not yet a stable account. Owned by one sales rep. |
| **Stage** | Funnel position: `Raw Lead → SQL → Customer Sampling → Proposal Sent → Won / Lost` |
| **Visit (đi tuyến)** | A scheduled in-person meeting with an outlet. One row in the Working Schedule. |
| **Target Stage** | The stage the rep *hopes* the outlet reaches after the visit. An expectation, not a constraint. |
| **Evidence** | Proof of work: photo, file, or confirmation note attached to a visit. Required to change stage. |
| **MISA sync** | External system sync for schedule rows. Mocked in this prototype: `Queued / Synced / Failed`. |

---

## 3. Assumptions

The requirements intentionally leave gaps. These are the decisions I made, with rationale. Each is a question I would normally ask the business owner first.

### A1. Duplicate schedule handling depends on visit status
> Requirement: "same rep + same outlet + same date → don't duplicate, update the existing row."

**Assumption:** the upsert rule applies only to visits with status `planned`. If a matching visit is already `completed`, a new visit is created instead — a completed visit is a historical record of a real meeting and must not be overwritten.

- Match key: `(salesRep, outletId, visitDate)` — date only, not time.
- On match with a `planned` visit → update target stage, objective, notes; reset MISA sync to `Queued` (the external system needs the changed row again).
- On match with a `completed` visit → create a new visit (it's a different, second meeting).

### A2. Stage transitions are free-form but fully logged
The requirements define no transition rules (e.g., "can't skip stages").

**Assumption:** any stage → any stage is allowed, including backward moves and `Lost` from anywhere. Real sales is messy — a customer can ask for a proposal while still sampling, or a Won account can churn. Instead of restricting transitions, every change is logged in `StageHistory` with the triggering visit, so managers get auditability without the tool fighting reality.

### A3. Actual new stage may differ from target stage
Target stage is captured at scheduling time as an *expectation*. When completing a visit, the rep chooses the actual new stage freely (defaulted to the target stage in the UI). The visit outcome, not the plan, decides.

### A4. Editing an outlet and unchecking "schedule a visit"
- **All** of the outlet's still-`planned` visits are deleted, together with their attached evidence (the plan was cancelled). The form warns before saving, listing the dates affected.
- `completed` visits are kept (history is immutable).

### A5. Visit date validation
Dates in the past are allowed **with a warning**, not blocked — reps sometimes log a visit after the fact. Blocking would push them to enter fake future dates.

### A6. Outlets in terminal stages can still be visited
`Won` outlets need ongoing care; `Lost` outlets can be revived. Scheduling remains allowed for all stages. (A stricter rule would be trivial to add later.)

### A7. Stage snapshot at scheduling time
The visit stores `currentStageSnapshot` — the outlet's stage **when the visit was scheduled**. The outlet's live stage may change before the visit happens; the snapshot preserves what the plan looked like at planning time.

### A8. Evidence lives on the Visit, transitions reference the Visit
Evidence is attached to a visit (it documents the meeting). A stage transition requires ≥1 evidence on the visit that triggers it, and `StageHistory` stores the `visitId` — so every transition is traceable to its proof without duplicating evidence records.

### A9. Single-user prototype
No auth. "Sales rep" is a select field from a seeded list. Multi-user concerns (permissions, ownership enforcement) are out of scope.

### A10. Persistence
In-memory store with localStorage persistence behind a service layer that mimics an async API. Rationale in §7.

### A11. Initial stage is chosen freely at creation
The evidence gate (BR3) governs stage *transitions*, not the *entry point*: when creating an outlet the rep picks the starting stage freely (an outlet being onboarded may already be mid-funnel from work done before the tool existed). From then on the stage is read-only on the edit form — it can only move through a completed visit with evidence. Whether creation should be restricted to early stages (or logged as a seed `StageHistory` row) is a question for the business owner.

---

## 4. Data Model

```
Outlet
  id            string (uuid)
  name          string        required
  address       string        required
  channel       enum          Cafe | Restaurant | Hotel | Bar | Bakery
  tier          enum          A | B | C
  salesRep      string        required (from seeded rep list)
  currentStage  enum          RawLead | SQL | CustomerSampling | ProposalSent | Won | Lost
  notes         string        optional (next step / notes)
  createdAt, updatedAt

Visit                          -- one row = one line in Working Schedule
  id                    string (uuid)
  outletId              fk → Outlet
  salesRep              string
  visitDate             date (day precision — used in dedup key)
  currentStageSnapshot  enum   outlet stage at scheduling time (A7)
  targetStage           enum   expected stage after visit
  objective             string visit goal / next step
  status                enum   planned | completed
  result                string outcome summary (set on completion)
  resultNotes           string optional
  misaSyncStatus        enum   Queued | Synced | Failed
  createdAt, updatedAt

  LOGICAL UNIQUE: (salesRep, outletId, visitDate) WHERE status = 'planned'   (A1)

Evidence
  id          string (uuid)
  visitId     fk → Visit
  type        enum    photo | file | note
  name        string  filename or note text (mock — no real upload)
  uploadedAt  datetime

StageHistory
  id          string (uuid)
  outletId    fk → Outlet
  visitId     fk → Visit      -- the visit that justified this transition
  fromStage   enum
  toStage     enum
  changedBy   string (sales rep)
  changedAt   datetime
```

---

## 5. Business Rules

**BR1 — Auto-create schedule.** Saving an outlet with "schedule a visit" checked creates a Visit via the upsert rule (A1) and enqueues it for MISA sync (`Queued`).

**BR2 — Dedup/upsert.** See A1. Implemented in the service layer, not the UI, so any future entry point (import, API) inherits it.

**BR3 — Evidence gate.** A stage change on visit completion is rejected unless the visit has ≥1 evidence. Enforced in the service layer; the UI additionally disables the stage-change controls and explains why.

**BR4 — Stage history.** Every accepted transition appends one immutable StageHistory record and updates `Outlet.currentStage` atomically (same service call).

**BR5 — Completing without transition is fine.** A rep can record result + notes + evidence and keep the current stage. Evidence is only *required* when changing stage.

**BR6 — MISA sync isolation.** Business logic calls `syncService.enqueue(visitId)` only. See §6.

---

## 6. Architecture — MISA Mock Isolation

Ports & adapters. Business logic depends on an interface, never on MISA specifics:

```
// port (what the domain needs)
interface SyncService {
  enqueue(visitId: string): void
  retry(visitId: string): void
  getStatus(visitId: string): 'Queued' | 'Synced' | 'Failed'
}

// adapter (mock implementation)
MockMisaAdapter implements SyncService
  - enqueue: set Queued, then after 1.5s resolve to Synced (80%) or Failed (20%)
  - retry: re-run the same transition from Failed
```

Swapping in the real MISA API later means writing one new adapter. Zero changes to outlet/visit/stage logic. The UI shows the sync badge per schedule row and a Retry button on `Failed`.

---

## 7. Stack & Scope Decision

**React + Vite + TypeScript. No backend server.**

The assessment evaluates business-flow understanding, data modeling, validation, dedup, and separation of concerns — none of which require HTTP infrastructure in a prototype. Instead:

- All logic lives in a **service layer** (`outletService`, `visitService`, `stageService`, `syncService`) with async signatures, as if calling a REST API.
- Components never touch the store directly — they only call services.
- Persistence: in-memory + localStorage snapshot, isolated behind a `repository` module.

Consequence: replacing the repository with `fetch()` calls to a real Express/Mongo backend is a mechanical change. This was a deliberate scope decision to spend the time budget on business logic quality rather than boilerplate.

---

## 8. Screens

1. **Outlet list** — table of outlets (name, channel, tier, rep, stage badge), + "New outlet".
2. **Outlet form (create/edit)** — all fields from §4; "Schedule a visit?" checkbox conditionally reveals visit date, target stage, visit objective. Inline validation errors on save.
3. **Working Schedule** — table: date, rep, outlet, address, current stage (snapshot), target stage, objective, MISA sync badge, status. Row click → visit detail.
4. **Visit detail** — record result + notes, add mock evidence (type + name), toggle "change stage", pick new stage (default = target). Save enforces the evidence gate. Shows outlet's stage history at the bottom.

**Validation summary:**
- Outlet: name, address, channel, tier, salesRep, stage → required.
- If "schedule a visit": visitDate, targetStage → required; past date → warning (A5); targetStage should differ from current stage → warning, not error.
- Visit completion with stage change: ≥1 evidence → hard error (BR3).

---

## 9. Seed Data

Sales reps: `Phúc`, `Linh`, `Minh`.

| Outlet | Channel | Tier | Rep | Stage |
|---|---|---|---|---|
| Blue Lotus Cafe | Cafe | B | Phúc | SQL |
| Hoa Nắng Bakery | Bakery | C | Linh | Raw Lead |
| Maison Saigon Bistro | Restaurant | A | Minh | Customer Sampling |

Plus one pre-seeded planned visit and one completed visit with evidence, so the schedule screen and history are demonstrable immediately.

---

## 10. Test Plan (manual demo path + unit tests)

**Unit tests (service layer, Vitest):**
1. Upsert: same (rep, outlet, date) with planned visit → updates, count unchanged, sync reset to Queued.
2. Upsert: same key but visit completed → creates a second visit.
3. Evidence gate: stage change with 0 evidence → rejected; with 1 evidence → accepted, StageHistory row appended, outlet stage updated.
4. Completing a visit without stage change and without evidence → allowed.
5. Unchecking "schedule a visit": planned visit deleted; completed visit preserved.

**Manual demo script:**
1. Create outlet with visit → row appears in schedule, sync goes Queued → Synced/Failed.
2. Re-save same outlet, same date → row updated, no duplicate.
3. Open visit → try stage change with no evidence → blocked with clear message.
4. Add evidence → change stage → outlet stage updated, history entry visible.
5. Retry a Failed sync.

---

## 11. Out of Scope

Real MISA integration, real file upload, auth/permissions, multi-tenant, route optimization, notifications, reporting. All noted as natural next steps.

**Known limitations & open questions for the business owner:**

- **Cancellations are not propagated to MISA.** Cancelling a plan (A4) deletes the visit locally, but the `SyncService` port (§6) has no `cancel` operation — the external system would keep a row for a visit that no longer exists. A real integration must answer: *how are deleted/cancelled schedule rows reconciled with MISA?*
- **No `cancelled` visit status.** Cancelled plans are hard-deleted with their evidence rather than kept as records. A `cancelled` status would preserve the audit trail, enable cancelling a single visit (today unchecking the box cancels all of the outlet's plans), and give MISA an explicit cancellation signal.
- **No missed/no-show handling.** A planned visit whose date passes stays `planned` indefinitely; there is no overdue state or workflow for visits that didn't happen.