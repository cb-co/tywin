import { createClient } from "@/lib/supabase/server";
import type { CurrencyRow } from "@/lib/accounts/queries";

export type TxnFilters = {
  type?: string;
  accountId?: string;
  categoryId?: string;
  search?: string;
};

export async function getTransactions(filters: TxnFilters = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select(
      "*, account:accounts!transactions_account_id_fkey(id,name,currency,type), to_account:accounts!transactions_to_account_id_fkey(id,name), category:categories!transactions_category_id_fkey(id,name,emoji,color)",
    )
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (filters.type) q = q.eq("type", filters.type as "expense" | "income" | "payment");
  if (filters.accountId) q = q.eq("account_id", filters.accountId);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters.search) q = q.ilike("description", `%${filters.search}%`);

  const { data } = await q;
  return data ?? [];
}

export type TransactionWithRefs = Awaited<ReturnType<typeof getTransactions>>[number];

/** Transactions touching an account as either source or destination. */
export async function getAccountTransactions(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select(
      "*, account:accounts!transactions_account_id_fkey(id,name,currency,type), to_account:accounts!transactions_to_account_id_fkey(id,name), category:categories!transactions_category_id_fkey(id,name,emoji,color)",
    )
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
  bank: string | null;
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
};

export async function getQuickAddData(): Promise<QuickAddData> {
  const supabase = await createClient();
  const [{ data: accounts }, { data: categories }, { data: currencies }, { data: profile }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id,name,currency,type,network_fee_optional,bank")
        .eq("is_archived", false)
        .order("sort_order"),
      supabase.from("categories").select("id,name,emoji,color").order("sort_order"),
      supabase.from("currencies").select("*").order("code"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
    ]);

  return {
    accounts: accounts ?? [],
    categories: categories ?? [],
    currencies: currencies ?? [],
    baseCurrency: profile?.base_currency ?? "USD",
  };
}
