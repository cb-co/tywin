"use client";

import { useEffect, useRef, useState } from "react";

/** Long enough to read as counting, short enough not to delay the real number. */
const DURATION = 900;

/** Decelerate, matching --ease-out-soft's character. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates a number up to `value`, for figures worth watching arrive.
 *
 * This is a hook rather than a component because its only consumer is
 * MoneyDisplay, which needs the numeric value in order to split it into a head
 * and a de-emphasised cents tail. A component returning JSX could not hand that
 * back.
 *
 * Three things it has to get right:
 *
 *   1. SSR. The initial state is the FINAL value, not zero, so the server
 *      markup and the first client render agree. The count is started from an
 *      effect, which runs after that first paint — so the worst case is one
 *      frame of the true figure before it rewinds, never a hydration mismatch
 *      and never a number the server disagreed about.
 *   2. `prefers-reduced-motion: reduce`. Checked at animation time rather than
 *      through a state variable, because the answer only matters at the instant
 *      the count would start, and reading it live avoids another render.
 *   3. `enabled: false` must be inert. Callers pass false when figures are
 *      masked — counting up a row of glyphs animates nothing legible and just
 *      makes the mask look broken.
 *
 * Subsequent changes to `value` animate from wherever the last one finished,
 * so a figure that updates in place slides rather than jumping.
 */
export function useCountUp(value: number, enabled: boolean) {
  // `null` means "not counting — show the real figure". Every write to this
  // happens inside a requestAnimationFrame callback, never in the effect body:
  // setting state synchronously from an effect cascades renders, and the
  // non-counting paths do not need state at all because the hook can just
  // return `value`.
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    if (!enabled) {
      from.current = value;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      return;
    }

    const start = from.current;
    const delta = value - start;
    if (delta === 0) return;

    let frame = 0;
    let t0: number | null = null;

    const step = (now: number) => {
      t0 ??= now;
      const p = Math.min(1, (now - t0) / DURATION);
      const current = start + delta * easeOut(p);
      from.current = current;
      if (p < 1) {
        setShown(current);
        frame = requestAnimationFrame(step);
      } else {
        // Land exactly on the target — easing arithmetic gets close, not equal,
        // and a balance one ten-thousandth off would round wrong at the edges.
        // Handing back `null` rather than `value` also means a later change of
        // `enabled` cannot leave a stale figure on screen.
        from.current = value;
        setShown(null);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, enabled]);

  // `enabled` is re-checked here so switching it off mid-count immediately
  // reveals the true figure rather than freezing on a partial one.
  return enabled && shown !== null ? shown : value;
}
