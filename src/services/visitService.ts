import { repository } from '../store/repository';
import { syncService } from './syncService';
import type { Evidence, EvidenceType, Stage, Visit } from '../domain/types';

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
}

export const visitService = {
  async list(): Promise<Visit[]> {
    return [...repository.getState().visits].sort((a, b) => a.visitDate.localeCompare(b.visitDate));
  },

  async get(id: string): Promise<Visit | undefined> {
    return repository.getState().visits.find((v) => v.id === id);
  },

  /**
   * BR1/BR2 (A1): upsert keyed on (salesRep, outletId, visitDate) among planned visits only.
   * When `existingVisitId` names a different planned visit than the date match, the visit is
   * moved (a reschedule and/or rep reassignment — the visit follows the outlet) rather than
   * forking a second plan — unless another planned visit already occupies the destination
   * (rep, date), in which case the move is rejected so the two rows aren't silently merged
   * (which would also mean discarding one's evidence).
   */
  async upsertPlanned(input: ScheduleVisitInput): Promise<{ visit: Visit; created: boolean }> {
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
    if (visit.status === 'completed') throw new Error('VISIT_READ_ONLY');
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

  async listEvidence(visitId: string): Promise<Evidence[]> {
    return repository.getState().evidence.filter((e) => e.visitId === visitId);
  },

  /** BR3–BR5: complete a visit; optional stage transition gated on ≥1 evidence. */
  async complete(input: CompleteVisitInput): Promise<Visit> {
    const db = repository.getState();
    const visit = db.visits.find((v) => v.id === input.visitId);
    if (!visit) throw new Error('VISIT_NOT_FOUND');
    if (visit.status === 'completed') throw new Error('VISIT_READ_ONLY');
    if (!input.result.trim()) throw new Error('RESULT_REQUIRED');

    const outlet = db.outlets.find((o) => o.id === visit.outletId);
    if (!outlet) throw new Error('OUTLET_NOT_FOUND');

    const transitioning = input.newStage != null && input.newStage !== outlet.currentStage;
    if (transitioning && db.evidence.filter((e) => e.visitId === visit.id).length === 0) {
      throw new Error('EVIDENCE_REQUIRED'); // BR3
    }

    const now = new Date().toISOString();
    const completed: Visit = { ...visit, status: 'completed', result: input.result, resultNotes: input.resultNotes, updatedAt: now };

    // BR4: completion + stage change + history append in one atomic state transition
    repository.setState((cur) => ({
      ...cur,
      visits: cur.visits.map((v) => (v.id === visit.id ? completed : v)),
      outlets: transitioning
        ? cur.outlets.map((o) => (o.id === outlet.id ? { ...o, currentStage: input.newStage!, updatedAt: now } : o))
        : cur.outlets,
      stageHistory: transitioning
        ? [
            ...cur.stageHistory,
            { id: crypto.randomUUID(), outletId: outlet.id, visitId: visit.id, fromStage: outlet.currentStage, toStage: input.newStage!, changedBy: visit.salesRep, changedAt: now },
          ]
        : cur.stageHistory,
    }));

    syncService.enqueue(visit.id);
    return { ...completed, misaSyncStatus: 'Queued' };
  },

  /** A4: cancelling the plan removes planned visits and their evidence; completed history is immutable. */
  async deletePlannedForOutlet(outletId: string): Promise<void> {
    repository.setState((cur) => {
      const removed = new Set(
        cur.visits.filter((v) => v.outletId === outletId && v.status === 'planned').map((v) => v.id),
      );
      return {
        ...cur,
        visits: cur.visits.filter((v) => !removed.has(v.id)),
        evidence: cur.evidence.filter((e) => !removed.has(e.visitId)),
      };
    });
  },
};