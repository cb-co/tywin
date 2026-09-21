"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Seal } from "@/components/papel/seal";
import { Guilloche } from "@/components/papel/guilloche";
import { SPLASH_SEEN_KEY } from "@/lib/splash";

const HOLD_MS = 700;
const FADE_MS = 420;

/** The companion pre-paint script lives in `app/layout.tsx`. It has to be
 *  rendered by a Server Component, so it cannot sit in this file. */
export function Splash() {
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);

  /* Both skip paths (already seen, reduced motion) are handled in CSS by the
   * pre-paint script above, so this effect has no branch to take: it marks
   * the session and tears the node down on the same schedule either way. For
   * a skipped splash the element was never visible, so the teardown is
   * invisible bookkeeping. */
  useEffect(() => {
    try {
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    } catch {
      /* Non-fatal: the splash just shows again on the next load. */
    }

    const fade = setTimeout(() => setLeaving(true), HOLD_MS);
    const drop = setTimeout(() => setMounted(false), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(drop);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      // Decorative: the app behind it is the real content, and screen
      // reader users get no benefit from being told a logo appeared.
      aria-hidden
      data-leaving={leaving ? "" : undefined}
      className="splash fixed inset-0 z-[100] flex items-center justify-center bg-(--note) text-(--note-ink)"
    >
      <Guilloche
        variant="rosette"
        className="absolute left-1/2 top-1/2 size-[min(80vw,28rem)] -translate-x-1/2 -translate-y-1/2 opacity-40"
        duration={700}
      />
      <div className="splash-mark relative flex flex-col items-center gap-3">
        <Seal className="size-14" />
        <Wordmark className="text-xl" />
      </div>
    </div>
  );
}
