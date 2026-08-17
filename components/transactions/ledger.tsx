"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Search, ArrowLeftRight } from "lucide-react";
import { deleteTransaction, loadTransactions } from "@/app/(app)/transactions/actions";
import type {
  TransactionPage,
  TransactionWithRefs,
  TxnCursor,
  TxnFilters,
  QuickAddData,
} from "@/lib/transactions/queries";
import { TRANSACTION_TYPES } from "@/lib/transactions/schema";
import { TransactionRow } from "./transaction-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_GROUPS, accountOptionLabel, accountTypeMeta, type AccountType } from "@/lib/accounts/meta";
import { useUiSound } from "@/components/sound/sound-provider";

/* occurred_at is a plain calendar date stored as UTC midnight (no time-of-day
   component) — format it in UTC so the displayed day doesn't drift backward
   for users west of UTC, who'd otherwise see local-midnight roll it back a day. */
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Long enough that typing a merchant name is one query, not eight. */
const SEARCH_DEBOUNCE_MS = 300;

export function Ledger({
  initialPage,
  data,
}: {
  initialPage: TransactionPage;
  data: QuickAddData;
}) {
  const { accounts, categories } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("Transactions");
  const tType = useTranslations("TransactionTypes");
  const locale = useLocale();
  const { playDelete, playError } = useUiSound();
  const [type, setType] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* Filtering happens in Postgres now, not over an already-fetched array, so
     the ledger is no longer limited to whatever the first page happened to
     hold. The cost is a round trip per keystroke — hence the debounce. */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useMemo<TxnFilters>(
    () => ({
      type: type === "all" ? undefined : type,
      accountId: accountId === "all" ? undefined : accountId,
      categoryId: categoryId === "all" ? undefined : categoryId,
      search: debouncedSearch || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }),
    [type, accountId, categoryId, debouncedSearch, fromDate, toDate],
  );
  const hasFilters = Object.values(filters).some(Boolean);
  const filterKey = JSON.stringify(filters);

  const [rows, setRows] = useState(initialPage.rows);
  const [cursor, setCursor] = useState<TxnCursor | null>(initialPage.nextCursor);
  const [loading, startReload] = useTransition();
  const [loadingMore, startLoadMore] = useTransition();

  /* Only the newest request may write to state. Two filter changes in flight
     at once resolve in whatever order the network decides, and the older one
     landing last would leave the ledger showing results for a filter the user
     has already moved off. */
  const requestId = useRef(0);

  const reload = useCallback(() => {
    const id = ++requestId.current;
    startReload(async () => {
      const page = await loadTransactions(filters, null);
      if (id !== requestId.current) return;
      setRows(page.rows);
      setCursor(page.nextCursor);
    });
  }, [filters]);

  const loadMore = useCallback(() => {
    if (!cursor) return;
    const id = ++requestId.current;
    startLoadMore(async () => {
      const page = await loadTransactions(filters, cursor);
      if (id !== requestId.current) return;
      setRows((prev) => [...prev, ...page.rows]);
      setCursor(page.nextCursor);
    });
  }, [cursor, filters]);

  /* A save anywhere in the app — including Quick Add, which lives outside this
     component — ends in router.refresh(), re-rendering the page and handing
     down a fresh first page. That page is only ever the *unfiltered* first 50,
     so it can't just be adopted: it would discard whatever the user had
     scrolled to and ignore the filters on screen. Replaying the ledger's own
     query costs one duplicated round trip per save and is the only version
     that stays right under a filter, mid-scroll, or both.

     Compared during render rather than in an effect — the shape React
     documents for "reset some state when a prop changes". */
  const [seed, setSeed] = useState(initialPage);
  const [refreshToken, setRefreshToken] = useState(0);
  if (seed !== initialPage) {
    setSeed(initialPage);
    setRefreshToken((n) => n + 1);
  }

  // Skip the run this would make on mount: the server already handed us page
  // one, and refetching it would be a wasted round trip on every visit.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    reload();
    // filterKey, not `filters` — the object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, refreshToken]);

  /* Infinite scroll. The sentinel is the Load-more button itself, so the same
     element serves a mouse-and-scroll user, a keyboard user, and anyone whose
     browser never fires the observer. rootMargin starts the fetch a screen
     early, which is what makes it read as continuous rather than as a stall. */
  const sentinel = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loading, loadingMore, loadMore]);

  const byDay = useMemo(() => {
    const map = new Map<string, TransactionWithRefs[]>();
    for (const t of rows) {
      const key = new Date(t.occurred_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [rows]);

  // Groups the (already-ordered) day sections under a sticky month pill.
  // Presentational only — it doesn't touch the row order, so it relies
  // on same-month days being contiguous, which holds as long as the ledger
  // stays sorted by date.
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale],
  );
  const byMonth = useMemo(() => {
    const map = new Map<string, [string, TransactionWithRefs[]][]>();
    for (const entry of byDay) {
      const [day] = entry;
      const monthKey = day.slice(0, 7); // "YYYY-MM"
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(entry);
    }
    return [...map.entries()].map(([monthKey, days]) => {
      const [y, m] = monthKey.split("-").map(Number);
      return { monthKey, label: monthFormatter.format(new Date(y, m - 1, 1)), days };
    });
  }, [byDay, monthFormatter]);

  /* Value→label maps for the closed trigger. Base UI's `<Select.Value>`
     renders the raw value unless `items` is given on the root, so these
     filters showed bare UUIDs and untranslated type keys. The "all"
     sentinel needs an entry too. */
  const typeItems: Record<string, string> = {
    all: t("allTypes"),
    ...Object.fromEntries(TRANSACTION_TYPES.map((tt) => [tt, tType(tt)])),
  };
  const accountItems: Record<string, string> = {
    all: t("allAccounts"),
    ...Object.fromEntries(accounts.map((a) => [a.id, accountOptionLabel(a)])),
  };
  const categoryItems: Record<string, string> = {
    all: t("allCategories"),
    ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
  };

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("transactionDeleted"));
        playDelete();
        // Drop it here too: the pages below the first are client-held, so a
        // server refresh alone would leave a deleted row on screen.
        setRows((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex gap-2 sm:contents">
          <div className="relative flex-[2]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={type} onValueChange={(v) => setType(v ?? "all")} items={typeItems}>
            <SelectTrigger className="flex-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              {TRANSACTION_TYPES.map((tt) => (
                <SelectItem key={tt} value={tt}>
                  {tType(tt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 sm:contents">
          <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "all")} items={accountItems}>
            <SelectTrigger className="flex-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allAccounts")}</SelectItem>
              {ACCOUNT_GROUPS.map((g) => {
                const items = accounts.filter(
                  (a) => accountTypeMeta(a.type as AccountType).group === g.key,
                );
                if (items.length === 0) return null;
                return (
                  <SelectGroup key={g.key}>
                    <SelectLabel>{g.title}</SelectLabel>
                    {items.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {accountOptionLabel(a)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "all")} items={categoryItems}>
            <SelectTrigger className="flex-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5 sm:col-span-2">
          <Input
            type="date"
            aria-label={t("dateFromAria")}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full"
          />
          <span className="text-sm text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label={t("dateToAria")}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <EmptyState
            icon={<ArrowLeftRight className="size-6" />}
            title={hasFilters ? t("emptyTitleFiltered") : t("emptyTitleNone")}
            description={hasFilters ? t("emptyDescriptionFiltered") : t("emptyDescriptionNone")}
          />
        )
      ) : (
        <div className={loading ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
          {byMonth.map(({ monthKey, label, days }) => (
            <div key={monthKey}>
              <h2 className="sticky top-14 z-10 -mx-1 mb-1 py-2 md:top-0">
                <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur">
                  {label}
                </span>
              </h2>
              <div className="space-y-6">
                {days.map(([day, rowsOfDay]) => (
                  <div key={day}>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {dayFormatter.format(new Date(day))}
                    </p>
                    <div className="divide-y">
                      {rowsOfDay.map((txn) => (
                        <TransactionRow
                          key={txn.id}
                          txn={txn}
                          data={data}
                          onDelete={onDelete}
                          pending={pending}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The end of the ledger says so. The old one just stopped at 200 rows
          with nothing to distinguish "that's everything" from "that's all we
          fetched", which is the difference between a complete record and one
          the user has no reason to trust. */}
      {rows.length > 0 ? (
        <div className="pt-2 text-center">
          {cursor ? (
            <Button
              ref={sentinel}
              variant="ghost"
              onClick={loadMore}
              disabled={loadingMore}
              isLoading={loadingMore}
            >
              {loadingMore ? t("loadingMore") : t("loadMore")}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("endOfLedger", { count: rows.length })}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
