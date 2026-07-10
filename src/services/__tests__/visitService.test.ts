import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { visitService } from '../visitService';
import { repository } from '../../store/repository';
import { makeEvidence, makeOutlet, makeVisit, resetDB } from './helpers';

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

  it('rescheduling (existingVisitId, new date) moves the plan in place instead of forking', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ misaSyncStatus: 'Synced' })],
      evidence: [makeEvidence()],
    });
    const { visit, created } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-07-15',
      targetStage: 'ProposalSent', objective: 'Rescheduled meeting',
      existingVisitId: 'v1',
    });
    expect(created).toBe(false);
    expect(visit.id).toBe('v1');
    expect(visit.visitDate).toBe('2026-07-15');
    const db = repository.getState();
    expect(db.visits).toHaveLength(1);
    expect(db.visits[0].visitDate).toBe('2026-07-15');
    expect(db.visits[0].misaSyncStatus).toBe('Queued');
    expect(db.evidence.map((e) => e.visitId)).toEqual(['v1']); // evidence follows the moved row
  });

  it('rescheduling onto a date another planned visit already occupies is rejected, not silently merged', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [
        makeVisit({ id: 'v1', visitDate: '2026-07-10' }),
        makeVisit({ id: 'v2', visitDate: '2026-07-20' }),
      ],
    });
    await expect(
      visitService.upsertPlanned({
        outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-07-20',
        targetStage: 'ProposalSent', objective: 'Move onto occupied date',
        existingVisitId: 'v1',
      }),
    ).rejects.toThrow('DATE_ALREADY_PLANNED');
    const db = repository.getState();
    expect(db.visits.map((v) => ({ id: v.id, date: v.visitDate }))).toEqual([
      { id: 'v1', date: '2026-07-10' },
      { id: 'v2', date: '2026-07-20' },
    ]);
  });

  it('changing the sales rep on an outlet reassigns the planned visit it is bound to (visit follows the outlet)', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })], visits: [makeVisit({ salesRep: 'Phúc', misaSyncStatus: 'Synced' })] });
    const { visit, created } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Linh', visitDate: '2026-07-10',
      targetStage: 'ProposalSent', objective: 'Reassigned to new rep',
      existingVisitId: 'v1',
    });
    expect(created).toBe(false);
    expect(visit.id).toBe('v1');
    expect(visit.salesRep).toBe('Linh');
    const db = repository.getState();
    expect(db.visits).toHaveLength(1);
    expect(db.visits[0].salesRep).toBe('Linh');
    expect(db.visits[0].misaSyncStatus).toBe('Queued');
  });

  it('reassigning onto a rep+date another planned visit already occupies is rejected', async () => {
    resetDB({
      outlets: [makeOutlet({ salesRep: 'Linh' })],
      visits: [
        makeVisit({ id: 'v1', salesRep: 'Phúc', visitDate: '2026-07-10' }),
        makeVisit({ id: 'v2', salesRep: 'Linh', visitDate: '2026-07-10' }),
      ],
    });
    await expect(
      visitService.upsertPlanned({
        outletId: 'o1', salesRep: 'Linh', visitDate: '2026-07-10',
        targetStage: 'ProposalSent', objective: 'Reassign onto occupied slot',
        existingVisitId: 'v1',
      }),
    ).rejects.toThrow('DATE_ALREADY_PLANNED');
    const db = repository.getState();
    expect(db.visits.map((v) => ({ id: v.id, rep: v.salesRep }))).toEqual([
      { id: 'v1', rep: 'Phúc' },
      { id: 'v2', rep: 'Linh' },
    ]);
  });

  it('saving on the same date with existingVisitId still just updates in place (no move needed)', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit()] });
    const { visit, created } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-07-10',
      targetStage: 'Won', objective: 'Same date re-save',
      existingVisitId: 'v1',
    });
    expect(created).toBe(false);
    expect(visit.id).toBe('v1');
    expect(repository.getState().visits).toHaveLength(1);
  });
});

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

  it('completion enqueues the visit for sync (L4)', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ misaSyncStatus: 'Synced' })] });
    const visit = await visitService.complete({ visitId: 'v1', result: 'Done' });
    expect(visit.misaSyncStatus).toBe('Queued');
    expect(repository.getState().visits[0].misaSyncStatus).toBe('Queued');
    vi.advanceTimersByTime(1500);
    const resolved = repository.getState().visits[0].misaSyncStatus;
    expect(['Synced', 'Failed']).toContain(resolved);
  });

  it('completed visits are read-only: no re-complete, no late evidence', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ status: 'completed' })] });
    await expect(visitService.complete({ visitId: 'v1', result: 'again' })).rejects.toThrow('VISIT_READ_ONLY');
    await expect(visitService.addEvidence('v1', { type: 'note', name: 'late note' })).rejects.toThrow('VISIT_READ_ONLY');
  });
});

describe('visitService.cancelPlannedForOutlet (A4 rework)', () => {
  it('sets planned visits to cancelled, preserves evidence', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [
        makeVisit({ id: 'v-planned', status: 'planned' }),
      ],
      evidence: [makeEvidence({ id: 'e-planned', visitId: 'v-planned' })],
    });
    await visitService.cancelPlannedForOutlet('o1');
    const db = repository.getState();
    expect(db.visits).toHaveLength(1);
    expect(db.visits[0].status).toBe('cancelled');
    expect(db.visits[0].cancelReason).toBe('Unscheduled from outlet form');
    expect(db.evidence).toHaveLength(1); // evidence preserved
  });

  it('completed visits are untouched by cancellation', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [
        makeVisit({ id: 'v-planned', status: 'planned' }),
        makeVisit({ id: 'v-done', status: 'completed' }),
      ],
      evidence: [
        makeEvidence({ id: 'e-planned', visitId: 'v-planned' }),
        makeEvidence({ id: 'e-done', visitId: 'v-done' }),
      ],
    });
    await visitService.cancelPlannedForOutlet('o1');
    const db = repository.getState();
    expect(db.visits.find((v) => v.id === 'v-done')!.status).toBe('completed');
    expect(db.visits.find((v) => v.id === 'v-planned')!.status).toBe('cancelled');
    expect(db.visits.find((v) => v.id === 'v-planned')!.cancelReason).toBe('Unscheduled from outlet form');
    expect(db.evidence).toHaveLength(2);
  });

  it('cancelled visits reject addEvidence with VISIT_READ_ONLY', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ status: 'cancelled' })],
    });
    await expect(
      visitService.addEvidence('v1', { type: 'note', name: 'late' }),
    ).rejects.toThrow('VISIT_READ_ONLY');
  });

  it('cancelled visits reject complete with VISIT_READ_ONLY', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ status: 'cancelled' })],
    });
    await expect(
      visitService.complete({ visitId: 'v1', result: 'nope' }),
    ).rejects.toThrow('VISIT_READ_ONLY');
  });

  it('upsertPlanned on same (rep, outlet, date) as a cancelled visit creates a new plan (dedup not blocked)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ status: 'cancelled' })],
    });
    const { created } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Phúc', visitDate: '2026-07-10',
      targetStage: 'ProposalSent', objective: 'New plan after cancel',
    });
    expect(created).toBe(true);
    expect(repository.getState().visits).toHaveLength(2);
  });

  it('cancel re-queues MISA and resolves after 1.5s fake timers', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ misaSyncStatus: 'Synced' })],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await visitService.cancelPlannedForOutlet('o1');
    expect(repository.getState().visits[0].misaSyncStatus).toBe('Queued');
    expect(repository.getState().visits[0].status).toBe('cancelled');
    vi.advanceTimersByTime(1500);
    expect(['Synced', 'Failed']).toContain(repository.getState().visits[0].misaSyncStatus);
  });
});

describe('visitService.cancelVisit', () => {
  it('cancels a planned visit with reason + note, preserves evidence', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'planned', misaSyncStatus: 'Synced' })],
      evidence: [makeEvidence({ id: 'e1', visitId: 'v1' })],
    });
    await visitService.cancelVisit('v1', 'No-show', 'Customer did not answer door');
    const db = repository.getState();
    expect(db.visits).toHaveLength(1);
    expect(db.visits[0].status).toBe('cancelled');
    expect(db.visits[0].cancelReason).toBe('No-show');
    expect(db.visits[0].cancelNote).toBe('Customer did not answer door');
    expect(db.evidence).toHaveLength(1);
    expect(db.visits[0].misaSyncStatus).toBe('Queued');
  });

  it('cancels with reason Other and free-text note', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'planned' })],
    });
    await visitService.cancelVisit('v1', 'Other', 'Owner requested postponement via phone');
    const db = repository.getState();
    expect(db.visits[0].cancelReason).toBe('Other');
    expect(db.visits[0].cancelNote).toBe('Owner requested postponement via phone');
  });

  it('cancels without optional note', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'planned' })],
    });
    await visitService.cancelVisit('v1', 'Customer postponed');
    const db = repository.getState();
    expect(db.visits[0].cancelReason).toBe('Customer postponed');
    expect(db.visits[0].cancelNote).toBeUndefined();
  });

  it('throws VISIT_READ_ONLY for completed visits', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'completed' })],
    });
    await expect(visitService.cancelVisit('v1', 'No-show')).rejects.toThrow('VISIT_READ_ONLY');
  });

  it('throws VISIT_READ_ONLY for already cancelled visits', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'cancelled' })],
    });
    await expect(visitService.cancelVisit('v1', 'No-show')).rejects.toThrow('VISIT_READ_ONLY');
  });

  it('enqueues sync cancel and resolves after 1.5s', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'planned', misaSyncStatus: 'Synced' })],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await visitService.cancelVisit('v1', 'Customer postponed');
    expect(repository.getState().visits[0].misaSyncStatus).toBe('Queued');
    vi.advanceTimersByTime(1500);
    expect(['Synced', 'Failed']).toContain(repository.getState().visits[0].misaSyncStatus);
  });
});