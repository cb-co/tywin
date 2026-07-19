"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { transactionInput, type TransactionInput } from "@/lib/transactions/schema";

type Result = { error?: string; id?: string };

function toRow(v: TransactionInput) {
  const payment = v.type === "payment";
  return {
    type: v.type,
    account_id: v.account_id,
    to_account_id: payment ? v.to_account_id || null : null,
    category_id: v.type === "income" ? null : v.category_id || null,
    amount: v.amount,
    include_tax: v.include_tax,
    include_commission: v.include_commission,
    budget_only: v.type === "expense" ? v.budget_only : false,
    occurred_at: new Date(v.occurred_at).toISOString(),
    description: v.description || null,
    notes: v.notes || null,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function createTransaction(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };

  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  // currency + exchange_rate are set only on insert (immutable thereafter).
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      ...toRow(parsed.data),
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidate();
  return { id: data.id };
}

export async function updateTransaction(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };

  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  // Never send currency/exchange_rate — the DB forbids changing them.
  const { error } = await supabase.from("transactions").update(toRow(parsed.data)).eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { id };
}

export async function deleteTransaction(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}
