"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "cashly:figures-masked";

type FigureMaskContextValue = {
  masked: boolean;
  toggle: () => void;
};

const Ctx = createContext<FigureMaskContextValue | null>(null);

export function useFigureMask() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFigureMask must be used within FigureMaskProvider");
  return ctx;
}

function readStoredPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function FigureMaskProvider({ children }: { children: React.ReactNode }) {
  // Default false (unmasked) is the safe SSR-compatible value — localStorage
  // isn't available during server rendering, so the real preference is read
  // back in the effect below, client-only, same pattern as sound and theme.
  const [masked, setMasked] = useState(false);

  useEffect(() => {
    setMasked(readStoredPreference());
  }, []);

  function toggle() {
    setMasked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* Non-fatal: the preference just won't persist across reloads. */
      }
      return next;
    });
  }

  return <Ctx.Provider value={{ masked, toggle }}>{children}</Ctx.Provider>;
}
