"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function Ledger({
  transactions,
  accounts,
  categories,
}: {
  transactions: TransactionWithRefs[];
  accounts: QuickAddData["accounts"];
  categories: QuickAddData["categories"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (accountId !== "all" && t.account_id !== accountId && t.to_account_id !== accountId)
        return false;
      if (categoryId !== "all" && t.category_id !== categoryId) return false;
      if (q && !(t.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, type, accountId, categoryId, search]);

  const byDay = useMemo(() => {
    const map = new Map<string, TransactionWithRefs[]>();
    for (const t of filtered) {
      const key = new Date(t.occurred_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()];
  }, [filtered]);

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Transaction deleted");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search descriptions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v ?? "all")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-6" />}
          title={transactions.length === 0 ? "No transactions yet" : "Nothing matches those filters"}
          description={
            transactions.length === 0
              ? "Use Quick-Add (the + button or ⌘K) to log your first expense, income, or payment."
              : "Try clearing a filter or search term."
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
                  <TransactionRow key={txn.id} txn={txn} onDelete={onDelete} pending={pending} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
