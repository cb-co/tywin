"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Search, ArrowLeftRight } from "lucide-react";
import { deleteTransaction } from "@/app/(app)/transactions/actions";
import type { TransactionWithRefs, QuickAddData } from "@/lib/transactions/queries";
import { TRANSACTION_TYPES } from "@/lib/transactions/schema";
import { TransactionRow } from "./transaction-row";
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

export function Ledger({
  transactions,
  data,
}: {
  transactions: TransactionWithRefs[];
  data: QuickAddData;
}) {
  const { accounts, categories } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("Transactions");
  const tType = useTranslations("TransactionTypes");
  const { playDelete, playError } = useUiSound();
  const [type, setType] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (accountId !== "all" && t.account_id !== accountId && t.to_account_id !== accountId)
        return false;
      if (categoryId !== "all" && t.category_id !== categoryId) return false;
      if (q && !(t.description ?? "").toLowerCase().includes(q)) return false;
      // occurred_at is a calendar date at UTC midnight (see dayFormatter
      // comment above); slicing to its date part lets us compare it
      // lexicographically against the "YYYY-MM-DD" values native date
      // inputs produce, with no timezone conversion to drift a day off.
      const day = t.occurred_at.slice(0, 10);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    });
  }, [transactions, type, accountId, categoryId, search, fromDate, toDate]);

  const byDay = useMemo(() => {
    const map = new Map<string, TransactionWithRefs[]>();
    for (const t of filtered) {
      const key = new Date(t.occurred_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [filtered]);

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

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-6" />}
          title={transactions.length === 0 ? t("emptyTitleNone") : t("emptyTitleFiltered")}
          description={
            transactions.length === 0
              ? t("emptyDescriptionNone")
              : t("emptyDescriptionFiltered")
          }
        />
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, rows]) => (
            <div key={day}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {dayFormatter.format(new Date(day))}
              </p>
              <div className="divide-y">
                {rows.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} data={data} onDelete={onDelete} pending={pending} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
