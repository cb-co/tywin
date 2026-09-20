"use client";

import { useTranslations } from "next-intl";
import { Ellipsis } from "lucide-react";
import { Stamp } from "@/components/papel/stamp";
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
      className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto px-1 pb-1"
      role="radiogroup"
      aria-label={t("categoryLabel")}
    >
      {[...(selectedOffRail ? [selectedOffRail] : []), ...shown].map((c) => {
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={c.name}
            onClick={() => onChange(c.id)}
            className={cn(
              "flex w-[3.25rem] shrink-0 flex-col items-center gap-1 border-b-[3px] pb-1 pt-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
              on ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Stamp color={c.color} emoji={c.emoji} name={c.name} size="sm" className={on ? "stamp-inked" : undefined} />
            <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{c.name}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex w-[3.25rem] shrink-0 flex-col items-center gap-1 border-b-[3px] border-transparent pb-1 pt-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-(--ink-soft)">
          <Ellipsis aria-hidden className="size-[18px]" />
        </span>
        <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">{t("moreCategories")}</span>
      </button>
    </div>
  );
}
