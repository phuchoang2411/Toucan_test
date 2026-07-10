import type { User } from './types';

export interface Owned {
  salesRep: string;
}

/** Manager can see/manage every record; a rep only their own (A9 rework). */
export function canAccess(user: User, record: Owned): boolean {
  return user.role === 'manager' || record.salesRep === user.name;
}

/** Only a manager may move an outlet/visit to a different sales rep. */
export function canReassign(user: User): boolean {
  return user.role === 'manager';
}

export function assertCanAccess(user: User, record: Owned): void {
  if (!canAccess(user, record)) throw new Error('FORBIDDEN');
}

export function assertCanReassign(user: User): void {
  if (!canReassign(user)) throw new Error('FORBIDDEN_REASSIGN');
}
