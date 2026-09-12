"use client";

import { useSyncExternalStore } from "react";

// localStorage as an external store: the server snapshot is empty so hydration
// matches, and every writer notifies every reader of the same key.
const listeners = new Map<string, Set<() => void>>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** A JSON value remembered in this browser; `null` until hydrated, then the stored value (or `fallback`). */
export function useLocalMemory<T>(key: string, fallback: T): [T, (update: (current: T) => T) => void] {
  const raw = useSyncExternalStore(
    (cb) => {
      const set = listeners.get(key) ?? new Set();
      set.add(cb);
      listeners.set(key, set);
      return () => set.delete(cb);
    },
    () => read(key),
    () => null,
  );
  const value = parse(raw, fallback);
  function write(update: (current: T) => T) {
    try {
      localStorage.setItem(key, JSON.stringify(update(parse(read(key), fallback))));
      for (const cb of listeners.get(key) ?? []) cb();
    } catch {
      // Storage unavailable: nothing to remember.
    }
  }
  return [value, write];
}
