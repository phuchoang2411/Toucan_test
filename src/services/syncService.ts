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