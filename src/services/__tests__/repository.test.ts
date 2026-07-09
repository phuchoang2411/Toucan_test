import { describe, expect, it } from 'vitest';
import { repository } from '../../store/repository';
import { makeOutlet, resetDB } from './helpers';

describe('repository', () => {
  it('setState replaces state immutably and notifies subscribers', () => {
    resetDB();
    let notified = 0;
    const unsubscribe = repository.subscribe(() => notified++);
    const before = repository.getState();
    repository.setState((db) => ({ ...db, outlets: [makeOutlet()] }));
    expect(notified).toBe(1);
    expect(repository.getState()).not.toBe(before);
    expect(repository.getState().outlets).toHaveLength(1);
    unsubscribe();
    repository.setState((db) => db);
    expect(notified).toBe(1);
  });
});