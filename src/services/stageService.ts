import { repository } from '../store/repository';
import type { StageHistory } from '../domain/types';

export const stageService = {
  async historyForOutlet(outletId: string): Promise<StageHistory[]> {
    return repository
      .getState()
      .stageHistory.filter((h) => h.outletId === outletId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  },
};