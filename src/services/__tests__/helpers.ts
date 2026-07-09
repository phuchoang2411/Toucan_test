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