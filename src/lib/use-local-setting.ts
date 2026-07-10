"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * A localStorage-backed setting that hydrates safely: the server (and first
 * client render) sees `fallback`, then the stored value snaps in. Setting the
 * value re-renders every component using the same key.
 */
export function useLocalSetting(key: string, fallback: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback(
    (next: string) => {
      window.localStorage.setItem(key, next);
      for (const listener of listeners) listener();
    },
    [key],
  );
  return [value, set];
}
