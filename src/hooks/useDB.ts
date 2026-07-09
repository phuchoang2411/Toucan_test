import { useSyncExternalStore } from 'react';
import { repository } from '../store/repository';
import type { DB } from '../domain/types';

export function useDB(): DB {
  return useSyncExternalStore(repository.subscribe, repository.getState);
}