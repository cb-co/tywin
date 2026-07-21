"use client";

import { createContext, useContext, useEffect, useState } from "react";
import useSound from "use-sound";

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

function readStoredPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  // Default true (on) is the safe SSR-compatible value — localStorage isn't
  // available during server rendering, so the real preference is read back
  // in the effect below, client-only, same pattern as the theme toggle.
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    setEnabledState(readStoredPreference());
  }, []);

  function setEnabled(v: boolean) {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* Non-fatal: the preference just won't persist across reloads. */
    }
  }

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
