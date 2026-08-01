"use client";

import { createContext, useContext } from "react";
import useSound from "use-sound";
import { useStoredBoolean } from "@/lib/use-stored-boolean";

const STORAGE_KEY = "cashly:sound-enabled";

type SoundContextValue = {
  playSuccess: () => void;
  playDelete: () => void;
  playError: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};

const Ctx = createContext<SoundContextValue | null>(null);

export function useUiSound() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUiSound must be used within SoundProvider");
  return ctx;
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  // Default true (on) is the safe SSR-compatible value — localStorage isn't
  // available during server rendering, so that's what the server and the
  // hydrating render use before the stored preference takes over.
  const [enabled, setEnabled] = useStoredBoolean(STORAGE_KEY, true);

  const [rawPlaySuccess] = useSound("/sounds/success.wav", { volume: 0.5 });
  const [rawPlayDelete] = useSound("/sounds/delete.wav", { volume: 0.5 });
  const [rawPlayError] = useSound("/sounds/error.wav", { volume: 0.5 });

  function playSuccess() {
    if (enabled) rawPlaySuccess();
  }
  function playDelete() {
    if (enabled) rawPlayDelete();
  }
  function playError() {
    if (enabled) rawPlayError();
  }

  return (
    <Ctx.Provider value={{ playSuccess, playDelete, playError, enabled, setEnabled }}>
      {children}
    </Ctx.Provider>
  );
}
