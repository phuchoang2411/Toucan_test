# Magnolia Sales — C.A Outlet & Working Schedule Module

*(Tiếng Việt: [`README.vi.md`](./README.vi.md))*

Prototype module of Magnolia's internal sales app. Sales reps acquire new outlets
(cafes, bars, restaurants, hotels, bakeries) and move them through a sales funnel.
Progress is driven by **field visits ("đi tuyến")**, and every stage transition must
be backed by **evidence** collected during a visit — giving managers a verifiable
audit trail: `StageHistory → Visit → Evidence`.

The full requirements, domain model, business rules and assumptions live in
[`Spec.md`](./Spec.md) — that document is the spec of record.

## Run

```bash
npm install
npm run dev      # Vite dev server (http://localhost:5173)
npm test         # Vitest unit tests (service layer)
npm run build    # tsc (strict) + vite production build
```

The app persists state to `localStorage` (`magnolia-db-v1`) and seeds demo data
on first run. To reset, clear the key in DevTools → Application → Local Storage.

## Architecture

React 19 + Vite + TypeScript (strict) SPA, no backend. All business rules live
in an async-signature service layer over a tiny pub/sub repository (in-memory +
`localStorage`). Components observe state via `useSyncExternalStore` and mutate
only through services — never touching the store directly.

```
src/
  domain/types.ts        enums, constants, entity interfaces, DB shape
  store/                  seed data + pub/sub repository (+ localStorage)
  hooks/useDB.ts          useSyncExternalStore wrapper
  services/               syncService (port + MockMisaAdapter), visitService,
                         stageService, outletService   (async signatures)
  components/             StageBadge, SyncBadge (+ CSS modules)
  pages/                  OutletListPage, OutletFormPage, SchedulePage, VisitDetailPage
```

**MISA sync isolation (Ports & Adapters, spec §6):** business logic depends only
on the `SyncService` interface and calls `syncService.enqueue(visitId)`. The mock
adapter flips `Queued → Synced` (80%) / `Failed` (20%) after 1.5s, with a Retry
button on `Failed`. On every page load `syncService.resumePending()` re-enqueues
visits still `Queued` from a previous session — the 1.5s timer is in-memory, but
`Queued` is persisted, so a reload mid-sync would otherwise leave rows stuck. An
in-flight timer for a visit is cleared before a new one is set, so re-saving the
same visit within 1.5s never double-resolves. Replacing the mock with the real
MISA API is one new adapter class — zero changes to outlet/visit/stage logic.

**Reads:** UI components read via the reactive `useDB()` store subscription; the
service query methods (`visitService.list/get/listEvidence`, `outletService.list/get`,
`stageService`) are the REST-shaped read API a real backend swap would wire the
hooks to. They are present for that contract, not invoked by the prototype's UI.

## Manual demo script (spec §10)

1. **Create outlet with visit** — `/outlets/new`, fill fields, check "Schedule a
   visit", pick a date + target stage. Save → lands on `/schedule`; the new row
   shows `Queued` and flips to `Synced`/`Failed` by itself after ~1.5s.
2. **Re-save same outlet, same date** — edit the outlet, keep the same visit
   date → the existing planned row is updated in place (no duplicate), and MISA
   sync resets to `Queued`.
3. **Evidence gate** — open a planned visit, try to check "Change outlet stage"
   with no evidence → the checkbox is disabled with the BR3 hint; completing
   with a stage change throws `EVIDENCE_REQUIRED` (defended in the service layer).
4. **Add evidence → change stage → complete** — add a mock evidence row, check
   "Change outlet stage" (now unlocked, defaulting to the target stage), enter a
   result, save → redirected to schedule; the outlet's stage is updated and a
   `StageHistory` row appears on the visit detail.
5. **Retry a `Failed` sync** — if a row lands on `Failed`, click Retry on the
   schedule or visit detail; it re-runs the transition (20% fail chance per
   sync, so re-save to roll again if none occurred).
6. **Persistence** — reload the page; state is restored from `localStorage`.

## Unit tests (`npm test`)

Spec §10 tests 1–5, implemented TDD in the service layer:

1. Upsert: same `(rep, outlet, date)` with a planned visit → updates, count
   unchanged, sync reset to `Queued`.
2. Upsert: same key but visit completed → creates a second visit.
3. Evidence gate: stage change with 0 evidence → rejected; with 1 evidence →
   `StageHistory` appended, outlet stage updated atomically (one `setState`).
4. Completing a visit without stage change and without evidence → allowed.
5. Unchecking "schedule a visit": planned visit deleted; completed preserved.

## Assumptions & decisions

From `Spec.md` §3 (A1–A10) plus the four brainstorming decisions that closed the
spec's open gaps:

- **A1 — Dedup is planned-only.** The upsert key `(salesRep, outletId,
  visitDate)` applies only to `status = 'planned'` visits. A matching
  `completed` visit is immutable history → a new visit is created instead.
  Matching planned visit is updated in place and MISA sync resets to `Queued`.
- **A2 — Free-form but logged transitions.** Any stage → any stage is allowed
  (including backward moves and `Lost` from anywhere). Every change is logged
  in `StageHistory` with the triggering visit for auditability.
- **A3 — Actual stage may differ from target.** Target stage is an expectation
  captured at scheduling; the rep chooses the actual new stage on completion
  (defaulted to target in the UI).
- **A4 — Unchecking "schedule a visit"** deletes remaining planned visits for
  the outlet; completed visits are immutable and preserved.
- **A5 — Past dates allowed with a warning**, not blocked (reps sometimes log
  visits after the fact).
- **A6 — Terminal stages can still be visited** (Won needs care; Lost can be
  revived).
- **A7 — Stage snapshot at scheduling time.** The visit stores
  `currentStageSnapshot`; the live stage may change before the visit happens.
- **A8 — Evidence lives on the Visit; transitions reference the Visit.**
- **A9 — Single-user prototype** (no auth; rep is a select from a seeded list).
- **A10 — In-memory + `localStorage`** behind an async service layer that mimics
  a REST API, so swapping in a real backend is a mechanical change.

**Brainstorming decisions (closing the spec's open gaps):**

1. **UI layer:** plain CSS — a global stylesheet (`src/index.css` tokens + shared
   classes) plus CSS Modules for the two badges. Zero styling dependencies.
2. **Navigation:** React Router with real URLs — `/outlets`, `/outlets/new`,
   `/outlets/:id/edit`, `/schedule`, `/visits/:id`.
3. **Completed visits are read-only:** the stage change happens only as part of
   the completion action; afterwards the visit detail is view-only and no late
   evidence can be attached (`VISIT_READ_ONLY`).
4. **Data flow:** the repository holds one immutable `DB` object and notifies
   subscribers on every `setState`; hooks subscribe via `useSyncExternalStore`.
   This is what makes the MISA badge flip `Queued → Synced/Failed` on its own
   ~1.5s after save.

**Documented quirks (spec-faithful):**
- **Date change:** editing an outlet and changing the visit *date* **moves**
  the planned visit the form is bound to (same id, same evidence, MISA
  re-queued) rather than forking a second plan. If another planned visit
  already sits on the destination date, the move is rejected
  (`DATE_ALREADY_PLANNED`) instead of silently merging the two rows.
- **Rep change:** the visit follows the outlet. Editing an outlet and changing
  the rep with "schedule a visit" checked **reassigns** the planned visit the
  form is bound to (same id, same evidence, MISA re-queued) rather than
  leaving an orphaned plan under the old rep. If the new rep already has a
  planned visit on that date, the reassignment is rejected
  (`DATE_ALREADY_PLANNED`) instead of silently merging the two rows.
- **Cancel:** unchecking "schedule a visit" deletes **all** planned visits for
  the outlet and their attached evidence (A4); completed visits and their
  evidence are preserved as immutable history.