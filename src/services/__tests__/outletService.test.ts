import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { outletService } from '../outletService';
import { repository } from '../../store/repository';
import { MANAGER, REP_LINH, makeOutlet, makeVisit, resetDB, resetSession } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
  resetSession(); // defaults to Phúc (rep)
});
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

describe('outletService authorization (A9 rework)', () => {
  it('a rep creating an outlet is forced onto themself regardless of the submitted salesRep', async () => {
    resetDB();
    const outlet = await outletService.save({ ...baseInput, salesRep: 'Linh' }, null);
    expect(outlet.salesRep).toBe('Phúc');
  });

  it('a manager can create an outlet assigned to any rep', async () => {
    resetDB();
    resetSession(MANAGER);
    const outlet = await outletService.save({ ...baseInput, salesRep: 'Linh' }, null);
    expect(outlet.salesRep).toBe('Linh');
  });

  it('a rep cannot edit another rep\'s outlet', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })] });
    await expect(
      outletService.save({ id: 'o1', ...baseInput, salesRep: 'Linh' }, null),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('a rep cannot reassign their own outlet to another rep', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Phúc' })] });
    await expect(
      outletService.save({ id: 'o1', ...baseInput, salesRep: 'Linh' }, null),
    ).rejects.toThrow('FORBIDDEN_REASSIGN');
  });

  it('a manager can reassign an outlet to a different rep', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Phúc' })] });
    resetSession(MANAGER);
    const outlet = await outletService.save({ id: 'o1', ...baseInput, salesRep: 'Linh' }, null);
    expect(outlet.salesRep).toBe('Linh');
  });

  it('outletService.list only returns a rep\'s own outlets; a manager sees all', async () => {
    resetDB({ outlets: [makeOutlet({ id: 'o1', salesRep: 'Phúc' }), makeOutlet({ id: 'o2', salesRep: 'Linh' })] });
    expect((await outletService.list()).map((o) => o.id)).toEqual(['o1']);
    resetSession(MANAGER);
    expect((await outletService.list()).map((o) => o.id).sort()).toEqual(['o1', 'o2']);
  });

  it('outletService.get returns undefined for another rep\'s outlet', async () => {
    resetDB({ outlets: [makeOutlet({ id: 'o1', salesRep: 'Linh' })] });
    expect(await outletService.get('o1')).toBeUndefined();
    resetSession(REP_LINH);
    expect(await outletService.get('o1')).toBeDefined();
  });
});