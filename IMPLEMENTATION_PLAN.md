# Magnolia Sales App — Implementation Plan

> **For AI coding agents executing this plan:** You need zero prior context. Read `Spec.md` in this directory first, then execute tasks strictly in order — each task builds on the previous one's interfaces. For every task: follow the steps exactly (test-first where steps say so), run the stated commands and confirm the expected output before moving on, tick the `- [ ]` checkboxes as you go, and make the git commit at the end of the task before starting the next. All code blocks are complete reference implementations — copy them, don't reinvent. If a step's command output differs from the stated expectation, stop and fix before proceeding.

**Goal:** Build the C.A Outlet & Working Schedule prototype module exactly as specified in `/home/hoangphuc/Documents/Toucan_test/Spec.md` — outlets move through a sales funnel driven by evidence-backed field visits.

**Architecture:** React + Vite + TypeScript SPA, no backend. All business rules live in an async-signature service layer (`outletService`, `visitService`, `stageService`, `syncService` port + `MockMisaAdapter`) over a tiny pub/sub repository (in-memory + localStorage). Components observe state via `useSyncExternalStore` and mutate only through services.

**Tech Stack:** React 19, Vite, TypeScript (strict), React Router 7, Vitest, plain CSS (global tokens + CSS modules for badges). No other runtime dependencies. IDs via `crypto.randomUUID()`.

## Context

The user wrote Spec.md for a technical assessment. Brainstorming closed the four gaps the spec left open:

1. **UI layer:** plain CSS (global stylesheet + CSS modules for components) — zero styling dependencies.
2. **Navigation:** React Router with real URLs (`/outlets`, `/outlets/:id/edit`, `/schedule`, `/visits/:id`).
3. **Completed visits are read-only:** stage change happens only as part of the completion action; afterwards the visit detail is view-only. Evidence can only be added while `planned`.
4. **Data flow:** repository holds one immutable `DB` object, notifies subscribers on every `setState`; hooks use `useSyncExternalStore`. This makes the MISA badge flip `Queued → Synced/Failed` on its own ~1.5s after save.

One documented quirk (spec-faithful): editing an outlet and changing the visit *date* creates a plan on the new date via the A1 upsert key; a previously planned visit on the old date remains. Unchecking "schedule a visit" deletes **all** planned visits for the outlet (A4), completed ones are preserved.

## Global Constraints

- Stack fixed by spec §7: **React + Vite + TypeScript, no backend server.**
- Runtime deps limited to `react`, `react-dom`, `react-router-dom`. Dev deps: `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `@types/react`, `@types/react-dom`.
- Stage enum values (spec §4, copy verbatim): `RawLead | SQL | CustomerSampling | ProposalSent | Won | Lost`; labels: `Raw Lead, SQL, Customer Sampling, Proposal Sent, Won, Lost`.
- Channels: `Cafe | Restaurant | Hotel | Bar | Bakery`. Tiers: `A | B | C`. Sales reps seeded: `Phúc`, `Linh`, `Minh`.
- Visit status: `planned | completed`. Sync status: `Queued | Synced | Failed`. Evidence type: `photo | file | note`.
- `visitDate` is a `'YYYY-MM-DD'` string (day precision — it is the dedup key component).
- Logical unique rule (A1/BR2): `(salesRep, outletId, visitDate)` among `status = 'planned'` visits only. Enforced in `visitService`, never in the UI.
- Evidence gate (BR3): stage transition on completion requires ≥1 evidence on the triggering visit. Service throws `Error('EVIDENCE_REQUIRED')`.
- BR4 atomicity: visit completion + outlet stage update + StageHistory append happen in **one** `repository.setState` call.
- MISA mock (§6): enqueue sets `Queued`, resolves after **1500 ms** to `Synced` (80%) or `Failed` (20%); `retry` re-runs the same transition.
- localStorage key: `magnolia-db-v1`. Repository guards `typeof localStorage === 'undefined'` so services run under Vitest (node env).
- Project directory: `/home/hoangphuc/Documents/Toucan_test` (currently only `Spec.md`; **not yet a git repo** — Task 1 runs `git init`).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```
Toucan_test/
  Spec.md                       (exists — spec of record)
  index.html  package.json  tsconfig.json  vite.config.ts  .gitignore  README.md
  src/
    main.tsx  App.tsx  index.css
    domain/types.ts             enums, constants, entity interfaces, DB shape
    store/seed.ts               seedDB(): demo data (§9)
    store/repository.ts         pub/sub store + localStorage persistence
    hooks/useDB.ts              useSyncExternalStore wrapper
    services/syncService.ts     SyncService port + MockMisaAdapter (§6)
    services/visitService.ts    upsert (A1), evidence, complete (BR3–BR5)
    services/stageService.ts    stage history queries
    services/outletService.ts   save outlet + BR1 + A4
    services/__tests__/helpers.ts
    services/__tests__/syncService.test.ts
    services/__tests__/visitService.test.ts
    services/__tests__/outletService.test.ts
    components/StageBadge.tsx + StageBadge.module.css
    components/SyncBadge.tsx  + SyncBadge.module.css
    pages/OutletListPage.tsx
    pages/OutletFormPage.tsx
    pages/SchedulePage.tsx
    pages/VisitDetailPage.tsx
```

---

### Task 1: Project scaffold + git init

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` (stub), `src/index.css` (stub)

**Interfaces:**
- Produces: working `npm run dev`, `npm test` (0 tests OK), git repo with first commit.

- [ ] **Step 1: Write config files** (scaffold manually — `npm create vite` prompts interactively on a non-empty dir)

`.gitignore`:
```
node_modules
dist
```

`package.json`:
```json
{
  "name": "magnolia-sales-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.5.0",
    "typescript": "~5.8.0",
    "vite": "^6.3.0",
    "vitest": "^3.2.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node' },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Magnolia Sales — C.A Outlets</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

`src/App.tsx` (stub, replaced in Task 8):
```tsx
export default function App() {
  return <h1>Magnolia Sales</h1>;
}
```

`src/index.css` (stub, filled in Task 8):
```css
body { font-family: system-ui, sans-serif; margin: 0; }
```

- [ ] **Step 2: Install and verify**

Run: `npm install` then `npm run dev` (background) — expect Vite banner, page renders "Magnolia Sales" at the printed localhost URL; kill it. Run `npm test` — expect "No test files found" exit 0 (or pass `--passWithNoTests` if vitest errors).

- [ ] **Step 3: Init repo and commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Vite + React + TS project"
```

---

### Task 2: Domain types & constants

**Files:**
- Create: `src/domain/types.ts`

**Interfaces:**
- Produces (used by every later task): `Stage`, `STAGES`, `STAGE_LABELS`, `Channel`, `CHANNELS`, `Tier`, `TIERS`, `SALES_REPS`, `VisitStatus`, `SyncStatus`, `EvidenceType`, `EVIDENCE_TYPES`, `Outlet`, `Visit`, `Evidence`, `StageHistory`, `DB`.

- [ ] **Step 1: Write the file** (types only — no test; compiler is the test)

```ts
export const STAGES = ['RawLead', 'SQL', 'CustomerSampling', 'ProposalSent', 'Won', 'Lost'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  RawLead: 'Raw Lead',
  SQL: 'SQL',
  CustomerSampling: 'Customer Sampling',
  ProposalSent: 'Proposal Sent',
  Won: 'Won',
  Lost: 'Lost',
};

export const CHANNELS = ['Cafe', 'Restaurant', 'Hotel', 'Bar', 'Bakery'] as const;
export type Channel = (typeof CHANNELS)[number];

export const TIERS = ['A', 'B', 'C'] as const;
export type Tier = (typeof TIERS)[number];

export const SALES_REPS = ['Phúc', 'Linh', 'Minh'] as const;

export type VisitStatus = 'planned' | 'completed';
export type SyncStatus = 'Queued' | 'Synced' | 'Failed';

export const EVIDENCE_TYPES = ['photo', 'file', 'note'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface Outlet {
  id: string;
  name: string;
  address: string;
  channel: Channel;
  tier: Tier;
  salesRep: string;
  currentStage: Stage;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  outletId: string;
  salesRep: string;
  /** 'YYYY-MM-DD' — day precision, part of the dedup key (A1) */
  visitDate: string;
  /** outlet stage when the visit was scheduled (A7) */
  currentStageSnapshot: Stage;
  targetStage: Stage;
  objective: string;
  status: VisitStatus;
  result?: string;
  resultNotes?: string;
  misaSyncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  visitId: string;
  type: EvidenceType;
  name: string;
  uploadedAt: string;
}

export interface StageHistory {
  id: string;
  outletId: string;
  visitId: string;
  fromStage: Stage;
  toStage: Stage;
  changedBy: string;
  changedAt: string;
}

export interface DB {
  outlets: Outlet[];
  visits: Visit[];
  evidence: Evidence[];
  stageHistory: StageHistory[];
}
```

- [ ] **Step 2: Verify compile & commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add src/domain/types.ts && git commit -m "feat: domain types and enums per spec §4"
```

---

### Task 3: Seed data + repository (pub/sub + localStorage)

**Files:**
- Create: `src/store/seed.ts`, `src/store/repository.ts`
- Test: `src/services/__tests__/helpers.ts` (fixtures used by all service tests)

**Interfaces:**
- Produces: `repository.getState(): DB`, `repository.setState(updater: (db: DB) => DB): void`, `repository.subscribe(l: () => void): () => void`, `repository.reset(db: DB): void` (test-only), `seedDB(): DB`.
- Test helpers: `makeOutlet(overrides?)`, `makeVisit(overrides?)`, `makeEvidence(overrides?)`, `resetDB(partial?)`.

- [ ] **Step 1: Write `src/store/seed.ts`** (spec §9: 3 outlets, 1 planned + 1 completed visit with evidence + matching history row; fixed ids so demos are reproducible)

```ts
import type { DB } from '../domain/types';

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function seedDB(): DB {
  const now = new Date().toISOString();
  return {
    outlets: [
      { id: 'outlet-blue-lotus', name: 'Blue Lotus Cafe', address: '12 Lê Lợi, Q1, HCMC', channel: 'Cafe', tier: 'B', salesRep: 'Phúc', currentStage: 'SQL', notes: 'Interested in cold brew line', createdAt: now, updatedAt: now },
      { id: 'outlet-hoa-nang', name: 'Hoa Nắng Bakery', address: '45 Phan Đình Phùng, Phú Nhuận, HCMC', channel: 'Bakery', tier: 'C', salesRep: 'Linh', currentStage: 'RawLead', createdAt: now, updatedAt: now },
      { id: 'outlet-maison-saigon', name: 'Maison Saigon Bistro', address: '8 Đồng Khởi, Q1, HCMC', channel: 'Restaurant', tier: 'A', salesRep: 'Minh', currentStage: 'CustomerSampling', createdAt: now, updatedAt: now },
    ],
    visits: [
      { id: 'visit-planned-1', outletId: 'outlet-blue-lotus', salesRep: 'Phúc', visitDate: isoDate(1), currentStageSnapshot: 'SQL', targetStage: 'CustomerSampling', objective: 'Drop off sample pack', status: 'planned', misaSyncStatus: 'Synced', createdAt: now, updatedAt: now },
      { id: 'visit-completed-1', outletId: 'outlet-maison-saigon', salesRep: 'Minh', visitDate: isoDate(-3), currentStageSnapshot: 'SQL', targetStage: 'CustomerSampling', objective: 'Run tasting session', status: 'completed', result: 'Tasting went well, chef approved 2 SKUs', misaSyncStatus: 'Synced', createdAt: now, updatedAt: now },
    ],
    evidence: [
      { id: 'evidence-1', visitId: 'visit-completed-1', type: 'photo', name: 'tasting-session.jpg', uploadedAt: now },
    ],
    stageHistory: [
      { id: 'history-1', outletId: 'outlet-maison-saigon', visitId: 'visit-completed-1', fromStage: 'SQL', toStage: 'CustomerSampling', changedBy: 'Minh', changedAt: now },
    ],
  };
}
```

- [ ] **Step 2: Write `src/store/repository.ts`**

```ts
import type { DB } from '../domain/types';
import { seedDB } from './seed';

const STORAGE_KEY = 'magnolia-db-v1';

function load(): DB | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DB) : null;
  } catch {
    return null;
  }
}

function persist(db: DB): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage full/unavailable — prototype keeps working in-memory */
  }
}

let state: DB = load() ?? seedDB();
persist(state);

const listeners = new Set<() => void>();

export const repository = {
  getState(): DB {
    return state;
  },
  setState(updater: (db: DB) => DB): void {
    state = updater(state);
    persist(state);
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** test-only: replace the whole DB */
  reset(db: DB): void {
    state = db;
    persist(state);
    listeners.forEach((l) => l());
  },
};
```

- [ ] **Step 3: Write test helpers `src/services/__tests__/helpers.ts`**

```ts
import { repository } from '../../store/repository';
import type { DB, Evidence, Outlet, Visit } from '../../domain/types';

const now = '2026-01-01T00:00:00.000Z';

export function makeOutlet(overrides: Partial<Outlet> = {}): Outlet {
  return { id: 'o1', name: 'Test Cafe', address: '1 Test St', channel: 'Cafe', tier: 'B', salesRep: 'Phúc', currentStage: 'SQL', createdAt: now, updatedAt: now, ...overrides };
}

export function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return { id: 'v1', outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-07-10', currentStageSnapshot: 'SQL', targetStage: 'CustomerSampling', objective: 'Sample drop', status: 'planned', misaSyncStatus: 'Synced', createdAt: now, updatedAt: now, ...overrides };
}

export function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return { id: 'e1', visitId: 'v1', type: 'photo', name: 'pic.jpg', uploadedAt: now, ...overrides };
}

export function resetDB(partial: Partial<DB> = {}): void {
  repository.reset({ outlets: [], visits: [], evidence: [], stageHistory: [], ...partial });
}
```

- [ ] **Step 4: Write a repository smoke test** — append to a new file `src/services/__tests__/repository.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { repository } from '../../store/repository';
import { makeOutlet, resetDB } from './helpers';

describe('repository', () => {
  it('setState replaces state immutably and notifies subscribers', () => {
    resetDB();
    let notified = 0;
    const unsubscribe = repository.subscribe(() => notified++);
    const before = repository.getState();
    repository.setState((db) => ({ ...db, outlets: [makeOutlet()] }));
    expect(notified).toBe(1);
    expect(repository.getState()).not.toBe(before);
    expect(repository.getState().outlets).toHaveLength(1);
    unsubscribe();
    repository.setState((db) => db);
    expect(notified).toBe(1);
  });
});
```

- [ ] **Step 5: Run tests, then commit**

Run: `npm test` → 1 test passes.
```bash
git add src/store src/services && git commit -m "feat: seed data and pub/sub repository with localStorage persistence"
```

---

### Task 4: SyncService port + MockMisaAdapter (TDD)

**Files:**
- Create: `src/services/syncService.ts`
- Test: `src/services/__tests__/syncService.test.ts`

**Interfaces:**
- Produces: `interface SyncService { enqueue(visitId: string): void; retry(visitId: string): void; getStatus(visitId: string): SyncStatus }` and singleton `export const syncService: SyncService`.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncService } from '../syncService';
import { makeOutlet, makeVisit, resetDB } from './helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MockMisaAdapter', () => {
  it('enqueue sets Queued then resolves to Synced after 1.5s on a successful roll', () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ misaSyncStatus: 'Failed' })] });
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // < 0.8 → success
    syncService.enqueue('v1');
    expect(syncService.getStatus('v1')).toBe('Queued');
    vi.advanceTimersByTime(1500);
    expect(syncService.getStatus('v1')).toBe('Synced');
  });

  it('resolves to Failed on a failing roll, and retry re-runs the transition', () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit()] });
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // ≥ 0.8 → failure
    syncService.enqueue('v1');
    vi.advanceTimersByTime(1500);
    expect(syncService.getStatus('v1')).toBe('Failed');

    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    syncService.retry('v1');
    expect(syncService.getStatus('v1')).toBe('Queued');
    vi.advanceTimersByTime(1500);
    expect(syncService.getStatus('v1')).toBe('Synced');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve `../syncService`.

- [ ] **Step 3: Implement `src/services/syncService.ts`**

```ts
import { repository } from '../store/repository';
import type { SyncStatus } from '../domain/types';

/** Port — the only thing business logic may depend on (BR6, §6). */
export interface SyncService {
  enqueue(visitId: string): void;
  retry(visitId: string): void;
  getStatus(visitId: string): SyncStatus;
}

const SYNC_DELAY_MS = 1500;
const SUCCESS_RATE = 0.8;

function setStatus(visitId: string, status: SyncStatus): void {
  repository.setState((db) => ({
    ...db,
    visits: db.visits.map((v) => (v.id === visitId ? { ...v, misaSyncStatus: status } : v)),
  }));
}

/** Mock adapter — swapping in the real MISA API means replacing only this class. */
class MockMisaAdapter implements SyncService {
  enqueue(visitId: string): void {
    setStatus(visitId, 'Queued');
    setTimeout(() => {
      setStatus(visitId, Math.random() < SUCCESS_RATE ? 'Synced' : 'Failed');
    }, SYNC_DELAY_MS);
  }
  retry(visitId: string): void {
    this.enqueue(visitId);
  }
  getStatus(visitId: string): SyncStatus {
    const visit = repository.getState().visits.find((v) => v.id === visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    return visit.misaSyncStatus;
  }
}

export const syncService: SyncService = new MockMisaAdapter();
```

- [ ] **Step 4: Run tests** — `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/services && git commit -m "feat: SyncService port with mock MISA adapter (ports & adapters, §6)"
```

---

### Task 5: visitService.upsertPlanned — dedup rule A1 (TDD)

**Files:**
- Create: `src/services/visitService.ts` (first slice: `list`, `get`, `upsertPlanned`)
- Test: `src/services/__tests__/visitService.test.ts`

**Interfaces:**
- Produces: `ScheduleVisitInput { outletId; salesRep; visitDate; targetStage; objective }`, `visitService.upsertPlanned(input): Promise<{ visit: Visit; created: boolean }>`, `visitService.list(): Promise<Visit[]>`, `visitService.get(id): Promise<Visit | undefined>`.
- Consumes: `repository`, `syncService.enqueue`.

- [ ] **Step 1: Write the failing tests** (spec §10 tests 1–2, plus A7 snapshot)

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { visitService } from '../visitService';
import { repository } from '../../store/repository';
import { makeOutlet, makeVisit, resetDB } from './helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('visitService.upsertPlanned (A1/BR2)', () => {
  it('same (rep, outlet, date) with a planned visit → updates in place, count unchanged, sync reset to Queued', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ misaSyncStatus: 'Synced' })] });
    const { visit, created } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-07-10',
      targetStage: 'ProposalSent', objective: 'Bring proposal',
    });
    expect(created).toBe(false);
    expect(repository.getState().visits).toHaveLength(1);
    expect(visit.id).toBe('v1');
    expect(visit.targetStage).toBe('ProposalSent');
    expect(visit.objective).toBe('Bring proposal');
    expect(repository.getState().visits[0].misaSyncStatus).toBe('Queued');
  });

  it('same key but the visit is completed → creates a second visit', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ status: 'completed' })] });
    const { created } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-07-10',
      targetStage: 'ProposalSent', objective: 'Second meeting',
    });
    expect(created).toBe(true);
    expect(repository.getState().visits).toHaveLength(2);
  });

  it('new visit snapshots the outlet stage at scheduling time (A7) and starts Queued', async () => {
    resetDB({ outlets: [makeOutlet({ currentStage: 'ProposalSent' })] });
    const { visit } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-08-01',
      targetStage: 'Won', objective: 'Close the deal',
    });
    expect(visit.currentStageSnapshot).toBe('ProposalSent');
    expect(visit.status).toBe('planned');
    expect(visit.misaSyncStatus).toBe('Queued');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve `../visitService`.

- [ ] **Step 3: Implement first slice of `src/services/visitService.ts`**

```ts
import { repository } from '../store/repository';
import { syncService } from './syncService';
import type { Evidence, EvidenceType, Stage, Visit } from '../domain/types';

export interface ScheduleVisitInput {
  outletId: string;
  salesRep: string;
  visitDate: string; // 'YYYY-MM-DD'
  targetStage: Stage;
  objective: string;
}

export const visitService = {
  async list(): Promise<Visit[]> {
    return [...repository.getState().visits].sort((a, b) => a.visitDate.localeCompare(b.visitDate));
  },

  async get(id: string): Promise<Visit | undefined> {
    return repository.getState().visits.find((v) => v.id === id);
  },

  /** BR1/BR2 (A1): upsert keyed on (salesRep, outletId, visitDate) among planned visits only. */
  async upsertPlanned(input: ScheduleVisitInput): Promise<{ visit: Visit; created: boolean }> {
    const db = repository.getState();
    const outlet = db.outlets.find((o) => o.id === input.outletId);
    if (!outlet) throw new Error('OUTLET_NOT_FOUND');

    const existing = db.visits.find(
      (v) =>
        v.status === 'planned' &&
        v.salesRep === input.salesRep &&
        v.outletId === input.outletId &&
        v.visitDate === input.visitDate,
    );

    const now = new Date().toISOString();

    if (existing) {
      const updated: Visit = { ...existing, targetStage: input.targetStage, objective: input.objective, updatedAt: now };
      repository.setState((cur) => ({
        ...cur,
        visits: cur.visits.map((v) => (v.id === existing.id ? updated : v)),
      }));
      syncService.enqueue(existing.id); // changed row → external system needs it again (A1)
      return { visit: { ...updated, misaSyncStatus: 'Queued' }, created: false };
    }

    const visit: Visit = {
      id: crypto.randomUUID(),
      outletId: input.outletId,
      salesRep: input.salesRep,
      visitDate: input.visitDate,
      currentStageSnapshot: outlet.currentStage, // A7
      targetStage: input.targetStage,
      objective: input.objective,
      status: 'planned',
      misaSyncStatus: 'Queued',
      createdAt: now,
      updatedAt: now,
    };
    repository.setState((cur) => ({ ...cur, visits: [...cur.visits, visit] }));
    syncService.enqueue(visit.id);
    return { visit, created: true };
  },
};
```

- [ ] **Step 4: Run tests** — `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/services && git commit -m "feat: visit upsert with planned-only dedup key (A1) and MISA re-enqueue"
```

---

### Task 6: Evidence, completion, evidence gate, stage history (TDD)

**Files:**
- Modify: `src/services/visitService.ts` (add `addEvidence`, `listEvidence`, `complete`, `deletePlannedForOutlet`)
- Create: `src/services/stageService.ts`
- Test: append to `src/services/__tests__/visitService.test.ts`

**Interfaces:**
- Produces:
  - `CompleteVisitInput { visitId: string; result: string; resultNotes?: string; newStage?: Stage | null }`
  - `visitService.complete(input): Promise<Visit>` — throws `'EVIDENCE_REQUIRED'`, `'VISIT_READ_ONLY'`, `'RESULT_REQUIRED'`, `'VISIT_NOT_FOUND'`.
  - `visitService.addEvidence(visitId, { type, name }): Promise<Evidence>` — throws `'VISIT_READ_ONLY'` on completed visits.
  - `visitService.listEvidence(visitId): Promise<Evidence[]>`
  - `visitService.deletePlannedForOutlet(outletId): Promise<void>` (A4)
  - `stageService.historyForOutlet(outletId): Promise<StageHistory[]>` (newest first)

- [ ] **Step 1: Write the failing tests** (spec §10 tests 3–4 + read-only rule)

```ts
describe('visitService.complete (BR3–BR5)', () => {
  it('rejects a stage change with zero evidence, changing nothing (BR3)', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit()] });
    await expect(
      visitService.complete({ visitId: 'v1', result: 'Met owner', newStage: 'CustomerSampling' }),
    ).rejects.toThrow('EVIDENCE_REQUIRED');
    expect(repository.getState().visits[0].status).toBe('planned');
    expect(repository.getState().outlets[0].currentStage).toBe('SQL');
    expect(repository.getState().stageHistory).toHaveLength(0);
  });

  it('accepts a stage change with 1 evidence: history appended, outlet stage updated atomically (BR3/BR4)', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit()], evidence: [makeEvidence()] });
    await visitService.complete({ visitId: 'v1', result: 'Sampling agreed', newStage: 'CustomerSampling' });
    const db = repository.getState();
    expect(db.visits[0].status).toBe('completed');
    expect(db.outlets[0].currentStage).toBe('CustomerSampling');
    expect(db.stageHistory).toHaveLength(1);
    expect(db.stageHistory[0]).toMatchObject({
      outletId: 'o1', visitId: 'v1', fromStage: 'SQL', toStage: 'CustomerSampling', changedBy: 'Phúc',
    });
  });

  it('allows completing without stage change and without evidence (BR5)', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit()] });
    const visit = await visitService.complete({ visitId: 'v1', result: 'Owner away, rescheduled' });
    expect(visit.status).toBe('completed');
    expect(repository.getState().stageHistory).toHaveLength(0);
    expect(repository.getState().outlets[0].currentStage).toBe('SQL');
  });

  it('completed visits are read-only: no re-complete, no late evidence', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ status: 'completed' })] });
    await expect(visitService.complete({ visitId: 'v1', result: 'again' })).rejects.toThrow('VISIT_READ_ONLY');
    await expect(visitService.addEvidence('v1', { type: 'note', name: 'late note' })).rejects.toThrow('VISIT_READ_ONLY');
  });
});
```

(Import `makeEvidence` in the test file's existing import from `./helpers`.)

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: `complete is not a function`.

- [ ] **Step 3: Add to `visitService`** (inside the same object literal) **and create `stageService.ts`**

```ts
export interface CompleteVisitInput {
  visitId: string;
  result: string;
  resultNotes?: string;
  /** null/undefined = keep current stage (BR5) */
  newStage?: Stage | null;
}
```

```ts
  /** Evidence documents the meeting — attachable only while the visit is planned. */
  async addEvidence(visitId: string, input: { type: EvidenceType; name: string }): Promise<Evidence> {
    const visit = repository.getState().visits.find((v) => v.id === visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    if (visit.status === 'completed') throw new Error('VISIT_READ_ONLY');
    const evidence: Evidence = {
      id: crypto.randomUUID(),
      visitId,
      type: input.type,
      name: input.name,
      uploadedAt: new Date().toISOString(),
    };
    repository.setState((cur) => ({ ...cur, evidence: [...cur.evidence, evidence] }));
    return evidence;
  },

  async listEvidence(visitId: string): Promise<Evidence[]> {
    return repository.getState().evidence.filter((e) => e.visitId === visitId);
  },

  /** BR3–BR5: complete a visit; optional stage transition gated on ≥1 evidence. */
  async complete(input: CompleteVisitInput): Promise<Visit> {
    const db = repository.getState();
    const visit = db.visits.find((v) => v.id === input.visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    if (visit.status === 'completed') throw new Error('VISIT_READ_ONLY');
    if (!input.result.trim()) throw new Error('RESULT_REQUIRED');

    const outlet = db.outlets.find((o) => o.id === visit.outletId);
    if (!outlet) throw new Error('OUTLET_NOT_FOUND');

    const transitioning = input.newStage != null && input.newStage !== outlet.currentStage;
    if (transitioning && db.evidence.filter((e) => e.visitId === visit.id).length === 0) {
      throw new Error('EVIDENCE_REQUIRED'); // BR3
    }

    const now = new Date().toISOString();
    const completed: Visit = { ...visit, status: 'completed', result: input.result, resultNotes: input.resultNotes, updatedAt: now };

    // BR4: completion + stage change + history append in one atomic state transition
    repository.setState((cur) => ({
      ...cur,
      visits: cur.visits.map((v) => (v.id === visit.id ? completed : v)),
      outlets: transitioning
        ? cur.outlets.map((o) => (o.id === outlet.id ? { ...o, currentStage: input.newStage!, updatedAt: now } : o))
        : cur.outlets,
      stageHistory: transitioning
        ? [
            ...cur.stageHistory,
            { id: crypto.randomUUID(), outletId: outlet.id, visitId: visit.id, fromStage: outlet.currentStage, toStage: input.newStage!, changedBy: visit.salesRep, changedAt: now },
          ]
        : cur.stageHistory,
    }));

    return completed;
  },

  /** A4: cancelling the plan removes planned visits only; completed history is immutable. */
  async deletePlannedForOutlet(outletId: string): Promise<void> {
    repository.setState((cur) => ({
      ...cur,
      visits: cur.visits.filter((v) => !(v.outletId === outletId && v.status === 'planned')),
    }));
  },
```

`src/services/stageService.ts`:
```ts
import { repository } from '../store/repository';
import type { StageHistory } from '../domain/types';

export const stageService = {
  async historyForOutlet(outletId: string): Promise<StageHistory[]> {
    return repository
      .getState()
      .stageHistory.filter((h) => h.outletId === outletId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  },
};
```

- [ ] **Step 4: Run tests** — `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/services && git commit -m "feat: visit completion with evidence gate, atomic stage history (BR3-BR5)"
```

---

### Task 7: outletService — save + BR1 + A4 (TDD)

**Files:**
- Create: `src/services/outletService.ts`
- Test: `src/services/__tests__/outletService.test.ts`

**Interfaces:**
- Produces:
  - `OutletInput { id?: string; name; address; channel: Channel; tier: Tier; salesRep: string; currentStage: Stage; notes?: string }`
  - `ScheduleFields = Omit<ScheduleVisitInput, 'outletId' | 'salesRep'>`
  - `outletService.save(input: OutletInput, schedule: ScheduleFields | null): Promise<Outlet>`
  - `outletService.list(): Promise<Outlet[]>`, `outletService.get(id): Promise<Outlet | undefined>`

- [ ] **Step 1: Write the failing tests** (spec §10 test 5 + BR1)

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { outletService } from '../outletService';
import { repository } from '../../store/repository';
import { makeOutlet, makeVisit, resetDB } from './helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const baseInput = {
  name: 'Test Cafe', address: '1 Test St', channel: 'Cafe', tier: 'B',
  salesRep: 'Phúc', currentStage: 'SQL',
} as const;

describe('outletService.save', () => {
  it('creating an outlet with a schedule creates a Queued visit (BR1)', async () => {
    resetDB();
    const outlet = await outletService.save(
      { ...baseInput },
      { visitDate: '2026-08-01', targetStage: 'CustomerSampling', objective: 'Intro visit' },
    );
    const visits = repository.getState().visits;
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({
      outletId: outlet.id, salesRep: 'Phúc', status: 'planned',
      misaSyncStatus: 'Queued', currentStageSnapshot: 'SQL',
    });
  });

  it('editing with "schedule a visit" unchecked deletes planned visits, preserves completed (A4)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [
        makeVisit({ id: 'v-planned', status: 'planned', visitDate: '2026-07-20' }),
        makeVisit({ id: 'v-done', status: 'completed', visitDate: '2026-07-01' }),
      ],
    });
    await outletService.save({ id: 'o1', ...baseInput }, null);
    expect(repository.getState().visits.map((v) => v.id)).toEqual(['v-done']);
  });

  it('creating without a schedule creates no visit', async () => {
    resetDB();
    await outletService.save({ ...baseInput }, null);
    expect(repository.getState().visits).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL: cannot resolve `../outletService`.

- [ ] **Step 3: Implement `src/services/outletService.ts`**

```ts
import { repository } from '../store/repository';
import { visitService, type ScheduleVisitInput } from './visitService';
import type { Channel, Outlet, Stage, Tier } from '../domain/types';

export interface OutletInput {
  id?: string;
  name: string;
  address: string;
  channel: Channel;
  tier: Tier;
  salesRep: string;
  currentStage: Stage;
  notes?: string;
}

export type ScheduleFields = Omit<ScheduleVisitInput, 'outletId' | 'salesRep'>;

export const outletService = {
  async list(): Promise<Outlet[]> {
    return [...repository.getState().outlets].sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: string): Promise<Outlet | undefined> {
    return repository.getState().outlets.find((o) => o.id === id);
  },

  /**
   * Save an outlet. `schedule` carries the visit fields when "Schedule a visit"
   * is checked, or null when unchecked — which cancels remaining planned
   * visits for the outlet (A4); completed visits are immutable history.
   */
  async save(input: OutletInput, schedule: ScheduleFields | null): Promise<Outlet> {
    const now = new Date().toISOString();
    let outlet: Outlet;

    if (input.id) {
      const existing = repository.getState().outlets.find((o) => o.id === input.id);
      if (!existing) throw new Error('OUTLET_NOT_FOUND');
      outlet = { ...existing, ...input, id: existing.id, updatedAt: now };
      repository.setState((cur) => ({
        ...cur,
        outlets: cur.outlets.map((o) => (o.id === outlet.id ? outlet : o)),
      }));
    } else {
      outlet = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      repository.setState((cur) => ({ ...cur, outlets: [...cur.outlets, outlet] }));
    }

    if (schedule) {
      await visitService.upsertPlanned({ outletId: outlet.id, salesRep: outlet.salesRep, ...schedule }); // BR1
    } else if (input.id) {
      await visitService.deletePlannedForOutlet(outlet.id); // A4
    }
    return outlet;
  },
};
```

- [ ] **Step 4: Run tests** — `npm test` → all pass (spec §10 unit tests 1–5 now all covered).

- [ ] **Step 5: Commit**

```bash
git add src/services && git commit -m "feat: outlet save with auto-scheduled visit (BR1) and plan-cancel rule (A4)"
```

---

### Task 8: App shell — router, nav, global CSS, hook, badges

**Files:**
- Modify: `src/App.tsx`, `src/index.css`
- Create: `src/hooks/useDB.ts`, `src/components/StageBadge.tsx`, `src/components/StageBadge.module.css`, `src/components/SyncBadge.tsx`, `src/components/SyncBadge.module.css`
- Create stubs: `src/pages/OutletListPage.tsx`, `src/pages/OutletFormPage.tsx`, `src/pages/SchedulePage.tsx`, `src/pages/VisitDetailPage.tsx` (each `export function XPage() { return <h1>…</h1>; }` — replaced in Tasks 9–12)

**Interfaces:**
- Produces: `useDB(): DB`; `<StageBadge stage={Stage} />`; `<SyncBadge visit={Visit} />` (renders Retry button on Failed); routes `/outlets`, `/outlets/new`, `/outlets/:id/edit`, `/schedule`, `/visits/:id`; global CSS classes `.page-header`, `.table`, `.table-clickable`, `.btn`, `.btn-primary`, `.field`, `.error-text`, `.warning-text`, `.card`.

- [ ] **Step 1: `src/hooks/useDB.ts`**

```ts
import { useSyncExternalStore } from 'react';
import { repository } from '../store/repository';
import type { DB } from '../domain/types';

export function useDB(): DB {
  return useSyncExternalStore(repository.subscribe, repository.getState);
}
```

- [ ] **Step 2: `src/App.tsx`**

```tsx
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { OutletListPage } from './pages/OutletListPage';
import { OutletFormPage } from './pages/OutletFormPage';
import { SchedulePage } from './pages/SchedulePage';
import { VisitDetailPage } from './pages/VisitDetailPage';

export default function App() {
  return (
    <div className="app">
      <nav className="topnav">
        <span className="brand">Magnolia Sales</span>
        <NavLink to="/outlets">Outlets</NavLink>
        <NavLink to="/schedule">Working Schedule</NavLink>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/outlets" replace />} />
          <Route path="/outlets" element={<OutletListPage />} />
          <Route path="/outlets/new" element={<OutletFormPage />} />
          <Route path="/outlets/:id/edit" element={<OutletFormPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/visits/:id" element={<VisitDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Badges**

`src/components/StageBadge.tsx`:
```tsx
import type { Stage } from '../domain/types';
import { STAGE_LABELS } from '../domain/types';
import styles from './StageBadge.module.css';

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`${styles.badge} ${styles[stage]}`}>{STAGE_LABELS[stage]}</span>;
}
```

`src/components/StageBadge.module.css` (one class per stage value — class names must match the enum exactly):
```css
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.RawLead { background: #e5e7eb; color: #374151; }
.SQL { background: #dbeafe; color: #1d4ed8; }
.CustomerSampling { background: #fef3c7; color: #b45309; }
.ProposalSent { background: #ede9fe; color: #6d28d9; }
.Won { background: #d1fae5; color: #047857; }
.Lost { background: #fee2e2; color: #b91c1c; }
```

`src/components/SyncBadge.tsx`:
```tsx
import type { Visit } from '../domain/types';
import { syncService } from '../services/syncService';
import styles from './SyncBadge.module.css';

export function SyncBadge({ visit }: { visit: Visit }) {
  return (
    <span className={`${styles.badge} ${styles[visit.misaSyncStatus]}`}>
      {visit.misaSyncStatus}
      {visit.misaSyncStatus === 'Failed' && (
        <button
          className={styles.retry}
          onClick={(e) => {
            e.stopPropagation();
            syncService.retry(visit.id);
          }}
        >
          Retry
        </button>
      )}
    </span>
  );
}
```

`src/components/SyncBadge.module.css`:
```css
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.Queued { background: #fef9c3; color: #a16207; }
.Synced { background: #d1fae5; color: #047857; }
.Failed { background: #fee2e2; color: #b91c1c; }
.retry { border: 1px solid currentColor; background: transparent; color: inherit; border-radius: 999px; font-size: 11px; padding: 0 8px; cursor: pointer; }
```

- [ ] **Step 4: `src/index.css`** (global tokens + shared classes)

```css
:root {
  --bg: #f8fafc; --surface: #ffffff; --border: #e2e8f0;
  --text: #0f172a; --muted: #64748b;
  --primary: #2563eb; --danger: #dc2626; --warning: #b45309;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
.topnav { display: flex; align-items: center; gap: 20px; padding: 12px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
.topnav .brand { font-weight: 700; margin-right: 12px; }
.topnav a { color: var(--muted); text-decoration: none; font-weight: 500; }
.topnav a.active { color: var(--primary); }
.content { max-width: 1100px; margin: 0 auto; padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
.table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.table th, .table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 14px; }
.table th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.table-clickable tbody tr { cursor: pointer; }
.table-clickable tbody tr:hover { background: var(--bg); }
.btn { display: inline-block; padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 14px; cursor: pointer; text-decoration: none; color: var(--text); }
.btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.field label { font-size: 13px; font-weight: 600; }
.field input, .field select, .field textarea { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font: inherit; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.error-text { color: var(--danger); font-size: 13px; }
.warning-text { color: var(--warning); font-size: 13px; }
.muted { color: var(--muted); font-size: 13px; }
```

- [ ] **Step 5: Create the four page stubs, verify, commit**

Run: `npx tsc --noEmit` → clean. `npm run dev` → nav renders, routes switch between stub headings.
```bash
git add src && git commit -m "feat: app shell with router, useDB hook, stage/sync badges, global styles"
```

---

### Task 9: Outlet list page

**Files:**
- Modify: `src/pages/OutletListPage.tsx`

**Interfaces:**
- Consumes: `useDB`, `StageBadge`. Route `/outlets` (spec §8 screen 1).

- [ ] **Step 1: Implement**

```tsx
import { Link } from 'react-router-dom';
import { useDB } from '../hooks/useDB';
import { StageBadge } from '../components/StageBadge';

export function OutletListPage() {
  const { outlets } = useDB();
  const sorted = [...outlets].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section>
      <header className="page-header">
        <h1>C.A Outlets</h1>
        <Link className="btn btn-primary" to="/outlets/new">+ New outlet</Link>
      </header>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Channel</th><th>Tier</th><th>Sales rep</th><th>Stage</th></tr>
        </thead>
        <tbody>
          {sorted.map((o) => (
            <tr key={o.id}>
              <td><Link to={`/outlets/${o.id}/edit`}>{o.name}</Link></td>
              <td>{o.channel}</td>
              <td>{o.tier}</td>
              <td>{o.salesRep}</td>
              <td><StageBadge stage={o.currentStage} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Verify & commit**

`npm run dev` → 3 seeded outlets render with stage badges; name links to edit route (stub).
```bash
git add src/pages/OutletListPage.tsx && git commit -m "feat: outlet list screen"
```

---

### Task 10: Outlet form page (create/edit + schedule-a-visit)

**Files:**
- Modify: `src/pages/OutletFormPage.tsx`

**Interfaces:**
- Consumes: `outletService.save(input, schedule | null)`, `useDB`, constants from `domain/types`.
- Behavior (spec §8 screen 2 + validation summary): required outlet fields; conditional visit section; past-date **warning** (A5); target==current **warning** (§8); edit mode prefills from the outlet's earliest planned visit; unchecking on edit cancels planned visits (via `schedule: null`).

- [ ] **Step 1: Implement**

```tsx
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CHANNELS, SALES_REPS, STAGES, STAGE_LABELS, TIERS } from '../domain/types';
import type { Channel, Stage, Tier } from '../domain/types';
import { useDB } from '../hooks/useDB';
import { outletService } from '../services/outletService';

export function OutletFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();
  const editing = db.outlets.find((o) => o.id === id);

  const existingPlan = useMemo(
    () =>
      db.visits
        .filter((v) => v.outletId === id && v.status === 'planned')
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate))[0],
    [db.visits, id],
  );

  const [form, setForm] = useState({
    name: editing?.name ?? '',
    address: editing?.address ?? '',
    channel: (editing?.channel ?? 'Cafe') as Channel,
    tier: (editing?.tier ?? 'B') as Tier,
    salesRep: editing?.salesRep ?? (SALES_REPS[0] as string),
    currentStage: (editing?.currentStage ?? 'RawLead') as Stage,
    notes: editing?.notes ?? '',
  });
  const [schedule, setSchedule] = useState(Boolean(existingPlan));
  const [visitDate, setVisitDate] = useState(existingPlan?.visitDate ?? '');
  const [targetStage, setTargetStage] = useState<Stage>(existingPlan?.targetStage ?? 'SQL');
  const [objective, setObjective] = useState(existingPlan?.objective ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (id && !editing) return <p>Outlet not found.</p>;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const today = new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];
  if (schedule && visitDate && visitDate < today)
    warnings.push('Visit date is in the past — allowed for after-the-fact logging, but double-check it.');
  if (schedule && targetStage === form.currentStage)
    warnings.push('Target stage equals the current stage — this visit plans no progression.');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    if (schedule && !visitDate) errs.visitDate = 'Visit date is required';
    if (schedule && !objective.trim()) errs.objective = 'Visit objective is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    await outletService.save(
      { id: editing?.id, ...form, notes: form.notes || undefined },
      schedule ? { visitDate, targetStage, objective } : null,
    );
    navigate(schedule ? '/schedule' : '/outlets');
  }

  return (
    <section>
      <header className="page-header">
        <h1>{editing ? `Edit — ${editing.name}` : 'New outlet'}</h1>
      </header>
      <form onSubmit={onSubmit} noValidate>
        <div className="card">
          <div className="field">
            <label>Name *</label>
            <input value={form.name} onChange={set('name')} />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>
          <div className="field">
            <label>Address *</label>
            <input value={form.address} onChange={set('address')} />
            {errors.address && <span className="error-text">{errors.address}</span>}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Channel *</label>
              <select value={form.channel} onChange={set('channel')}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Tier *</label>
              <select value={form.tier} onChange={set('tier')}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Sales rep *</label>
              <select value={form.salesRep} onChange={set('salesRep')}>
                {SALES_REPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Current stage *</label>
              <select value={form.currentStage} onChange={set('currentStage')}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Notes / next step</label>
            <textarea rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>

        <div className="card">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
            Schedule a visit (đi tuyến)
          </label>
          {schedule && (
            <div style={{ marginTop: 12 }}>
              <div className="field-row">
                <div className="field">
                  <label>Visit date *</label>
                  <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                  {errors.visitDate && <span className="error-text">{errors.visitDate}</span>}
                </div>
                <div className="field">
                  <label>Target stage *</label>
                  <select value={targetStage} onChange={(e) => setTargetStage(e.target.value as Stage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Visit objective *</label>
                <input value={objective} onChange={(e) => setObjective(e.target.value)} />
                {errors.objective && <span className="error-text">{errors.objective}</span>}
              </div>
            </div>
          )}
          {!schedule && existingPlan && (
            <p className="warning-text">Saving with this unchecked cancels the planned visit on {existingPlan.visitDate}. Completed visits are kept.</p>
          )}
          {warnings.map((w) => <p key={w} className="warning-text">⚠ {w}</p>)}
        </div>

        <button className="btn btn-primary" type="submit">Save outlet</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Verify & commit**

`npm run dev`: create an outlet with a visit → lands on schedule (stub for now, verify via localStorage or Task 11); edit Blue Lotus → schedule section prefilled from seeded planned visit; uncheck shows the cancel warning; empty name shows inline error; past date shows warning but saves.
```bash
git add src/pages/OutletFormPage.tsx && git commit -m "feat: outlet create/edit form with conditional visit scheduling and warnings"
```

---

### Task 11: Working Schedule page

**Files:**
- Modify: `src/pages/SchedulePage.tsx`

**Interfaces:**
- Consumes: `useDB`, `StageBadge`, `SyncBadge`. Route `/schedule`; row click → `/visits/:id` (spec §8 screen 3).

- [ ] **Step 1: Implement**

```tsx
import { useNavigate } from 'react-router-dom';
import { useDB } from '../hooks/useDB';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';

export function SchedulePage() {
  const db = useDB();
  const navigate = useNavigate();
  const visits = [...db.visits].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const outletById = new Map(db.outlets.map((o) => [o.id, o]));

  return (
    <section>
      <header className="page-header">
        <h1>Working Schedule</h1>
      </header>
      <table className="table table-clickable">
        <thead>
          <tr>
            <th>Date</th><th>Rep</th><th>Outlet</th><th>Address</th>
            <th>Stage (at planning)</th><th>Target</th><th>Objective</th><th>MISA</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => {
            const outlet = outletById.get(v.outletId);
            return (
              <tr key={v.id} onClick={() => navigate(`/visits/${v.id}`)}>
                <td>{v.visitDate}</td>
                <td>{v.salesRep}</td>
                <td>{outlet?.name ?? '—'}</td>
                <td>{outlet?.address ?? '—'}</td>
                <td><StageBadge stage={v.currentStageSnapshot} /></td>
                <td><StageBadge stage={v.targetStage} /></td>
                <td>{v.objective}</td>
                <td><SyncBadge visit={v} /></td>
                <td>{v.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Verify & commit**

`npm run dev`: seeded planned + completed visits render; create an outlet with a visit → new row appears with `Queued` badge that flips to `Synced`/`Failed` by itself after ~1.5s (this is the pub/sub payoff); on `Failed`, Retry re-runs without navigating.
```bash
git add src/pages/SchedulePage.tsx && git commit -m "feat: working schedule screen with live MISA sync badges and retry"
```

---

### Task 12: Visit detail page (completion flow + evidence gate + history)

**Files:**
- Modify: `src/pages/VisitDetailPage.tsx`

**Interfaces:**
- Consumes: `visitService.addEvidence`, `visitService.complete` (errors `'EVIDENCE_REQUIRED'`, `'RESULT_REQUIRED'`), `useDB`, `StageBadge`, `SyncBadge`, `EVIDENCE_TYPES`, `STAGES`, `STAGE_LABELS`.
- Behavior (spec §8 screen 4 + decision 3): planned → completion form (result required, evidence add row, "change stage" toggle disabled with explanation until ≥1 evidence, stage select defaults to `targetStage`); completed → read-only view; outlet stage history at the bottom.

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EVIDENCE_TYPES, STAGES, STAGE_LABELS } from '../domain/types';
import type { EvidenceType, Stage } from '../domain/types';
import { useDB } from '../hooks/useDB';
import { visitService } from '../services/visitService';
import { StageBadge } from '../components/StageBadge';
import { SyncBadge } from '../components/SyncBadge';

export function VisitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDB();

  const visit = db.visits.find((v) => v.id === id);
  const outlet = visit ? db.outlets.find((o) => o.id === visit.outletId) : undefined;
  const evidence = db.evidence.filter((e) => e.visitId === id);
  const history = outlet
    ? db.stageHistory
        .filter((h) => h.outletId === outlet.id)
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    : [];

  const [result, setResult] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [changeStage, setChangeStage] = useState(false);
  const [newStage, setNewStage] = useState<Stage>(visit?.targetStage ?? 'SQL');
  const [evType, setEvType] = useState<EvidenceType>('photo');
  const [evName, setEvName] = useState('');
  const [error, setError] = useState('');

  if (!visit || !outlet) return <p>Visit not found.</p>;

  const readOnly = visit.status === 'completed';
  const hasEvidence = evidence.length > 0;

  async function addEvidence() {
    if (!evName.trim()) return;
    await visitService.addEvidence(visit!.id, { type: evType, name: evName.trim() });
    setEvName('');
  }

  async function save() {
    setError('');
    try {
      await visitService.complete({
        visitId: visit!.id,
        result,
        resultNotes: resultNotes || undefined,
        newStage: changeStage ? newStage : null,
      });
      navigate('/schedule');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message === 'EVIDENCE_REQUIRED'
          ? 'Stage change blocked: attach at least one piece of evidence first (BR3).'
          : message === 'RESULT_REQUIRED'
            ? 'Result is required to complete a visit.'
            : message,
      );
    }
  }

  return (
    <section>
      <header className="page-header">
        <h1>Visit — {outlet.name}</h1>
        <SyncBadge visit={visit} />
      </header>

      <div className="card">
        <p><strong>{visit.visitDate}</strong> · {visit.salesRep} · {outlet.address}</p>
        <p>
          Stage at planning: <StageBadge stage={visit.currentStageSnapshot} />{' '}
          → target: <StageBadge stage={visit.targetStage} />{' '}
          · outlet now: <StageBadge stage={outlet.currentStage} />
        </p>
        <p className="muted">Objective: {visit.objective}</p>
      </div>

      <div className="card">
        <h2>Evidence ({evidence.length})</h2>
        {evidence.length === 0 && <p className="muted">No evidence yet.</p>}
        <ul>
          {evidence.map((e) => <li key={e.id}>[{e.type}] {e.name}</li>)}
        </ul>
        {!readOnly && (
          <div className="field-row">
            <select value={evType} onChange={(e) => setEvType(e.target.value as EvidenceType)}>
              {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="filename or note text (mock)"
                value={evName}
                onChange={(e) => setEvName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn" onClick={addEvidence}>Add</button>
            </div>
          </div>
        )}
      </div>

      {readOnly ? (
        <div className="card">
          <h2>Result</h2>
          <p>{visit.result}</p>
          {visit.resultNotes && <p className="muted">{visit.resultNotes}</p>}
          <p className="muted">This visit is completed and read-only.</p>
        </div>
      ) : (
        <div className="card">
          <h2>Complete visit</h2>
          <div className="field">
            <label>Result *</label>
            <input value={result} onChange={(e) => setResult(e.target.value)} />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} />
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={changeStage}
              disabled={!hasEvidence}
              onChange={(e) => setChangeStage(e.target.checked)}
            />
            Change outlet stage
          </label>
          {!hasEvidence && (
            <p className="muted">Add at least one piece of evidence to unlock stage change (BR3).</p>
          )}
          {changeStage && (
            <div className="field" style={{ marginTop: 8 }}>
              <label>New stage (defaults to target)</label>
              <select value={newStage} onChange={(e) => setNewStage(e.target.value as Stage)}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" style={{ marginTop: 12 }} type="button" onClick={save}>
            Complete visit
          </button>
        </div>
      )}

      <div className="card">
        <h2>Stage history — {outlet.name}</h2>
        {history.length === 0 && <p className="muted">No transitions yet.</p>}
        <table className="table">
          <thead><tr><th>When</th><th>From</th><th>To</th><th>By</th><th>Visit</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.changedAt).toLocaleString()}</td>
                <td><StageBadge stage={h.fromStage} /></td>
                <td><StageBadge stage={h.toStage} /></td>
                <td>{h.changedBy}</td>
                <td className="muted">{h.visitId.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify & commit**

`npm run dev`: open the seeded planned visit → stage-change checkbox disabled with the BR3 hint; add evidence → unlocks, defaulting the select to target stage; complete with stage change → redirected to schedule, outlet list shows new stage, history row visible on the completed visit; the seeded completed visit renders read-only.
```bash
git add src/pages/VisitDetailPage.tsx && git commit -m "feat: visit detail with evidence-gated stage transition and history"
```

---

### Task 13: README + full verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** — short: what the module is (link to Spec.md), `npm install && npm run dev`, `npm test`, the manual demo script from spec §10, and the assumptions/decisions list (A1–A10 + the four brainstorming decisions from the Context section above, including the read-only-after-completion rule and the date-change quirk).

- [ ] **Step 2: Full verification**

- `npm test` → all suites pass (repository, syncService, visitService ×7, outletService ×3).
- `npm run build` → tsc + vite build clean.
- Run the manual demo script (spec §10) end to end in the browser:
  1. Create outlet with visit → schedule row appears, `Queued` → `Synced`/`Failed` on its own.
  2. Re-save same outlet + same date → row updated, no duplicate.
  3. Open visit → stage change with no evidence → blocked with clear message.
  4. Add evidence → change stage → outlet stage updated, history entry visible.
  5. Retry a `Failed` sync (if none occurred, temporarily accept — 20% chance per sync; re-save to roll again).
  6. Reload the page → state persists via localStorage.

- [ ] **Step 3: Commit**

```bash
git add README.md && git commit -m "docs: README with run instructions and demo script"
```

---

## Verification (overall)

- **Unit (spec §10, tests 1–5):** `npm test` — upsert update, upsert-past-completed creates new, evidence gate reject/accept, completion without transition, uncheck-schedule deletion. All implemented in Tasks 3–7 with TDD.
- **Types/build:** `npm run build` must pass (`tsc` strict).
- **Manual (spec §10 demo script):** steps listed in Task 13 — exercises BR1–BR6 end to end, including the async sync badge and retry.

