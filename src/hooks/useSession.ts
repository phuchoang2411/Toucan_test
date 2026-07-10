import { useSyncExternalStore } from 'react';
import { session } from '../store/session';
import type { User } from '../domain/types';

export function useSession(): User {
  return useSyncExternalStore(session.subscribe, session.getState);
}
