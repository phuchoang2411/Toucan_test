import type { VisitStatus } from './types';

/** A visit is overdue when it's still planned and its date is before today.
 *  Lexical comparison is correct for YYYY-MM-DD. `today` is injected so tests
 *  can be deterministic. */
export function isOverdue(status: VisitStatus, visitDate: string, today: string): boolean {
  return status === 'planned' && visitDate < today;
}
