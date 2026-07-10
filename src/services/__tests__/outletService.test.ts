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

  it('editing with "schedule a visit" unchecked cancels planned visits, preserves completed (A4 rework)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [
        makeVisit({ id: 'v-planned', status: 'planned', visitDate: '2026-07-20' }),
        makeVisit({ id: 'v-done', status: 'completed', visitDate: '2026-07-01' }),
      ],
    });
    await outletService.save({ id: 'o1', ...baseInput }, null);
    const visits = repository.getState().visits;
    expect(visits).toHaveLength(2);
    expect(visits.find((v) => v.id === 'v-planned')!.status).toBe('cancelled');
    expect(visits.find((v) => v.id === 'v-done')!.status).toBe('completed');
  });

  it('editing an outlet does not change currentStage (M3)', async () => {
    resetDB({
      outlets: [makeOutlet({ currentStage: 'SQL' })],
      visits: [],
    });
    await outletService.save({ id: 'o1', ...baseInput, currentStage: 'Won', name: 'Renamed' }, null);
    const outlet = repository.getState().outlets[0];
    expect(outlet.currentStage).toBe('SQL');
    expect(outlet.name).toBe('Renamed');
  });

  it('creating without a schedule creates no visit', async () => {
    resetDB();
    await outletService.save({ ...baseInput }, null);
    expect(repository.getState().visits).toHaveLength(0);
  });
});