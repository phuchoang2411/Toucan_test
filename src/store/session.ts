import type { User } from '../domain/types';
import { USERS } from '../domain/types';

const STORAGE_KEY = 'magnolia-session-v1';

function load(): User | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const name = localStorage.getItem(STORAGE_KEY);
    return USERS.find((u) => u.name === name) ?? null;
  } catch {
    return null;
  }
}

function persist(user: User): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, user.name);
  } catch {
    /* storage full/unavailable — prototype keeps working in-memory */
  }
}

let state: User = load() ?? USERS[0];
persist(state);

const listeners = new Set<() => void>();

export const session = {
  getState(): User {
    return state;
  },
  /** Mock "login as" — swaps the current user (stands in for an authenticated request context). */
  setUser(user: User): void {
    state = user;
    persist(state);
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** test-only: replace the current user */
  reset(user: User): void {
    state = user;
    persist(state);
    listeners.forEach((l) => l());
  },
};
