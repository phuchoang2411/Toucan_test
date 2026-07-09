import { repository } from '../store/repository';
import { syncService } from './syncService';
import type { Stage, Visit } from '../domain/types';

export interface ScheduleVisitInput {
  outletId: string;
  salesRep: string;
  visitDate: string; // 'YYYY-MM-DD'
  targetStage: Stage;
  objective: string;
}

export const visitService = {
  async list(): Promise<Visit[]> {
    return [...repository.getState().visits].sort((a, b) => a.visitDate.localeCompare(b.visitDate));
  },

  async get(id: string): Promise<Visit | undefined> {
    return repository.getState().visits.find((v) => v.id === id);
  },

  /** BR1/BR2 (A1): upsert keyed on (salesRep, outletId, visitDate) among planned visits only. */
  async upsertPlanned(input: ScheduleVisitInput): Promise<{ visit: Visit; created: boolean }> {
    const db = repository.getState();
    const outlet = db.outlets.find((o) => o.id === input.outletId);
    if (!outlet) throw new Error('OUTLET_NOT_FOUND');

    const existing = db.visits.find(
      (v) =>
        v.status === 'planned' &&
        v.salesRep === input.salesRep &&
        v.outletId === input.outletId &&
        v.visitDate === input.visitDate,
    );

    const now = new Date().toISOString();

    if (existing) {
      const updated: Visit = { ...existing, targetStage: input.targetStage, objective: input.objective, updatedAt: now };
      repository.setState((cur) => ({
        ...cur,
        visits: cur.visits.map((v) => (v.id === existing.id ? updated : v)),
      }));
      syncService.enqueue(existing.id); // changed row → external system needs it again (A1)
      return { visit: { ...updated, misaSyncStatus: 'Queued' }, created: false };
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
};