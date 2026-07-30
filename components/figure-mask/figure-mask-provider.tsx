"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { maskFigure } from "./mask-figure";

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

/**
 * Same masking as `MaskedMoney`, as a plain string-returning function
 * instead of a component — for contexts that need a string, like a Recharts
 * axis or tooltip formatter.
 */
export function useMaskedFormatMoney() {
  const { masked } = useFigureMask();
  return (amount: number, currency: string, opts?: { compact?: boolean; signed?: boolean }) => {
    const formatted = formatMoney(amount, currency, opts);
    return masked ? maskFigure(formatted) : formatted;
  };
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
