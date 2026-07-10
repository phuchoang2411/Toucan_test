import { repository } from '../store/repository';
import type { SyncStatus } from '../domain/types';

/** Port — the only thing business logic may depend on (BR6, §6). */
export interface SyncService {
  enqueue(visitId: string): void;
  retry(visitId: string): void;
  getStatus(visitId: string): SyncStatus;
  /** Sends a MISA cancellation for the visit. Mock delegates to enqueue (same
   * 1.5s resolution, same 80/20 roll). A real adapter would POST a cancel
   * payload instead of an upsert. Retry on a cancelled+Failed row re-sends the
   * cancel; resumePending re-enqueues an interrupted cancellation. */
  cancel(visitId: string): void;
  /** Re-enqueue visits still `Queued` from a previous session (e.g. after reload). */
  resumePending(): void;
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
  /** Outstanding timer per visit; re-enqueue clears the previous timer (L2). */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  enqueue(visitId: string): void {
    const existing = this.timers.get(visitId);
    if (existing) clearTimeout(existing);
    setStatus(visitId, 'Queued');
    const timer = setTimeout(() => {
      setStatus(visitId, Math.random() < SUCCESS_RATE ? 'Synced' : 'Failed');
      this.timers.delete(visitId);
    }, SYNC_DELAY_MS);
    this.timers.set(visitId, timer);
  }
  cancel(visitId: string): void {
    this.enqueue(visitId);
  }
  retry(visitId: string): void {
    this.enqueue(visitId);
  }
  getStatus(visitId: string): SyncStatus {
    const visit = repository.getState().visits.find((v) => v.id === visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    return visit.misaSyncStatus;
  }
  resumePending(): void {
    for (const visit of repository.getState().visits) {
      if (visit.misaSyncStatus === 'Queued') this.enqueue(visit.id); // re-roll the outbox
    }
  }
}

export const syncService: SyncService = new MockMisaAdapter();