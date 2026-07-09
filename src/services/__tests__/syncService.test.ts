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