import { repository } from '../store/repository';
import { session } from '../store/session';
import { assertCanAccess, assertCanReassign, canAccess } from '../domain/authz';
import { visitService, type ScheduleVisitInput } from './visitService';
import type { Channel, Outlet, Stage, Tier } from '../domain/types';

export interface OutletInput {
  id?: string;
  name: string;
  address: string;
  channel: Channel;
  tier: Tier;
  salesRep: string;
  currentStage: Stage;
  notes?: string;
}

export type ScheduleFields = Omit<ScheduleVisitInput, 'outletId' | 'salesRep'>;

export const outletService = {
  async list(): Promise<Outlet[]> {
    const user = session.getState();
    return [...repository.getState().outlets].filter((o) => canAccess(user, o)).sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: string): Promise<Outlet | undefined> {
    const user = session.getState();
    const outlet = repository.getState().outlets.find((o) => o.id === id);
    return outlet && canAccess(user, outlet) ? outlet : undefined;
  },

  /**
   * Save an outlet. `schedule` carries the visit fields when "Schedule a visit"
   * is checked, or null when unchecked — which cancels remaining planned
   * visits for the outlet (A4); cancelled visits are kept as records.
   *
   * Authorization (A9 rework): a rep may only create/edit their own outlets —
   * on create their outlet is forced to themself; on edit, reassigning to a
   * different rep requires a manager. A manager passes every check.
   */
  async save(input: OutletInput, schedule: ScheduleFields | null): Promise<Outlet> {
    const user = session.getState();
    const now = new Date().toISOString();
    let outlet: Outlet;

    if (input.id) {
      const existing = repository.getState().outlets.find((o) => o.id === input.id);
      if (!existing) throw new Error('OUTLET_NOT_FOUND');
      assertCanAccess(user, existing);
      if (input.salesRep !== existing.salesRep) assertCanReassign(user);
      outlet = { ...existing, ...input, id: existing.id, currentStage: existing.currentStage, updatedAt: now };
      repository.setState((cur) => ({
        ...cur,
        outlets: cur.outlets.map((o) => (o.id === outlet.id ? outlet : o)),
      }));
    } else {
      const salesRep = user.role === 'manager' ? input.salesRep : user.name;
      outlet = { ...input, salesRep, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      repository.setState((cur) => ({ ...cur, outlets: [...cur.outlets, outlet] }));
    }

    if (schedule) {
      await visitService.upsertPlanned({ outletId: outlet.id, salesRep: outlet.salesRep, ...schedule }); // BR1
    } else if (input.id) {
      await visitService.cancelPlannedForOutlet(outlet.id); // A4
    }
    return outlet;
  },
};