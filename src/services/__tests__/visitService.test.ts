import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { visitService } from '../visitService';
import { repository } from '../../store/repository';
import { MANAGER, makeEvidence, makeOutlet, makeVisit, resetDB, resetSession } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
  // Pinned to match makeVisit()'s default visitDate so BR7's date-mismatch gate
  // doesn't misfire based on whatever day the suite happens to run.
  vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
  resetSession(); // defaults to Phúc (rep)
});
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

  it('changing the sales rep on an outlet reassigns the planned visit it is bound to (visit follows the outlet, manager-only per A9 rework)', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })], visits: [makeVisit({ salesRep: 'Phúc', misaSyncStatus: 'Synced' })] });
    resetSession(MANAGER);
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
    resetSession(MANAGER);
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

  it('allows completing without stage change and without evidence (BR5), still logging a held-stage history row (BR4)', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit()] });
    const visit = await visitService.complete({ visitId: 'v1', result: 'Owner away, rescheduled' });
    expect(visit.status).toBe('completed');
    expect(repository.getState().outlets[0].currentStage).toBe('SQL');
    const db = repository.getState();
    expect(db.stageHistory).toHaveLength(1);
    expect(db.stageHistory[0]).toMatchObject({
      outletId: 'o1', visitId: 'v1', fromStage: 'SQL', toStage: 'SQL', changedBy: 'Phúc',
    });
  });

  it('completing with "change stage" explicitly kept at the same stage also logs a held-stage row (BR4)', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit()] });
    const visit = await visitService.complete({ visitId: 'v1', result: 'Discussed, no change', newStage: 'SQL' });
    expect(visit.status).toBe('completed');
    expect(repository.getState().outlets[0].currentStage).toBe('SQL');
    const db = repository.getState();
    expect(db.stageHistory).toHaveLength(1);
    expect(db.stageHistory[0]).toMatchObject({ fromStage: 'SQL', toStage: 'SQL' });
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

describe('visitService.complete — date mismatch gate (BR7)', () => {
  it('completing on the scheduled day needs no note', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ visitDate: '2026-07-10' })] });
    const visit = await visitService.complete({ visitId: 'v1', result: 'On time' });
    expect(visit.status).toBe('completed');
    expect(visit.dateMismatchNote).toBeUndefined();
  });

  it('completing on a different day without a note is rejected', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ visitDate: '2026-07-05' })] });
    await expect(
      visitService.complete({ visitId: 'v1', result: 'Late visit' }),
    ).rejects.toThrow('DATE_MISMATCH_NOTE_REQUIRED');
    expect(repository.getState().visits[0].status).toBe('planned');
  });

  it('completing on a different day with a note is accepted and the note is stored', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ visitDate: '2026-07-05' })] });
    const visit = await visitService.complete({
      visitId: 'v1',
      result: 'Late visit',
      dateMismatchNote: 'Customer rescheduled on-site',
    });
    expect(visit.status).toBe('completed');
    expect(visit.dateMismatchNote).toBe('Customer rescheduled on-site');
    expect(repository.getState().visits[0].dateMismatchNote).toBe('Customer rescheduled on-site');
  });

  it('a whitespace-only note does not satisfy the gate', async () => {
    resetDB({ outlets: [makeOutlet()], visits: [makeVisit({ visitDate: '2026-07-05' })] });
    await expect(
      visitService.complete({ visitId: 'v1', result: 'Late visit', dateMismatchNote: '   ' }),
    ).rejects.toThrow('DATE_MISMATCH_NOTE_REQUIRED');
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

describe('visitService.reschedule', () => {
  it('moves a planned visit to a new date, keeps same id and evidence', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-12', misaSyncStatus: 'Synced' })],
      evidence: [makeEvidence({ id: 'e1', visitId: 'v1' })],
    });
    const visit = await visitService.reschedule({ visitId: 'v1', newDate: '2026-07-15' });
    expect(visit.id).toBe('v1');
    expect(visit.visitDate).toBe('2026-07-15');
    const db = repository.getState();
    expect(db.visits).toHaveLength(1);
    expect(db.visits[0].visitDate).toBe('2026-07-15');
    expect(db.visits[0].misaSyncStatus).toBe('Queued');
    expect(db.evidence.map((e) => e.visitId)).toEqual(['v1']);
  });

  it('rejects reschedule onto a date with existing planned visit for same outlet+rep', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [
        makeVisit({ id: 'v1', visitDate: '2026-07-12' }),
        makeVisit({ id: 'v2', visitDate: '2026-07-20' }),
      ],
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-20' }),
    ).rejects.toThrow('DATE_ALREADY_PLANNED');
  });

  it('throws VISIT_READ_ONLY for completed visits', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'completed' })],
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-15' }),
    ).rejects.toThrow('VISIT_READ_ONLY');
  });

  it('throws VISIT_READ_ONLY for cancelled visits', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', status: 'cancelled' })],
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-15' }),
    ).rejects.toThrow('VISIT_READ_ONLY');
  });

  it('enqueues sync and resolves after 1.5s', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-12', misaSyncStatus: 'Synced' })],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const visit = await visitService.reschedule({ visitId: 'v1', newDate: '2026-07-15' });
    expect(visit.misaSyncStatus).toBe('Queued');
    expect(repository.getState().visits[0].misaSyncStatus).toBe('Queued');
    vi.advanceTimersByTime(1500);
    expect(['Synced', 'Failed']).toContain(repository.getState().visits[0].misaSyncStatus);
  });
});

describe('visitService.reschedule — touches-today-or-past note gate (BR7)', () => {
  it('rejects rescheduling an overdue visit without a note', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-05' })],
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-15' }),
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
  });

  it('a whitespace-only note does not satisfy the overdue reschedule gate', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-05' })],
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-15', note: '   ' }),
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
  });

  it('rescheduling an overdue visit with a note succeeds and records it', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-05' })],
    });
    const visit = await visitService.reschedule({
      visitId: 'v1',
      newDate: '2026-07-15',
      note: 'Owner was on leave, moving to next week',
    });
    expect(visit.visitDate).toBe('2026-07-15');
    expect(visit.dateMismatchNote).toBe('Owner was on leave, moving to next week');
    expect(repository.getState().visits[0].dateMismatchNote).toBe('Owner was on leave, moving to next week');
  });

  it('rejects rescheduling a visit due today without a note (closes the same-day defer-forever loophole)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-10' })], // '2026-07-10' is mocked "today"
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-11' }),
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
  });

  it('postponing a not-yet-due (future) visit further out needs no note (forward-looking reschedule stays frictionless)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-12' })],
    });
    const visit = await visitService.reschedule({ visitId: 'v1', newDate: '2026-07-20' });
    expect(visit.visitDate).toBe('2026-07-20');
    expect(visit.dateMismatchNote).toBeUndefined();
  });

  it('rejects moving a future visit to an earlier future date without a note (same logic as completing early)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-20' })], // neither date touches today ('2026-07-10')
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-15' }),
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
  });

  it('moving a future visit to an earlier future date with a note succeeds and records it', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-20' })],
    });
    const visit = await visitService.reschedule({
      visitId: 'v1',
      newDate: '2026-07-15',
      note: 'Outlet asked to move it up a few days',
    });
    expect(visit.visitDate).toBe('2026-07-15');
    expect(visit.dateMismatchNote).toBe('Outlet asked to move it up a few days');
  });

  it('rejects pulling a future visit straight onto today without a note (closes the pull-forward loophole)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-20' })], // safely in the future, not due/overdue
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-10' }), // '2026-07-10' is mocked "today"
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
  });

  it('pulling a future visit onto today with a note succeeds and records it, and completing same-day needs no extra note', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-20' })],
    });
    const rescheduled = await visitService.reschedule({
      visitId: 'v1',
      newDate: '2026-07-10',
      note: 'Rep is at the outlet anyway today, doing it now instead of next week',
    });
    expect(rescheduled.visitDate).toBe('2026-07-10');
    expect(rescheduled.dateMismatchNote).toBe('Rep is at the outlet anyway today, doing it now instead of next week');

    const completed = await visitService.complete({ visitId: 'v1', result: 'Done' });
    expect(completed.dateMismatchNote).toBe('Rep is at the outlet anyway today, doing it now instead of next week');
  });

  it('rejects pulling a future visit onto a past date without a note (both ends of the move are checked)', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-20' })],
    });
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-05' }),
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
  });

  it('cannot indefinitely defer by rescheduling one day forward each day — each hop still needs a note', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-10' })], // due "today"
    });
    // Day 1: due today, push to tomorrow — must explain.
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-11' }),
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
    await visitService.reschedule({ visitId: 'v1', newDate: '2026-07-11', note: 'Owner unavailable today' });
    expect(repository.getState().visits[0].visitDate).toBe('2026-07-11');

    // Day 2: system clock advances to the date it was just pushed to — still due "today", still gated.
    vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'));
    await expect(
      visitService.reschedule({ visitId: 'v1', newDate: '2026-07-12' }),
    ).rejects.toThrow('RESCHEDULE_NOTE_REQUIRED');
  });

  it('completing on the rescheduled date preserves the overdue-reschedule note instead of clearing it', async () => {
    resetDB({
      outlets: [makeOutlet()],
      visits: [makeVisit({ id: 'v1', visitDate: '2026-07-05' })],
    });
    await visitService.reschedule({ visitId: 'v1', newDate: '2026-07-10', note: 'Rebooked after no-show' });
    const completed = await visitService.complete({ visitId: 'v1', result: 'Done' });
    expect(completed.status).toBe('completed');
    expect(completed.dateMismatchNote).toBe('Rebooked after no-show');
  });
});

describe('visitService authorization (A9 rework)', () => {
  it('a rep cannot schedule a visit under another rep\'s name', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })] });
    await expect(
      visitService.upsertPlanned({
        outletId: 'o1', salesRep: 'Linh', visitDate: '2026-07-10',
        targetStage: 'SQL', objective: 'Not my rep',
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('a manager can schedule a visit under any rep\'s name', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })] });
    resetSession(MANAGER);
    const { visit } = await visitService.upsertPlanned({
      outletId: 'o1', salesRep: 'Linh', visitDate: '2026-07-10',
      targetStage: 'SQL', objective: 'Manager scheduling for Linh',
    });
    expect(visit.salesRep).toBe('Linh');
  });

  it('a rep cannot add evidence, complete, reschedule, or cancel another rep\'s visit', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })], visits: [makeVisit({ salesRep: 'Linh' })] });
    await expect(visitService.addEvidence('v1', { type: 'note', name: 'x' })).rejects.toThrow('FORBIDDEN');
    await expect(visitService.complete({ visitId: 'v1', result: 'x' })).rejects.toThrow('FORBIDDEN');
    await expect(visitService.reschedule({ visitId: 'v1', newDate: '2026-08-01' })).rejects.toThrow('FORBIDDEN');
    await expect(visitService.cancelVisit('v1', 'Other')).rejects.toThrow('FORBIDDEN');
  });

  it('a manager can act on any rep\'s visit', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })], visits: [makeVisit({ salesRep: 'Linh' })] });
    resetSession(MANAGER);
    const visit = await visitService.complete({ visitId: 'v1', result: 'Manager stepped in' });
    expect(visit.status).toBe('completed');
  });

  it('stage history attributes the transition to the acting user, not the visit\'s rep (manager completing on a rep\'s behalf)', async () => {
    resetDB({ outlets: [makeOutlet({ salesRep: 'Linh' })], visits: [makeVisit({ salesRep: 'Linh' })], evidence: [makeEvidence()] });
    resetSession(MANAGER);
    await visitService.complete({ visitId: 'v1', result: 'Closed by manager', newStage: 'CustomerSampling' });
    expect(repository.getState().stageHistory[0].changedBy).toBe(MANAGER.name);
  });

  it('visitService.list/get are scoped to the current rep; a manager sees everything', async () => {
    resetDB({ visits: [makeVisit({ id: 'v1', salesRep: 'Phúc' }), makeVisit({ id: 'v2', salesRep: 'Linh' })] });
    expect((await visitService.list()).map((v) => v.id)).toEqual(['v1']);
    expect(await visitService.get('v2')).toBeUndefined();
    resetSession(MANAGER);
    expect((await visitService.list()).map((v) => v.id).sort()).toEqual(['v1', 'v2']);
    expect(await visitService.get('v2')).toBeDefined();
  });
});