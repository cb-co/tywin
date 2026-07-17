"use client";

import { createContext, useContext, useEffect, useState } from "react";

type QuickAddContext = { open: boolean; setOpen: (v: boolean) => void };
const Ctx = createContext<QuickAddContext | null>(null);

export function useQuickAdd() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}
