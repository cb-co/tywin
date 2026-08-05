"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { backfillCardArt } from "@/app/(app)/accounts/actions";

/**
 * Resolves art for cards that predate the feature, once.
 *
 * Renders nothing. It exists because the work has to happen off the render
 * path: inference is a network round trip per card, and doing it inside the
 * page's own data fetch would hold the accounts list hostage to an LLM call
 * every time anyone opened it.
 *
 * `pending` is passed by the server as the count of cards with no accent, so
 * this stays inert on the overwhelming majority of visits — after one
 * successful pass there is nothing left to find and the component never fires
 * again. The ref guards the double-invoke that React's development StrictMode
 * does on mount, which would otherwise run every inference twice.
 */
export function CardArtBackfill({ pending }: { pending: number }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (pending === 0 || started.current) return;
    started.current = true;

    // Fire and forget. Nothing is shown while this runs and nothing is shown if
    // it fails: the cards are already on screen wearing the default colour,
    // which is a finished state, not a placeholder.
    backfillCardArt()
      .then(({ filled }) => {
        if (filled > 0) router.refresh();
      })
      .catch(() => {});
  }, [pending, router]);

  return null;
}
