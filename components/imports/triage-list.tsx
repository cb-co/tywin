"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { categorizeTriageGroup } from "@/app/(app)/imports/actions";
import { orderCategories } from "@/lib/transactions/defaults";
import { CategoryRail } from "@/components/transactions/category-rail";
import { DoneStamp } from "@/components/imports/done-stamp";
import { LedgerRow } from "@/components/papel/ledger-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUiSound } from "@/components/sound/sound-provider";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TriageGroup } from "@/lib/statements/triage";
import type { QuickAddCategory } from "@/lib/transactions/queries";

export function TriageList({
  importId,
  groups,
  categories,
  categoryOrder,
  totalLines,
  categorizedLines,
  fresh,
  accountId,
}: {
  importId: string;
  groups: TriageGroup[];
  /** Full catalogue, `sort_order` — what the "more" picker offers. */
  categories: QuickAddCategory[];
  /** Category ids, most-used first — same ranking `TransactionForm` uses for
   *  its own rail. */
  categoryOrder: string[];
  totalLines: number;
  categorizedLines: number;
  /** True only for the redirect straight out of an import; see the note by
   *  `frozen` below for why this can't just be re-derived from props on
   *  every refresh. */
  fresh: boolean;
  /** The account this import landed on — where the empty state's exit link
   *  goes. Null for the (rare) import with no statements at all, in which
   *  case the empty state renders without an action rather than guessing. */
  accountId: string | null;
}) {
  const t = useTranslations("Imports");
  // Reused rather than duplicated: this is the same label CategoryRail's own
  // radiogroup carries, and the trigger below stands in for that rail while
  // it's open.
  const tCategory = useTranslations("TransactionForm");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [focused, setFocused] = useState(0);
  // Which group's rail has been swapped for the full picker. Only one at a
  // time: opening a second closes the first, the same way a native <select>
  // would.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const { playSuccess, playError } = useUiSound();
  const listRef = useRef<HTMLUListElement>(null);

  // Most-used first, for the rail and for the digit shortcuts below — 1-5
  // line up with the five chips CategoryRail actually renders. The full
  // picker ("more") keeps sort_order, the same split transaction-form uses.
  const railCategories = orderCategories(categories, categoryOrder);
  const categoryItems: Record<string, string> = Object.fromEntries(
    categories.map((c) => [c.id, `${c.emoji ? `${c.emoji} ` : ""}${c.name}`]),
  );

  /* "automáticamente" is only true at the instant the user lands here from
     the import: nothing in the schema records whether a category came from a
     rule or from a person, so recomputing it off live props would go wrong
     the moment the user assigns a group by hand — `assign` below calls
     `router.refresh()`, which re-fetches the page's server props (raising
     `categorizedLines`) while `fresh` stays true, since it lives in the URL
     and this call never touches it. Freezing the two numbers in state at
     first mount — which a refresh does not re-run — is what keeps the
     sentence honest for the rest of the visit. Every later visit starts
     `fresh={false}` and never reads this at all. */
  const [frozen] = useState({ done: categorizedLines, total: totalLines });
  const remaining = totalLines - categorizedLines;
  const summary = fresh ? t("autoSummary", frozen) : t("remaining", { count: remaining });

  /* Keyboard, on the screen whose entire point is speed. ↑/↓ move between
     groups and a digit assigns from the same ranked list the rail is built
     from — so 1–5 are exactly the five chips visible on the focused card, and
     6–9 reach four more that would otherwise cost a trip through "more".
     Touch and mouse are unaffected; this is additive. */
  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (pending || groups.length === 0) return;
    // The full picker owns the keyboard while it's open: Base UI's
    // SelectContent renders through a React portal, and React still bubbles
    // its synthetic events up through the portal's React-tree ancestors (this
    // <ul>, in particular) rather than stopping at the DOM boundary. Without
    // this guard, arrowing through the picker's own options would also drag
    // the card ring around underneath it.
    if (expandedKey) return;
    const focusedIndex = Math.min(focused, groups.length - 1);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? focusedIndex + 1 : focusedIndex - 1;
      setFocused(Math.min(groups.length - 1, Math.max(0, next)));
      return;
    }
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      const category = railCategories[digit - 1];
      const group = groups[focusedIndex];
      if (category && group) {
        e.preventDefault();
        assign(group, category.id);
      }
    }
  }

  function assign(group: TriageGroup, categoryId: string) {
    setBusyKey(group.key);
    setExpandedKey(null);
    startTransition(async () => {
      const result = await categorizeTriageGroup(importId, group.key, categoryId);
      setBusyKey(null);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      const category = categories.find((c) => c.id === categoryId);
      toast.success(
        t("assigned", { merchant: group.description, category: category?.name ?? "" }),
      );
      playSuccess();
      router.refresh();
      // The rail button that held focus is about to unmount with its group;
      // park focus on the list so keyboard users aren't dropped to the page.
      listRef.current?.focus();
    });
  }

  const focusedIndex = Math.min(focused, Math.max(0, groups.length - 1));

  // Finishing is detected during render (the previous-count pattern, as in
  // ledger.tsx), not in an effect: it flips only on the transition to zero, so
  // arriving at an already-finished triage shows the mark still.
  const [prevCount, setPrevCount] = useState(groups.length);
  const [justFinished, setJustFinished] = useState(false);
  if (groups.length !== prevCount) {
    setPrevCount(groups.length);
    if (prevCount > 0 && groups.length === 0) setJustFinished(true);
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">{summary}</p>

      {groups.length === 0 ? (
        // No second playSuccess here: the last assignment's own playSuccess
        // is the stamp sound.
        <Card className="items-center gap-4 p-8 text-center">
          <h2 className="sr-only">{t("allDone")}</h2>
          <div aria-hidden>
            <DoneStamp label={t("allDone")} animate={justFinished} />
          </div>
          <p className="text-sm text-muted-foreground">{t("allDoneBody")}</p>
          {accountId ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/accounts/${accountId}`} />}
            >
              {t("backToAccount")}
            </Button>
          ) : null}
        </Card>
      ) : (
        // tabIndex so the list itself can hold focus and receive the keys;
        // the rail buttons and the "more" picker inside stay individually
        // tabbable, which is what a screen reader and a Tab-only user need.
        <Card className="gap-0 overflow-hidden p-0">
          <ul ref={listRef} className="focus-visible:outline-none" tabIndex={0} onKeyDown={onKeyDown}>
            {groups.map((group, i) => (
              <li
                key={group.key}
                className={cn(
                  "border-b-2 border-(--rule) last:border-b-0",
                  busyKey === group.key && "opacity-60",
                  i === focusedIndex && "outline-2 -outline-offset-2 outline-current",
                )}
              >
                <LedgerRow
                  className="border-b-0 px-4 pt-3"
                  title={group.description}
                  subtitle={`${t("groupLines", { count: group.count })} · ${t("groupDates", { from: formatDate(group.firstDate, locale), to: formatDate(group.lastDate, locale) })}`}
                  amount={<span className="text-sm font-semibold">{formatMoney(group.total, group.currency)}</span>}
                />
                <div className="px-4 pb-3">
                    {expandedKey === group.key ? (
                      <Select
                        items={categoryItems}
                        value=""
                        open
                        onOpenChange={(next) => {
                          if (!next) setExpandedKey(null);
                        }}
                        onValueChange={(id) => {
                          if (id) assign(group, id);
                        }}
                      >
                        <SelectTrigger
                          className="w-full"
                          size="sm"
                          aria-label={tCategory("categoryLabel")}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.emoji ? `${c.emoji} ` : ""}
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <CategoryRail
                        categories={railCategories}
                        value=""
                        onChange={(id) => !pending && assign(group, id)}
                        onMore={() => setExpandedKey(group.key)}
                      />
                    )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
