import type { DB } from '../domain/types';
import { localISODate } from '../domain/dates';

export function seedDB(): DB {
  const now = new Date().toISOString();
  return {
    outlets: [
      { id: 'outlet-blue-lotus', name: 'Blue Lotus Cafe', address: '12 Lê Lợi, Q1, HCMC', channel: 'Cafe', tier: 'B', salesRep: 'Phúc', currentStage: 'SQL', notes: 'Interested in cold brew line', createdAt: now, updatedAt: now },
      { id: 'outlet-hoa-nang', name: 'Hoa Nắng Bakery', address: '45 Phan Đình Phùng, Phú Nhuận, HCMC', channel: 'Bakery', tier: 'C', salesRep: 'Linh', currentStage: 'RawLead', createdAt: now, updatedAt: now },
      { id: 'outlet-maison-saigon', name: 'Maison Saigon Bistro', address: '8 Đồng Khởi, Q1, HCMC', channel: 'Restaurant', tier: 'A', salesRep: 'Minh', currentStage: 'CustomerSampling', createdAt: now, updatedAt: now },
    ],
    visits: [
      { id: 'visit-planned-1', outletId: 'outlet-blue-lotus', salesRep: 'Phúc', visitDate: localISODate(1), currentStageSnapshot: 'SQL', targetStage: 'CustomerSampling', objective: 'Drop off sample pack', status: 'planned', misaSyncStatus: 'Synced', createdAt: now, updatedAt: now },
      { id: 'visit-completed-1', outletId: 'outlet-maison-saigon', salesRep: 'Minh', visitDate: localISODate(-3), currentStageSnapshot: 'SQL', targetStage: 'CustomerSampling', objective: 'Run tasting session', status: 'completed', result: 'Tasting went well, chef approved 2 SKUs', misaSyncStatus: 'Synced', createdAt: now, updatedAt: now },
      { id: 'visit-cancelled-1', outletId: 'outlet-hoa-nang', salesRep: 'Linh', visitDate: localISODate(-5), currentStageSnapshot: 'RawLead', targetStage: 'SQL', objective: 'Initial product intro', status: 'cancelled' as const, misaSyncStatus: 'Synced', createdAt: now, updatedAt: now },
    ],
    evidence: [
      { id: 'evidence-1', visitId: 'visit-completed-1', type: 'photo', name: 'tasting-session.jpg', uploadedAt: now },
      { id: 'evidence-cancelled', visitId: 'visit-cancelled-1', type: 'note', name: 'Cancelled before meeting — contact rescheduled', uploadedAt: now },
    ],
    stageHistory: [
      { id: 'history-1', outletId: 'outlet-maison-saigon', visitId: 'visit-completed-1', fromStage: 'SQL', toStage: 'CustomerSampling', changedBy: 'Minh', changedAt: now },
    ],
  };
}