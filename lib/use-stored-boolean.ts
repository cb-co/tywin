"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A boolean preference persisted in localStorage, read without an effect.
 *
 * The obvious version of this — `useState(fallback)` plus a `useEffect` that
 * reads localStorage — is what `react-hooks/set-state-in-effect` rejects: it
 * renders once with the wrong value and immediately re-renders with the right
 * one. But the value genuinely cannot be read during server rendering, so a
 * lazy `useState` initializer isn't available either; it would produce a
 * hydration mismatch instead.
 *
 * `useSyncExternalStore` is the primitive for exactly this shape. React uses
 * `getServerSnapshot` on the server *and* for the hydrating render, then
 * switches to `getSnapshot` — so hydration matches, there's no cascading
 * render, and a change in another tab (the `storage` event) now propagates for
 * free, which the effect version never did.
 *
 * Stored as "1"/"0"; an absent key means `fallback`, so a user who has never
 * touched the setting gets the default. Every localStorage access is guarded —
 * Safari throws on access in private mode rather than returning null.
 */

const listeners = new Set<() => void>();

/** Same-tab writes don't fire `storage` (it only notifies *other* tabs), so
 *  `setStoredBoolean` has to notify subscribers itself. */
function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useStoredBoolean(key: string, fallback: boolean) {
  const getSnapshot = useCallback(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : stored === "1";
    } catch {
      return fallback;
    }
  }, [key, fallback]);

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* Non-fatal: the preference just won't persist across reloads. */
      }
      emit();
    },
    [key],
  );

  return [value, setValue] as const;
}
