import { describe, expect, it } from 'vitest';
import { isOverdue } from '../../domain/visits';

describe('isOverdue', () => {
  it('planned visit with past date is overdue', () => {
    expect(isOverdue('planned', '2026-07-08', '2026-07-10')).toBe(true);
  });

  it('planned visit with today date is NOT overdue', () => {
    expect(isOverdue('planned', '2026-07-10', '2026-07-10')).toBe(false);
  });

  it('planned visit with future date is NOT overdue', () => {
    expect(isOverdue('planned', '2026-07-15', '2026-07-10')).toBe(false);
  });

  it('completed visit with past date is NOT overdue', () => {
    expect(isOverdue('completed', '2026-07-08', '2026-07-10')).toBe(false);
  });

  it('cancelled visit with past date is NOT overdue', () => {
    expect(isOverdue('cancelled', '2026-07-08', '2026-07-10')).toBe(false);
  });
});
