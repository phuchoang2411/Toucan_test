import { repository } from '../store/repository';
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
    return [...repository.getState().outlets].sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: string): Promise<Outlet | undefined> {
    return repository.getState().outlets.find((o) => o.id === id);
  },

  /**
   * Save an outlet. `schedule` carries the visit fields when "Schedule a visit"
   * is checked, or null when unchecked — which cancels remaining planned
   * visits for the outlet (A4); completed visits are immutable history.
   */
  async save(input: OutletInput, schedule: ScheduleFields | null): Promise<Outlet> {
    const now = new Date().toISOString();
    let outlet: Outlet;

    if (input.id) {
      const existing = repository.getState().outlets.find((o) => o.id === input.id);
      if (!existing) throw new Error('OUTLET_NOT_FOUND');
      outlet = { ...existing, ...input, id: existing.id, updatedAt: now };
      repository.setState((cur) => ({
        ...cur,
        outlets: cur.outlets.map((o) => (o.id === outlet.id ? outlet : o)),
      }));
    } else {
      outlet = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      repository.setState((cur) => ({ ...cur, outlets: [...cur.outlets, outlet] }));
    }

    if (schedule) {
      await visitService.upsertPlanned({ outletId: outlet.id, salesRep: outlet.salesRep, ...schedule }); // BR1
    } else if (input.id) {
      await visitService.deletePlannedForOutlet(outlet.id); // A4
    }
    return outlet;
  },
};