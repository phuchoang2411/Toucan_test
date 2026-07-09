import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncService } from '../syncService';
import { repository } from '../../store/repository';
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

  it('resumePending re-enqueues visits stuck Queued from a previous session (M1)', () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ misaSyncStatus: 'Queued' })] });
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // success
    syncService.resumePending();
    expect(syncService.getStatus('v1')).toBe('Queued');
    vi.advanceTimersByTime(1500);
    expect(syncService.getStatus('v1')).toBe('Synced');
  });

  it('resumePending ignores visits already resolved', () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v-synced', misaSyncStatus: 'Synced' }), makeVisit({ id: 'v-failed', misaSyncStatus: 'Failed' })],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    let notified = 0;
    repository.subscribe(() => notified++);
    syncService.resumePending();
    expect(notified).toBe(0); // no state change (nothing to re-enqueue)
    vi.advanceTimersByTime(1500);
    expect(syncService.getStatus('v-synced')).toBe('Synced');
    expect(syncService.getStatus('v-failed')).toBe('Failed');
  });

  it('overlapping enqueues for the same visit do not double-resolve (L2)', () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ misaSyncStatus: 'Synced' })] });
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // success
    syncService.enqueue('v1'); // timer A fires at t=1500
    vi.advanceTimersByTime(500); // t=500
    syncService.enqueue('v1'); // re-save: clears timer A, timer B fires at t=2000
    vi.advanceTimersByTime(1000); // t=1500 — old timer A's deadline; must still be Queued
    expect(syncService.getStatus('v1')).toBe('Queued');
    vi.advanceTimersByTime(500); // t=2000 — timer B fires exactly once
    expect(syncService.getStatus('v1')).toBe('Synced');
  });
});