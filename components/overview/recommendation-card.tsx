"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { ColorTile } from "@/components/ui/color-tile";
import { toneColor } from "@/lib/overview/recommendation/tone";
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

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    setPending(!rec);

    /* `void` rather than `await`: this must never join anything the page is
       waiting on. Same reason it is voided in subscription-form-dialog.tsx. */
    void refreshRecommendation().then(({ refreshed }) => {
      setPending(false);
      if (refreshed) router.refresh();
    });
  }, [stale, rec, router]);

  if (rec) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <ColorTile color={toneColor(rec.tone)} icon={Sparkles} size="md" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("recommendationTitle")}</p>
            <p className="mt-0.5 font-medium text-foreground">{rec.headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{rec.body}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (pending) {
    return (
      <Card className="p-5" aria-busy aria-label={t("recommendationLoading")}>
        <div className="flex items-start gap-3">
          <div className="skeleton size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  /* Nothing cached and nothing coming. No error, no retry button — an absent
     recommendation is a missing nicety, and the page reads fine without it. */
  return null;
}
