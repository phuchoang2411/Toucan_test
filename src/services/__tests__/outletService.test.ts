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