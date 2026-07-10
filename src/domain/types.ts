export const STAGES = ['RawLead', 'SQL', 'CustomerSampling', 'ProposalSent', 'Won', 'Lost'] as const;
export type Stage = (typeof STAGES)[number];

export const CHANNELS = ['Cafe', 'Restaurant', 'Hotel', 'Bar', 'Bakery'] as const;
export type Channel = (typeof CHANNELS)[number];

export const TIERS = ['A', 'B', 'C'] as const;
export type Tier = (typeof TIERS)[number];

export type Role = 'rep' | 'manager';

export const USERS = [
  { name: 'Phúc', role: 'rep' },
  { name: 'Linh', role: 'rep' },
  { name: 'Minh', role: 'rep' },
  { name: 'Thảo', role: 'manager' },
] as const satisfies readonly { name: string; role: Role }[];

export type User = (typeof USERS)[number];

export const SALES_REPS = USERS.filter((u) => u.role === 'rep').map((u) => u.name);

export type VisitStatus = 'planned' | 'completed' | 'cancelled';
export const CANCEL_REASONS = ['Customer postponed', 'No-show', 'Planned by mistake', 'Unscheduled from outlet form', 'Other'] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];
export type SyncStatus = 'Queued' | 'Synced' | 'Failed';

export const EVIDENCE_TYPES = ['photo', 'file', 'note'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface Outlet {
  id: string;
  name: string;
  address: string;
  channel: Channel;
  tier: Tier;
  salesRep: string;
  currentStage: Stage;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  outletId: string;
  salesRep: string;
  /** 'YYYY-MM-DD' — day precision, part of the dedup key (A1) */
  visitDate: string;
  /** outlet stage when the visit was scheduled (A7) */
  currentStageSnapshot: Stage;
  targetStage: Stage;
  objective: string;
  status: VisitStatus;
  result?: string;
  resultNotes?: string;
  cancelReason?: CancelReason;
  cancelNote?: string;
  /** Required whenever completion happens on a different calendar day than visitDate (BR7) */
  dateMismatchNote?: string;
  misaSyncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  visitId: string;
  type: EvidenceType;
  name: string;
  uploadedAt: string;
}

export interface StageHistory {
  id: string;
  outletId: string;
  visitId: string;
  fromStage: Stage;
  toStage: Stage;
  changedBy: string;
  changedAt: string;
}

export interface DB {
  outlets: Outlet[];
  visits: Visit[];
  evidence: Evidence[];
  stageHistory: StageHistory[];
}