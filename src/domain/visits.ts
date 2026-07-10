import type { Stage, VisitStatus } from './types';

/** A visit is overdue when it's still planned and its date is before today.
 *  Lexical comparison is correct for YYYY-MM-DD. `today` is injected so tests
 *  can be deterministic. */
export function isOverdue(status: VisitStatus, visitDate: string, today: string): boolean {
  return status === 'planned' && visitDate < today;
}

export type ScheduleWarning =
  | { type: 'pastDate' }
  | { type: 'noProgression' }
  | { type: 'reschedule'; from: string; to: string }
  | { type: 'multiplePlanned'; count: number; dates: string; date: string };

/** Shared warnings for any UI that schedules/edits a planned visit (outlet form,
 *  schedule-tab dialog) — kept as pure data so each caller maps it to its own t() calls. */
export function getScheduleWarnings(input: {
  visitDate: string;
  targetStage: Stage;
  currentStage: Stage;
  today: string;
  existingPlans: { visitDate: string }[];
}): ScheduleWarning[] {
  const { visitDate, targetStage, currentStage, today, existingPlans } = input;
  const existingPlan = existingPlans[0];
  const warnings: ScheduleWarning[] = [];

  if (visitDate && visitDate < today) warnings.push({ type: 'pastDate' });
  if (targetStage === currentStage) warnings.push({ type: 'noProgression' });
  if (existingPlan && visitDate && visitDate !== existingPlan.visitDate) {
    warnings.push({ type: 'reschedule', from: existingPlan.visitDate, to: visitDate });
  }
  if (existingPlans.length > 1) {
    warnings.push({
      type: 'multiplePlanned',
      count: existingPlans.length,
      dates: existingPlans.map((p) => p.visitDate).join(', '),
      date: existingPlan.visitDate,
    });
  }
  return warnings;
}
