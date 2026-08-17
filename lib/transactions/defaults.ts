import { isBankAccount, type AccountType } from "@/lib/accounts/meta";
import type { QuickAddAccount, QuickAddCategory } from "./queries";
import type { TransactionType } from "./schema";

/** A recent transaction, narrowed to the columns the defaults actually read. */
export type RecentRow = {
  account_id: string | null;
  category_id: string | null;
  type: TransactionType;
};

/** Category ids, most-used first.
 *
 *  Expenses only: income carries no category at all, and a payment defaults to
 *  the "none" sentinel, so counting either would rank noise above the
 *  categories a person actually picks. */
export function rankCategoryIds(recent: RecentRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recent) {
    if (r.type !== "expense" || !r.category_id) continue;
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** The source account of the newest row that has one.
 *
 *  Relies on the caller passing rows newest-first — re-sorting here would mean
 *  duplicating the query's `occurred_at, id` ordering in two places. */
export function recentSourceAccountId(recent: RecentRow[]): string | null {
  return recent.find((r) => r.account_id)?.account_id ?? null;
}

/** Which account a new transaction should start on.
 *
 *  Falling back to `accounts[0]` alone would pick whatever the query happened
 *  to return first — a card or loan is a bad default source for an expense — so
 *  a bank account is preferred before that last resort. */
export function defaultAccount(
  accounts: QuickAddAccount[],
  { preferredId, recentAccountId }: { preferredId?: string; recentAccountId?: string | null },
): QuickAddAccount | undefined {
  const find = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id) : undefined;
  return (
    find(preferredId) ??
    find(recentAccountId) ??
    accounts.find((a) => isBankAccount(a.type as AccountType)) ??
    accounts[0]
  );
}

/** Categories with the most-used ones hoisted to the front.
 *
 *  Applied to the chip rail only. The full `Select` keeps the catalogue in
 *  `sort_order`, because a picker whose options move around between opens is
 *  harder to use than one that is merely long. */
export function orderCategories(
  categories: QuickAddCategory[],
  order: string[],
): QuickAddCategory[] {
  const ranked = order
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is QuickAddCategory => c !== undefined);
  const rankedIds = new Set(ranked.map((c) => c.id));
  return [...ranked, ...categories.filter((c) => !rankedIds.has(c.id))];
}
