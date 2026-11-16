/** Tiny persistent store backed by localStorage, read with useSyncExternalStore. */
import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  use(): T;
  reset(): void;
}

export function createStore<T extends object>(key: string, defaults: T): Store<T> {
  let value: T = defaults;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = { ...defaults, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable or corrupt: fall back to defaults.
  }
  const listeners = new Set<() => void>();
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota or private-mode errors; the in-memory value still works.
    }
  };
  const store: Store<T> = {
    get: () => value,
    set(next) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      save();
      listeners.forEach((l) => l());
    },
    use() {
      return useSyncExternalStore(
        (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        () => value,
      );
    },
    reset() {
      store.set(defaults);
    },
  };
  return store;
}
