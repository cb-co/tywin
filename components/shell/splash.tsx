"use client";

import { useEffect, useState } from "react";
import { Logo, Wordmark } from "@/components/brand/logo";
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
      className="splash fixed inset-0 z-[100] flex items-center justify-center bg-background"
    >
      <div className="splash-mark flex items-center gap-3">
        <Logo className="h-11 w-11 rounded-[0.85rem]" />
        <Wordmark className="text-2xl" />
      </div>
    </div>
  );
}
