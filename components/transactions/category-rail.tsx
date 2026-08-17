"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { QuickAddCategory } from "@/lib/transactions/queries";

/** How many chips before the overflow. Five is what fits on the narrowest
 *  phone this app targets without the rail needing a scroll to reveal that it
 *  scrolls. */
const VISIBLE = 5;

/** The category picker for compact mode.
 *
 *  A rail rather than a Select because category is the field most often
 *  changed in the app's most repeated action, and a dropdown costs an open, a
 *  scroll and a tap where a chip costs one. The full catalogue stays one tap
 *  away, so nothing is lost for the long tail. */
export function CategoryRail({
  categories,
  value,
  onChange,
  onMore,
}: {
  categories: QuickAddCategory[];
  value: string;
  onChange: (id: string) => void;
  onMore: () => void;
}) {
  const t = useTranslations("TransactionForm");
  const shown = categories.slice(0, VISIBLE);
  /* A category picked from the full list is kept on the rail even when it does
     not rank, or the chosen chip would vanish the moment it was chosen. */
  const selectedOffRail =
    value && !shown.some((c) => c.id === value)
      ? categories.find((c) => c.id === value)
      : undefined;

  return (
    <div
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      role="radiogroup"
      aria-label={t("categoryLabel")}
    >
      {[...(selectedOffRail ? [selectedOffRail] : []), ...shown].map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === c.id
              ? "border-primary bg-primary/10 text-foreground"
              : "border-input text-muted-foreground hover:text-foreground",
          )}
        >
          {c.emoji ? <span aria-hidden>{c.emoji}</span> : null}
          {c.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onMore}
        className="shrink-0 rounded-full border border-dashed border-input px-3 py-1.5 text-sm text-muted-foreground whitespace-nowrap hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {t("moreCategories")}
      </button>
    </div>
  );
}
