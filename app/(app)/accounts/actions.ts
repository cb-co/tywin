"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accountInput, type AccountInput } from "@/lib/accounts/schema";
import { dbError } from "@/lib/errors";

type Result = { error?: string; id?: string };

const nullIf = <T>(cond: boolean, value: T) => (cond ? null : value);
const orNull = (v: string | undefined) => (v && v.length ? v : null);

/** Map validated input to account columns, nulling fields that don't apply to the type. */
function toColumns(v: AccountInput) {
  const card = v.type === "credit_card";
  const loan = v.type === "loan";
  return {
    name: v.name,
    type: v.type,
    starting_balance: loan ? 0 : v.starting_balance,
    color: orNull(v.color),
    bank_id: orNull(v.bank_id),
    transfer_tax_rate: v.transfer_tax_rate,
    network_fee_amount: v.network_fee_amount,
    network_fee_optional: v.network_fee_optional,

    credit_limit: nullIf(!card, v.credit_limit ?? null),
    statement_closing_day: nullIf(!card, v.statement_closing_day ?? null),
    current_balance: card ? v.current_balance : 0,
    card_group_id: nullIf(!card, orNull(v.card_group_id)),
    welcome_bonus_goal_amount: nullIf(!card, v.welcome_bonus_goal_amount ?? null),
    welcome_bonus_goal_currency: nullIf(!card, orNull(v.welcome_bonus_goal_currency)),
    welcome_bonus_due_date: nullIf(!card, orNull(v.welcome_bonus_due_date)),

    principal: nullIf(!loan, v.principal ?? null),
    interest_rate: nullIf(!loan, v.interest_rate ?? null),
    term_months: nullIf(!loan, v.term_months ?? null),
    original_term_months: nullIf(!loan, v.original_term_months ?? null),
    start_date: nullIf(!loan, orNull(v.start_date)),
    installment_amount: nullIf(!loan, v.installment_amount ?? null),

    // shared by cards and loans
    payment_due_day: nullIf(!card && !loan, v.payment_due_day ?? null),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createAccount(input: AccountInput): Promise<Result> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  const { data, error } = await supabase
    .from("accounts")
    .insert({ ...toColumns(parsed.data), currency: parsed.data.currency, user_id: user.id })
    .select("id")
    .single();

  if (error) return { error: await dbError(error, "createAccount") };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { id: data.id };
}

export async function updateAccount(id: string, input: AccountInput): Promise<Result> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  // currency is immutable — never included in the update payload.
  const columns = toColumns(parsed.data);
  const { error } = await supabase.from("accounts").update(columns).eq("id", id);
  if (error) return { error: await dbError(error, "updateAccount") };

  // Welcome-bonus goal fields are shared across every currency line of a card
  // (card_group_id) — fan out so setting/changing/clearing the goal from any
  // line propagates to its siblings, rather than relying on read-time
  // resolution across rows that could otherwise silently diverge.
  if (columns.card_group_id) {
    const { error: fanOutError } = await supabase
      .from("accounts")
      .update({
        welcome_bonus_goal_amount: columns.welcome_bonus_goal_amount,
        welcome_bonus_goal_currency: columns.welcome_bonus_goal_currency,
        welcome_bonus_due_date: columns.welcome_bonus_due_date,
      })
      .eq("card_group_id", columns.card_group_id)
      .neq("id", id);
    if (fanOutError) return { error: await dbError(fanOutError, "updateAccount") };
  }

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
  revalidatePath("/");
  return { id };
}

export async function archiveAccount(id: string, archived: boolean): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("id", id);
  if (error) return { error: await dbError(error, "archiveAccount") };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { id };
}

export async function deleteAccount(id: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteAccount") };
  revalidatePath("/accounts");
  revalidatePath("/");
  return {};
}

export async function createBank(name: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Bank name is required." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };
  // Reuse an existing bank with the same name (case-insensitive) if present.
  const { data: existing } = await supabase
    .from("banks")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) {
    revalidatePath("/accounts");
    return { id: existing.id };
  }
  const { data, error } = await supabase
    .from("banks")
    .insert({ name: trimmed, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createBank") };
  revalidatePath("/accounts");
  return { id: data.id };
}

export async function createCardGroup(name: string, last4?: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Group name is required." };

  // The column carries a check constraint (`^[0-9]{4}$`), but that is the
  // backstop, not the validation the person sees: a constraint violation
  // surfaces as an opaque database error. Empty means "not supplied" and is
  // stored as null, since the card group is perfectly usable without it.
  const digits = last4?.trim() ?? "";
  if (digits && !/^[0-9]{4}$/.test(digits)) {
    return { error: "Last 4 digits must be exactly four numbers." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };
  const { data, error } = await supabase
    .from("card_groups")
    .insert({ name: trimmed, user_id: user.id, last4: digits || null })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createCardGroup") };
  revalidatePath("/accounts");
  return { id: data.id };
}

