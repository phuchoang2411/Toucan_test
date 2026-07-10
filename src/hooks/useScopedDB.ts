import { useDB } from './useDB';
import { useSession } from './useSession';
import { canAccess } from '../domain/authz';
import type { DB, User } from '../domain/types';

export interface ScopedDB extends DB {
  currentUser: User;
  isManager: boolean;
}

/** View-scoping for list/dashboard pages: a rep only ever sees their own outlets/visits (A9 rework). */
export function useScopedDB(): ScopedDB {
  const db = useDB();
  const user = useSession();
  if (user.role === 'manager') return { ...db, currentUser: user, isManager: true };
  return {
    ...db,
    outlets: db.outlets.filter((o) => canAccess(user, o)),
    visits: db.visits.filter((v) => canAccess(user, v)),
    currentUser: user,
    isManager: false,
  };
}
