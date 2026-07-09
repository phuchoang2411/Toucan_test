export const STAGES = ['RawLead', 'SQL', 'CustomerSampling', 'ProposalSent', 'Won', 'Lost'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  RawLead: 'Raw Lead',
  SQL: 'SQL',
  CustomerSampling: 'Customer Sampling',
  ProposalSent: 'Proposal Sent',
  Won: 'Won',
  Lost: 'Lost',
};

export const CHANNELS = ['Cafe', 'Restaurant', 'Hotel', 'Bar', 'Bakery'] as const;
export type Channel = (typeof CHANNELS)[number];

export const TIERS = ['A', 'B', 'C'] as const;
export type Tier = (typeof TIERS)[number];

export const SALES_REPS = ['Phúc', 'Linh', 'Minh'] as const;

export type VisitStatus = 'planned' | 'completed';
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