"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { transactionInput, type TransactionInput } from "@/lib/transactions/schema";
import { dbError } from "@/lib/errors";

type Result = { error?: string; id?: string };

function toRow(v: TransactionInput) {
  const payment = v.type === "payment";
  return {
    type: v.type,
    account_id: v.account_id,
    to_account_id: payment ? v.to_account_id || null : null,
    category_id: v.type === "income" ? null : v.category_id || null,
    amount: v.amount,
    // Destination leg. Null on a same-currency payment — the DB mirrors `amount`.
    to_amount: payment ? v.to_amount ?? null : null,
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

/** Statement-sourced rows die only with their statement; edits may touch only
 *  category and notes — the imported line is the source of truth for the rest. */
async function statementGuard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<{ row: { statement_line_id: string | null; category_id: string | null; notes: string | null } | null }> {
  const { data } = await supabase
    .from("transactions")
    .select("statement_line_id,category_id,notes")
    .eq("id", id)
    .maybeSingle();
  return { row: data };
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

  if (error) return { error: await dbError(error, "createTransaction") };
  revalidate();
  return { id: data.id };
}

export async function updateTransaction(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };

  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  // Statement-sourced rows: the imported line owns type/amount/account/date/
  // description; only the category and notes may change here.
  const { row } = await statementGuard(supabase, id);
  if (row?.statement_line_id) {
    const { error } = await supabase
      .from("transactions")
      .update({
        category_id: parsed.data.category_id || null,
        notes: parsed.data.notes || null,
      })
      .eq("id", id);
    if (error) return { error: await dbError(error, "updateTransaction") };
    revalidate();
    return { id };
  }

  // Never send currency/exchange_rate — the DB forbids changing them.
  const { error } = await supabase.from("transactions").update(toRow(parsed.data)).eq("id", id);
  if (error) return { error: await dbError(error, "updateTransaction") };
  revalidate();
  return { id };
}

export async function deleteTransaction(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { row } = await statementGuard(supabase, id);
  if (row?.statement_line_id) return { error: t("statementRowLocked") };

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteTransaction") };
  revalidate();
  return {};
}
