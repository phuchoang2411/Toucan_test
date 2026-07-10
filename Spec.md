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
- **Rescheduling** (editing an outlet's date and/or sales rep on the plan the form is bound to) **moves that visit** to the new date and/or reassigns it to the new rep instead of forking a second plan — the same row keeps its evidence and id, its MISA sync is re-queued. If another planned visit already occupies the destination (rep, date), the move is rejected (`DATE_ALREADY_PLANNED`) rather than silently merging two rows and discarding one's evidence.

### A2. Stage transitions are free-form but fully logged
The requirements define no transition rules (e.g., "can't skip stages").

**Assumption:** any stage → any stage is allowed, including backward moves and `Lost` from anywhere. Real sales is messy — a customer can ask for a proposal while still sampling, or a Won account can churn. Instead of restricting transitions, every change is logged in `StageHistory` with the triggering visit, so managers get auditability without the tool fighting reality.

### A3. Actual new stage may differ from target stage
Target stage is captured at scheduling time as an *expectation*. When completing a visit, the rep chooses the actual new stage freely (defaulted to the target stage in the UI). The visit outcome, not the plan, decides.

### A4. Editing an outlet and unchecking "schedule a visit"
- All of the outlet's still-`planned` visits are **cancelled** (`status: 'cancelled'`) in place — the visits and their evidence are kept as audit records.
- A MISA cancellation is enqueued per visit via `syncService.cancel(visitId)`.
- `completed` visits remain untouched, as before. Cancelled is terminal — there is no re-activation; schedule a new visit instead.
- The form warns before saving, listing the dates affected.

### A5. Visit date validation
Dates in the past are allowed **with a warning**, not blocked — reps sometimes log a visit after the fact. Blocking would push them to enter fake future dates.

### A6. Outlets in terminal stages can still be visited
`Won` outlets need ongoing care; `Lost` outlets can be revived. Scheduling remains allowed for all stages. (A stricter rule would be trivial to add later.)

### A7. Stage snapshot at scheduling time
The visit stores `currentStageSnapshot` — the outlet's stage **when the visit was scheduled**. The outlet's live stage may change before the visit happens; the snapshot preserves what the plan looked like at planning time. A reschedule or rep reassignment (A1) updates date/rep/target/objective on the existing row but deliberately leaves `currentStageSnapshot` untouched — it is not re-captured, since it documents the original planning moment, not the latest edit.

### A8. Evidence lives on the Visit, transitions reference the Visit
Evidence is attached to a visit (it documents the meeting). A stage transition requires ≥1 evidence on the visit that triggers it, and `StageHistory` stores the `visitId` — so every transition is traceable to its proof without duplicating evidence records.

### A9. Authorization: rep vs. manager, enforced at the service layer
UI-only restrictions (hiding a button, disabling a field) only guide honest users — anyone who opens devtools, edits the URL, or calls a service function directly bypasses them. So the prototype adds a lightweight authorization model whose *enforcement* lives in the service layer (`src/services/*`), the same boundary that already mediates every mutation; the UI reflects the same rules but is not the source of truth for them.

**Roles.** Two roles, no more (`src/domain/types.ts`, `USERS`):
- **Rep** — owns outlets/visits where `salesRep === self`. Can see and manage only their own records.
- **Manager** — sees and manages every record, and is the only role allowed to reassign an outlet (or the visit bound to it) to a different rep.

**Session.** No real authentication — `src/store/session.ts` holds a mock "current user" (a `USERS` entry), switchable via a "Signed in as" picker in the top nav (`UserSwitcher`). This stands in for an authenticated request context; in a real backend it would come from a verified session/JWT, not a client-side toggle.

**Policy.** `src/domain/authz.ts` is a small pure module — `canAccess(user, record)` (manager, or `record.salesRep === user.name`) and `canReassign(user)` (manager only) — used two ways:
- **Services assert it and throw** (`FORBIDDEN` / `FORBIDDEN_REASSIGN`) before mutating: `outletService.save`, and every write in `visitService` (`upsertPlanned`, `addEvidence`, `cancelVisit`, `reschedule`, `complete`). This is real enforcement — it applies no matter how the call is made, UI or otherwise. On create, a rep's outlet is silently forced onto themself; a rep changing `salesRep` on an edit (or scheduling under another rep's name) is rejected.
- **UI calls the same predicate** to lock the sales-rep field, hide manager-only filters, and gate action buttons — this is UX, not security; its only job is to stop honest users from hitting a wall they didn't need to.

**View scoping.** List/dashboard pages read through `useScopedDB` (`src/hooks/useScopedDB.ts`), which filters `outlets`/`visits` to the current user's own records unless they're a manager — same `canAccess` rule, applied to reads. Direct-by-id pages (outlet edit, visit detail) treat an existing-but-forbidden record the same as a missing one, so a rep probing another rep's URL learns nothing about whether the record exists.

**Attribution.** `StageHistory.changedBy` records the *acting* user, not the visit's rep — so a manager completing a visit on a rep's behalf is correctly attributed to the manager, preserving the audit trail's meaning.

**Honesty about the prototype.** This is still a client-only app with no real backend: `localStorage` is trivially editable, and the "service layer" runs in the same browser process as the UI, so a sufficiently motivated user can still tamper with state directly. The value of this design is structural — enforcement lives at the data boundary (services), not scattered across components — and that structure carries over unchanged to a real backend: swap the mock `session` for a verified request context (JWT/cookie), move `authz.ts` and the service checks server-side (or into row-level security), and the UI layer needs no changes.

**Out of scope for this prototype:** real authentication, fine-grained permissions beyond rep/manager, audit logging of read access, and admin-level user management (`USERS` is a hardcoded seed list, mirroring `SALES_REPS` before it).

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
  status                enum   planned | completed | cancelled
  result                string outcome summary (set on completion)
  resultNotes           string optional
  misaSyncStatus        enum   Queued | Synced | Failed
  createdAt, updatedAt

  LOGICAL UNIQUE: (salesRep, outletId, visitDate) WHERE status = 'planned'   (A1)

  *Cancelled is terminal; to plan again, schedule a new visit.*

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
  cancel(visitId: string): void
  getStatus(visitId: string): 'Queued' | 'Synced' | 'Failed'
}

// adapter (mock implementation)
MockMisaAdapter implements SyncService
  - enqueue: set Queued, then after 1.5s resolve to Synced (80%) or Failed (20%)
  - retry: re-run the same transition from Failed
  - cancel: delegates to enqueue (same 1.5s/80/20 behavior); a real adapter would POST a cancel payload instead of an upsert
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
3. **Working Schedule** — table: date, rep, outlet, address, current stage (snapshot), target stage, objective, MISA sync badge, status. Row click → visit detail. **Filters** toolbar: rep dropdown, status dropdown (planned/completed/cancelled), date preset (all/today/this week/overdue). Clear filters button.
4. **Visit detail** — record result + notes, add mock evidence (type + name), toggle "change stage", pick new stage (default = target). Save enforces the evidence gate. Shows outlet's stage history at the bottom.
5. **Dashboard** (`/dashboard`) — horizontal bar chart of outlets per stage, per-rep table (outlets/planned/overdue/completed), upcoming this week visit list.

**Validation summary:**
- Outlet: name, address, channel, tier, salesRep, stage → required.
- If "schedule a visit": visitDate, targetStage, objective → required; past date → warning (A5); targetStage should differ from current stage → warning, not error.
- Visit completion with stage change: ≥1 evidence → hard error (BR3).

---

**Per-visit reschedule & cancel (rep):**
- Visit detail (`/visits/:id`) for planned visits: "Reschedule…" reveals an inline date picker with confirm/cancel; "Cancel visit…" reveals a reason `<select>` (Customer postponed, No-show, Planned by mistake, Other + free-text note) with a two-click confirm. Success → toast and stay on page.
- Cancelled visit card shows reason and note. Schedule table shows cancel reason as muted text.

**Dashboard drill-down (manager):**
- Dashboard stage bars → `/outlets?stage=<stage>` with an active-filter chip and "Clear" button.
- Dashboard per-rep cells → `/schedule?rep=<rep>&status/ when=<filter>`.
- Zero counts render as plain text (no dead-end links).

## 9. Seed Data

Sales reps: `Phúc`, `Linh`, `Minh`.

| Outlet | Channel | Tier | Rep | Stage |
|---|---|---|---|---|
| Blue Lotus Cafe | Cafe | B | Phúc | SQL |
| Hoa Nắng Bakery | Bakery | C | Linh | Raw Lead |
| Maison Saigon Bistro | Restaurant | A | Minh | Customer Sampling |

Plus one pre-seeded planned visit, one completed visit with evidence, and one cancelled visit (`visit-cancelled-1`) on Hoa Nắng Bakery with a preserved note evidence, so the schedule screen and history are demonstrable immediately with all statuses represented.

---

## 10. Test Plan (manual demo path + unit tests)

**Unit tests (service layer, Vitest):**
1. Upsert: same (rep, outlet, date) with planned visit → updates, count unchanged, sync reset to Queued.
2. Upsert: same key but visit completed → creates a second visit.
3. Evidence gate: stage change with 0 evidence → rejected; with 1 evidence → accepted, StageHistory row appended, outlet stage updated.
4. Completing a visit without stage change and without evidence → allowed.
5. Unchecking "schedule a visit": planned visits cancelled (status set to `cancelled`, evidence preserved); completed visits untouched.

**Manual demo script:**
1. Create outlet with visit → row appears in schedule, sync goes Queued → Synced/Failed.
2. Re-save same outlet, same date → row updated, no duplicate.
3. Open visit → try stage change with no evidence → blocked with clear message.
4. Add evidence → change stage → outlet stage updated, history entry visible.
5. Retry a Failed sync.
6. **Schedule filters** — filter by rep, status, date preset (today/week/overdue); clear button restores full list.
7. **Dashboard** (`/dashboard`) — view per-stage bar chart, per-rep breakdown table, upcoming week visit list.

---

## 11. Out of Scope

Real MISA integration, real file upload, auth/permissions, multi-tenant, route optimization, notifications, reporting. All noted as natural next steps.

**Known limitations & open questions for the business owner:**

1. ~~Cancellations not propagated to MISA~~ — resolved: `cancel()` on the sync port enqueues a cancellation message per cancelled visit.
2. ~~No `cancelled` visit status~~ — resolved: planned visits are cancelled in place, kept with their evidence as audit records.
3. **Partial overdue** — overdue detection is derived (no data-model change), but there is no dedicated "overdue visit list" beyond the schedule filter preset, and no automated status flip.
4. ~~No per-visit cancel~~ — resolved: per-visit reschedule/cancel from the visit detail page (see §8).
5. **No re-activation** — cancelled is terminal; schedule a new visit instead.
6. **Mock retry can't distinguish payloads** — the mock `cancel` delegates to `enqueue`; a real adapter sends a different MISA cancel payload.
7. ~~No no-show workflow~~ — resolved: cancel with reason includes "No-show" (see §8).
8. ~~Reporting still minimal~~ — mitigated: dashboard drill-down with linkable filter URLs (see §8); the dashboard is still a single-page snapshot.