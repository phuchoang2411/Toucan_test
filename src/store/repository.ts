import type { DB } from '../domain/types';
import { seedDB } from './seed';

const STORAGE_KEY = 'magnolia-db-v1';

function load(): DB | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DB) : null;
  } catch {
    return null;
  }
}

function persist(db: DB): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage full/unavailable — prototype keeps working in-memory */
  }
}

let state: DB = load() ?? seedDB();
persist(state);

const listeners = new Set<() => void>();

export const repository = {
  getState(): DB {
    return state;
  },
  setState(updater: (db: DB) => DB): void {
    state = updater(state);
    persist(state);
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** test-only: replace the whole DB */
  reset(db: DB): void {
    state = db;
    persist(state);
    listeners.forEach((l) => l());
  },
};