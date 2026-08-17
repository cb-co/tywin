import { createClient } from "@/lib/supabase/server";
import type { CurrencyRow } from "@/lib/accounts/queries";
import { getExchangeRates } from "@/lib/fx";
import { baseCurrencyOf } from "@/lib/profile";
import { rankCategoryIds, recentSourceAccountId, type RecentRow } from "./defaults";
import { searchTerms } from "./search";

type Client = Awaited<ReturnType<typeof createClient>>;

const TXN_SELECT =
  "*, account:accounts!transactions_account_id_fkey(id,name,currency,type), to_account:accounts!transactions_to_account_id_fkey(id,name,currency), category:categories!transactions_category_id_fkey(id,name,emoji,color)";

function selectTransactions(supabase: Client) {
  return supabase.from("transactions").select(TXN_SELECT);
}

export type TransactionWithRefs = NonNullable<
  Awaited<ReturnType<typeof selectTransactions>>["data"]
>[number];

/** Rows per page. Big enough that a statement import doesn't need three
 *  scrolls, small enough that the first paint isn't a month of rows. */
export const TRANSACTIONS_PAGE_SIZE = 50;

export type TxnFilters = {
  type?: string;
  accountId?: string;
  categoryId?: string;
  search?: string;
  /** Inclusive `YYYY-MM-DD` bounds on `occurred_at`. */
  from?: string;
  to?: string;
};

/** Keyset position: the last row of the page just handed out. */
export type TxnCursor = { occurredAt: string; id: string };

export type TransactionPage = {
  rows: TransactionWithRefs[];
  /** Null once the ledger has been read to its end. */
  nextCursor: TxnCursor | null;
};

type TxnQuery = ReturnType<typeof selectTransactions>;

function applyTxnFilters(q: TxnQuery, f: TxnFilters): TxnQuery {
  if (f.type) q = q.eq("type", f.type as "expense" | "income" | "payment");
  // A payment shows up on both of its accounts, so filtering by account has
  // to match either leg — the same rule the ledger applied client-side.
  if (f.accountId) q = q.or(`account_id.eq.${f.accountId},to_account_id.eq.${f.accountId}`);
  if (f.categoryId) q = q.eq("category_id", f.categoryId);

  const terms = searchTerms(f.search ?? "");
  if (terms.length > 0) q = q.or(terms.join(","));

  // occurred_at is a calendar date stored at UTC midnight, so the bounds a
  // native date input produces are compared in UTC too — anything local would
  // drop the first or last day of the range for users off UTC.
  if (f.from) q = q.gte("occurred_at", `${f.from}T00:00:00.000Z`);
  if (f.to) q = q.lte("occurred_at", `${f.to}T23:59:59.999Z`);

  return q;
}

/**
 * One page of the ledger, newest first.
 *
 * Keyset rather than offset: the ledger is read newest-first while new rows
 * are inserted at that same end, and an offset would show a row twice or skip
 * one every time that happens mid-scroll.
 */
export async function getTransactions(
  filters: TxnFilters = {},
  cursor?: TxnCursor | null,
  pageSize: number = TRANSACTIONS_PAGE_SIZE,
): Promise<TransactionPage> {
  const supabase = await createClient();
  let q = applyTxnFilters(selectTransactions(supabase), filters)
    .order("occurred_at", { ascending: false })
    // occurred_at alone is not a total order — it has no time-of-day component,
    // so a single day holds many rows and the cursor would stall on it forever.
    .order("id", { ascending: false })
    // Reading one extra row is the only honest "is there more?" signal: a page
    // that comes back exactly full is otherwise indistinguishable from the last.
    .limit(pageSize + 1);

  if (cursor) {
    const at = new Date(cursor.occurredAt).toISOString();
    q = q.or(`occurred_at.lt.${at},and(occurred_at.eq.${at},id.lt.${cursor.id})`);
  }

  const { data } = await q;
  const rows = data ?? [];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page.at(-1);

  return {
    rows: page,
    nextCursor: hasMore && last ? { occurredAt: last.occurred_at, id: last.id } : null,
  };
}

/** Transactions touching an account as either source or destination. */
export async function getAccountTransactions(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select(TXN_SELECT)
    .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
    .order("occurred_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export type QuickAddAccount = {
  id: string;
  name: string;
  currency: string;
  type: string;
  network_fee_optional: boolean;
  bank_id: string | null;
  /* Both are needed client-side to preview what a row will cost before it is
     saved; the stored figures still come from the insert trigger. */
  transfer_tax_rate: number;
  network_fee_amount: number;
};
export type QuickAddCategory = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
};

export type QuickAddData = {
  accounts: QuickAddAccount[];
  categories: QuickAddCategory[];
  currencies: CurrencyRow[];
  baseCurrency: string;
  /** Source account of the most recent expense/payment, for pre-selecting it
   *  on open. Null once there's no history to draw one from. */
  recentAccountId: string | null;
  /** Category ids, most-used first, for hoisting the chip rail. */
  categoryOrder: string[];
  /**
   * Market rates as units-per-1-base. Used only to offer a suggested rate on a
   * cross-currency payment — the rate a transaction is stored with is derived
   * server-side at insert, not from this.
   */
  rates: Record<string, number>;
};

export async function getQuickAddData(): Promise<QuickAddData> {
  const supabase = await createClient();
  const [
    { data: accounts },
    { data: categories },
    { data: currencies },
    { data: profile },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "id,name,currency,type,network_fee_optional,bank_id,transfer_tax_rate,network_fee_amount",
      )
      .eq("is_archived", false)
      .order("sort_order")
      .order("created_at"),
    supabase.from("categories").select("id,name,emoji,color").order("sort_order"),
    supabase.from("currencies").select("*").order("code"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
    /* Enough history to rank categories meaningfully without paying for a full
       scan. Ordered by id as a tiebreak because occurred_at is date-only, so
       several rows a day share a timestamp and the "most recent account" would
       otherwise be arbitrary among them. */
    supabase
      .from("transactions")
      .select("account_id,category_id,type")
      .in("type", ["expense", "payment"])
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(60),
  ]);

  const baseCurrency = baseCurrencyOf(profile);
  const recentRows = (recent ?? []) as RecentRow[];

  return {
    accounts: accounts ?? [],
    categories: categories ?? [],
    currencies: currencies ?? [],
    baseCurrency,
    recentAccountId: recentSourceAccountId(recentRows),
    categoryOrder: rankCategoryIds(recentRows),
    // Sequential on purpose — the base currency is the request. Cached for 12h
    // by lib/fx, so this is a network hop once a day, not once a modal.
    rates: await getExchangeRates(baseCurrency),
  };
}
