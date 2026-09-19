"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Recommendation } from "@/lib/overview/recommendation/llm";
import { refreshRecommendation } from "@/app/(app)/actions";

/**
 * Stale-while-revalidate, on the client because that is the only place a
 * generation this slow can be started without holding the page.
 *
 * `rec` renders immediately whatever its age; if `stale`, the action runs in
 * the background and `router.refresh()` swaps in the new text when it lands.
 * The person therefore reads this morning's sentence while this evening's is
 * being written, and the only blank card is the first one ever.
 */
export function RecommendationCard({
  rec,
  stale,
}: {
  rec: Recommendation | null;
  stale: boolean;
}) {
  const t = useTranslations("Overview");
  const router = useRouter();
  const [pending, setPending] = useState(stale && !rec);
  /* React invokes effects twice in development. Without this the first visit
     spends two inference calls to write one row. */
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    /* Re-armed on every run, and deliberately ahead of the started-guard
       below: React's development double-invoke runs the cleanup between the
       two passes, so setting this anywhere after the early return would leave
       it false for the life of the mount and swallow the refresh in dev only. */
    mounted.current = true;

    if (stale && !started.current) {
      started.current = true;
      setPending(!rec);

      /* `void` rather than `await`: this must never join anything the page is
         waiting on. Same reason it is voided in subscription-form-dialog.tsx. */
      void refreshRecommendation().then(({ refreshed }) => {
        /* Navigated away mid-generation. The row was still written — the
           request is not aborted on unmount, which is what we want — but
           there is no skeleton left to clear, and refreshing here would
           re-fetch whichever page they are on now instead of this one. */
        if (!mounted.current) return;
        setPending(false);
        if (refreshed) router.refresh();
      });
    }

    return () => {
      mounted.current = false;
    };
  }, [stale, rec, router]);

  if (rec) {
    return (
      <aside className="border-l-2 border-(--ink) pl-4">
        <p className="legend text-[10px] text-muted-foreground">{t("recommendationTitle")}</p>
        <p className="mt-1 font-medium text-foreground">{rec.headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{rec.body}</p>
      </aside>
    );
  }

  if (pending) {
    return (
      <aside className="border-l-2 border-(--paper-line) pl-4" aria-busy aria-label={t("recommendationLoading")}>
        <div className="bg-(--paper-line) h-3 w-24 rounded" />
        <div className="skeleton mt-2 h-4 w-40 rounded" />
        <div className="skeleton mt-2 h-3 w-full rounded" />
        <div className="skeleton mt-1.5 h-3 w-2/3 rounded" />
      </aside>
    );
  }

  /* Nothing cached and nothing coming. No error, no retry button — an absent
     recommendation is a missing nicety, and the page reads fine without it. */
  return null;
}
