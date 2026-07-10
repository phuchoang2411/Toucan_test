import { describe, expect, it } from 'vitest';
import { getScheduleWarnings, isOverdue } from '../../domain/visits';

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

describe('getScheduleWarnings', () => {
  const base = {
    visitDate: '2026-07-15',
    targetStage: 'SQL' as const,
    currentStage: 'RawLead' as const,
    today: '2026-07-10',
    existingPlans: [] as { visitDate: string }[],
  };

  it('returns no warnings for a clean future-dated, progressing plan with no collisions', () => {
    expect(getScheduleWarnings(base)).toEqual([]);
  });

  it('flags a past visit date', () => {
    expect(getScheduleWarnings({ ...base, visitDate: '2026-07-01' })).toContainEqual({ type: 'pastDate' });
  });

  it('flags target stage equal to current stage', () => {
    expect(getScheduleWarnings({ ...base, targetStage: 'RawLead' })).toContainEqual({ type: 'noProgression' });
  });

  it('flags a reschedule when an existing plan sits on a different date', () => {
    const warnings = getScheduleWarnings({ ...base, existingPlans: [{ visitDate: '2026-07-12' }] });
    expect(warnings).toContainEqual({ type: 'reschedule', from: '2026-07-12', to: '2026-07-15' });
  });

  it('does not flag a reschedule when the date matches the existing plan', () => {
    const warnings = getScheduleWarnings({ ...base, visitDate: '2026-07-12', existingPlans: [{ visitDate: '2026-07-12' }] });
    expect(warnings.some((w) => w.type === 'reschedule')).toBe(false);
  });

  it('flags multiple planned visits, naming the earliest as the one this form edits', () => {
    const warnings = getScheduleWarnings({
      ...base,
      existingPlans: [{ visitDate: '2026-07-12' }, { visitDate: '2026-07-20' }],
    });
    expect(warnings).toContainEqual({
      type: 'multiplePlanned', count: 2, dates: '2026-07-12, 2026-07-20', date: '2026-07-12',
    });
  });
});
