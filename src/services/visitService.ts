import { repository } from '../store/repository';
import { session } from '../store/session';
import { assertCanAccess, canAccess } from '../domain/authz';
import { syncService } from './syncService';
import { localISODate } from '../domain/dates';
import type { CancelReason, Evidence, EvidenceType, Stage, Visit } from '../domain/types';

export interface ScheduleVisitInput {
  outletId: string;
  salesRep: string;
  visitDate: string; // 'YYYY-MM-DD'
  targetStage: Stage;
  objective: string;
  /** The planned visit the form is editing — reschedule moves this row instead of forking a new one. */
  existingVisitId?: string;
}

export interface CompleteVisitInput {
  visitId: string;
  result: string;
  resultNotes?: string;
  /** null/undefined = keep current stage (BR5) */
  newStage?: Stage | null;
  /** Required whenever visitDate differs from the completion day (BR7) */
  dateMismatchNote?: string;
}

export const visitService = {
  async list(): Promise<Visit[]> {
    const user = session.getState();
    return [...repository.getState().visits].filter((v) => canAccess(user, v)).sort((a, b) => a.visitDate.localeCompare(b.visitDate));
  },

  async get(id: string): Promise<Visit | undefined> {
    const user = session.getState();
    const visit = repository.getState().visits.find((v) => v.id === id);
    return visit && canAccess(user, visit) ? visit : undefined;
  },

  /**
   * BR1/BR2 (A1): upsert keyed on (salesRep, outletId, visitDate) among planned visits only.
   * Authorization (A9 rework): a rep may only schedule/move visits under their own name;
   * scheduling a visit for another rep (including via reassignment) requires a manager.
   * When `existingVisitId` names a different planned visit than the date match, the visit is
   * moved (a reschedule and/or rep reassignment — the visit follows the outlet) rather than
   * forking a second plan — unless another planned visit already occupies the destination
   * (rep, date), in which case the move is rejected so the two rows aren't silently merged
   * (which would also mean discarding one's evidence).
   */
  async upsertPlanned(input: ScheduleVisitInput): Promise<{ visit: Visit; created: boolean }> {
    const user = session.getState();
    assertCanAccess(user, { salesRep: input.salesRep });
    const db = repository.getState();
    const outlet = db.outlets.find((o) => o.id === input.outletId);
    if (!outlet) throw new Error('OUTLET_NOT_FOUND');

    const dateMatch = db.visits.find(
      (v) =>
        v.status === 'planned' &&
        v.salesRep === input.salesRep &&
        v.outletId === input.outletId &&
        v.visitDate === input.visitDate,
    );

    const movingFrom =
      input.existingVisitId && input.existingVisitId !== dateMatch?.id
        ? db.visits.find((v) => v.id === input.existingVisitId && v.status === 'planned')
        : undefined;

    const now = new Date().toISOString();

    if (dateMatch) {
      if (movingFrom) throw new Error('DATE_ALREADY_PLANNED'); // another plan already sits on that date
      const updated: Visit = { ...dateMatch, targetStage: input.targetStage, objective: input.objective, updatedAt: now };
      repository.setState((cur) => ({
        ...cur,
        visits: cur.visits.map((v) => (v.id === dateMatch.id ? updated : v)),
      }));
      syncService.enqueue(dateMatch.id); // changed row → external system needs it again (A1)
      return { visit: { ...updated, misaSyncStatus: 'Queued' }, created: false };
    }

    if (movingFrom) {
      const moved: Visit = { ...movingFrom, salesRep: input.salesRep, visitDate: input.visitDate, targetStage: input.targetStage, objective: input.objective, updatedAt: now };
      repository.setState((cur) => ({
        ...cur,
        visits: cur.visits.map((v) => (v.id === movingFrom.id ? moved : v)),
      }));
      syncService.enqueue(movingFrom.id); // moved row → external system needs it again
      return { visit: { ...moved, misaSyncStatus: 'Queued' }, created: false };
    }

    const visit: Visit = {
      id: crypto.randomUUID(),
      outletId: input.outletId,
      salesRep: input.salesRep,
      visitDate: input.visitDate,
      currentStageSnapshot: outlet.currentStage, // A7
      targetStage: input.targetStage,
      objective: input.objective,
      status: 'planned',
      misaSyncStatus: 'Queued',
      createdAt: now,
      updatedAt: now,
    };
    repository.setState((cur) => ({ ...cur, visits: [...cur.visits, visit] }));
    syncService.enqueue(visit.id);
    return { visit, created: true };
  },

  /** Evidence documents the meeting — attachable only while the visit is planned. */
  async addEvidence(visitId: string, input: { type: EvidenceType; name: string }): Promise<Evidence> {
    const visit = repository.getState().visits.find((v) => v.id === visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    assertCanAccess(session.getState(), visit);
    if (visit.status !== 'planned') throw new Error('VISIT_READ_ONLY');
    const evidence: Evidence = {
      id: crypto.randomUUID(),
      visitId,
      type: input.type,
      name: input.name,
      uploadedAt: new Date().toISOString(),
    };
    repository.setState((cur) => ({ ...cur, evidence: [...cur.evidence, evidence] }));
    return evidence;
  },

  async cancelVisit(visitId: string, reason: CancelReason, note?: string): Promise<Visit> {
    const visit = repository.getState().visits.find((v) => v.id === visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    assertCanAccess(session.getState(), visit);
    if (visit.status !== 'planned') throw new Error('VISIT_READ_ONLY');

    const now = new Date().toISOString();
    const cancelled: Visit = {
      ...visit,
      status: 'cancelled',
      cancelReason: reason,
      cancelNote: note,
      updatedAt: now,
    };
    repository.setState((cur) => ({
      ...cur,
      visits: cur.visits.map((v) => (v.id === visit.id ? cancelled : v)),
    }));
    syncService.cancel(visit.id);
    return { ...cancelled, misaSyncStatus: 'Queued' };
  },

  async reschedule(input: { visitId: string; newDate: string; note?: string }): Promise<Visit> {
    const visit = repository.getState().visits.find((v) => v.id === input.visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    assertCanAccess(session.getState(), visit);
    if (visit.status !== 'planned') throw new Error('VISIT_READ_ONLY');

    // BR7 (reschedule side): mirrors completion-time BR7 — completing before the currently scheduled
    // date always needs a note, regardless of "today". A reschedule that moves the date earlier than
    // currently planned is the same kind of deviation and needs the same explanation, whether the new
    // date lands in the past, on today, or just earlier in the future (e.g. July 20 -> July 15 is just
    // as much "moving it up" as July 20 -> today, even though neither touches "today"). Separately, a
    // visit that's already due or overdue needs an explanation for *any* move, even a postponement,
    // so the fact of its lateness isn't silently erased.
    const today = localISODate();
    const movedEarlier = input.newDate < visit.visitDate;
    const currentlyDueOrOverdue = visit.visitDate <= today;
    const needsNote = movedEarlier || currentlyDueOrOverdue;
    if (needsNote && !input.note?.trim()) throw new Error('RESCHEDULE_NOTE_REQUIRED');

    await this.upsertPlanned({
      outletId: visit.outletId,
      salesRep: visit.salesRep,
      visitDate: input.newDate,
      targetStage: visit.targetStage,
      objective: visit.objective,
      existingVisitId: input.visitId,
    });

    if (needsNote) {
      repository.setState((cur) => ({
        ...cur,
        visits: cur.visits.map((v) => (v.id === input.visitId ? { ...v, dateMismatchNote: input.note!.trim() } : v)),
      }));
    }

    return repository.getState().visits.find((v) => v.id === input.visitId)!;
  },

  async listEvidence(visitId: string): Promise<Evidence[]> {
    return repository.getState().evidence.filter((e) => e.visitId === visitId);
  },

  /** BR3–BR5: complete a visit; optional stage transition gated on ≥1 evidence.
   *  BR4: every completion appends a StageHistory row, even when the stage is held
   *  (fromStage === toStage) — the log is a full audit of stage decisions, not just changes. */
  async complete(input: CompleteVisitInput): Promise<Visit> {
    const user = session.getState();
    const db = repository.getState();
    const visit = db.visits.find((v) => v.id === input.visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    assertCanAccess(user, visit);
    if (visit.status !== 'planned') throw new Error('VISIT_READ_ONLY');
    if (!input.result.trim()) throw new Error('RESULT_REQUIRED');

    const outlet = db.outlets.find((o) => o.id === visit.outletId);
    if (!outlet) throw new Error('OUTLET_NOT_FOUND');

    const transitioning = input.newStage != null && input.newStage !== outlet.currentStage;
    if (transitioning && db.evidence.filter((e) => e.visitId === visit.id).length === 0) {
      throw new Error('EVIDENCE_REQUIRED'); // BR3
    }

    const dateMismatch = visit.visitDate !== localISODate();
    if (dateMismatch && !input.dateMismatchNote?.trim()) {
      throw new Error('DATE_MISMATCH_NOTE_REQUIRED'); // BR7
    }

    const now = new Date().toISOString();
    const completed: Visit = {
      ...visit,
      status: 'completed',
      result: input.result,
      resultNotes: input.resultNotes,
      dateMismatchNote: dateMismatch ? input.dateMismatchNote!.trim() : visit.dateMismatchNote,
      updatedAt: now,
    };

    const toStage = input.newStage ?? outlet.currentStage;

    // BR4: completion + stage change + history append in one atomic state transition
    repository.setState((cur) => ({
      ...cur,
      visits: cur.visits.map((v) => (v.id === visit.id ? completed : v)),
      outlets: transitioning
        ? cur.outlets.map((o) => (o.id === outlet.id ? { ...o, currentStage: input.newStage!, updatedAt: now } : o))
        : cur.outlets,
      stageHistory: [
        ...cur.stageHistory,
        { id: crypto.randomUUID(), outletId: outlet.id, visitId: visit.id, fromStage: outlet.currentStage, toStage, changedBy: user.name, changedAt: now },
      ],
    }));

    syncService.enqueue(visit.id);
    return { ...completed, misaSyncStatus: 'Queued' };
  },

  /** A4: cancel sets planned visits to status 'cancelled' (preserving evidence),
   * then enqueues a MISA cancel per visit. Completed/cancelled history is immutable. */
  async cancelPlannedForOutlet(outletId: string): Promise<void> {
    const now = new Date().toISOString();
    const toCancel = repository.getState().visits.filter(
      (v) => v.outletId === outletId && v.status === 'planned',
    );
    if (toCancel.length === 0) return;
    repository.setState((cur) => ({
      ...cur,
      visits: cur.visits.map((v) =>
        v.outletId === outletId && v.status === 'planned'
          ? { ...v, status: 'cancelled' as const, cancelReason: 'Unscheduled from outlet form' as const, updatedAt: now }
          : v,
      ),
    }));
    for (const v of toCancel) {
      syncService.cancel(v.id);
    }
  },
};