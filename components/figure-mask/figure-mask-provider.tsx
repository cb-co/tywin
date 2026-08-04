"use client";

import { createContext, useContext } from "react";
import { formatMoney } from "@/lib/format";
import { useStoredBoolean } from "@/lib/use-stored-boolean";
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
  return (
    amount: number,
    currency: string,
    opts?: { compact?: boolean; signed?: boolean; maximumFractionDigits?: number },
  ) => {
    const formatted = formatMoney(amount, currency, opts);
    return masked ? maskFigure(formatted) : formatted;
  };
}

export function FigureMaskProvider({ children }: { children: React.ReactNode }) {
  // Default false (unmasked) is the safe SSR-compatible value — localStorage
  // isn't available during server rendering, so that's what the server and the
  // hydrating render use before the stored preference takes over.
  const [masked, setMasked] = useStoredBoolean(STORAGE_KEY, false);

  function toggle() {
    setMasked(!masked);
  }

  return <Ctx.Provider value={{ masked, toggle }}>{children}</Ctx.Provider>;
}
