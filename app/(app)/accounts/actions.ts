"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accountInput, type AccountInput } from "@/lib/accounts/schema";
import { hasCardAccent } from "@/lib/accounts/card-art";
import { inferCardArt } from "@/lib/accounts/llm/card-art";
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
    last4: nullIf(!card, orNull(v.last4)),
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

/**
 * Card art for an account being written, or nothing.
 *
 * Only credit cards get art — a chequing account has no physical face to match.
 * Beyond that the gate is the ACCENT, and nothing else: a card that has one
 * skips the model and saves like any other account, a card that has none asks.
 *
 * The colour is a form field, which is what makes one condition enough. It
 * round-trips through every edit, so "already has an accent" covers the routine
 * edit, and CLEARING it is a deliberate gesture that re-opens the gate — the
 * re-roll for a card wearing a colour nobody likes, with no rename needed.
 *
 * The cost this accepts: a card the model cannot place has no accent, so it asks
 * again on each edit. That is the price of keeping the rule to one field a
 * person can see and control, rather than a hidden "we already tried" marker
 * that nothing in the UI could explain.
 *
 * Inference failure is silent and returns nothing at all: this runs inside a
 * save the person asked for, and a card whose colour could not be guessed is
 * not a reason to fail writing their account.
 */
async function resolveArtFor(
  v: AccountInput,
): Promise<{ color?: string; brand?: string } | undefined> {
  if (v.type !== "credit_card") return undefined;
  if (hasCardAccent(v.color)) return undefined;

  const art = await inferCardArt(v.name);
  if (!art) return undefined;

  return { color: art.accent, ...(art.network ? { brand: art.network } : {}) };
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

  const row = {
    ...toColumns(parsed.data),
    ...(await resolveArtFor(parsed.data)),
    currency: parsed.data.currency,
    user_id: user.id,
  };
  const res = await supabase.from("accounts").insert(row).select("id").single();

  if (res.error) return { error: await dbError(res.error, "createAccount") };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { id: res.data.id };
}

export async function updateAccount(id: string, input: AccountInput): Promise<Result> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  // currency is immutable — never included in the update payload.
  const columns = { ...toColumns(parsed.data), ...(await resolveArtFor(parsed.data)) };
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

/**
 * Fills in art for cards that predate the feature.
 *
 * Everything else resolves art on save, which covers new cards and any card the
 * person edits. Cards created before card art existed would otherwise sit on
 * the default colour forever, because nothing ever writes them again. This
 * closes that gap without a one-off script: the accounts page calls it once
 * when it notices unresolved cards, and after it succeeds there is nothing left
 * to find, so it stops firing on its own.
 *
 * Standalone cards only — a card that belongs to a group is drawn by the
 * group's face, and the group is handled in the same pass below.
 *
 * Failures are swallowed per row. One card whose name the model cannot place
 * must not stop the rest from resolving, and none of this is worth an error in
 * front of someone who only opened a page.
 */
export async function backfillCardArt(): Promise<{ filled: number }> {
  const { supabase, user } = await requireUser();
  if (!user) return { filled: 0 };

  const [{ data: accounts }, { data: groups }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, color, card_group_id")
      .eq("type", "credit_card")
      .is("card_group_id", null)
      .is("color", null),
    supabase.from("card_groups").select("id, name, art_color").is("art_color", null),
  ]);

  let filled = 0;

  for (const account of accounts ?? []) {
    const art = await inferCardArt(account.name);
    if (!art) continue;
    const { error } = await supabase
      .from("accounts")
      .update({ color: art.accent, ...(art.network ? { brand: art.network } : {}) })
      .eq("id", account.id);
    if (!error) filled++;
  }

  for (const group of groups ?? []) {
    const art = await inferCardArt(group.name);
    if (!art) continue;
    const { error } = await supabase
      .from("card_groups")
      .update({
        art_color: art.accent,
        ...(art.network ? { brand: art.network } : {}),
      })
      .eq("id", group.id);
    if (!error) filled++;
  }

  if (filled > 0) {
    revalidatePath("/accounts");
    revalidatePath("/");
  }
  return { filled };
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

export async function createCardGroup(name: string): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Group name is required." };
  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  // A group IS the physical card, so its face is the one that needs art. Same
  // gate as an account: a new group has no accent, so this always runs once
  // here and never again unless the accent is cleared.
  const art = await inferCardArt(trimmed);

  const { data, error } = await supabase
    .from("card_groups")
    .insert({
      name: trimmed,
      user_id: user.id,
      ...(art ? { art_color: art.accent } : {}),
      ...(art?.network ? { brand: art.network } : {}),
    })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createCardGroup") };
  revalidatePath("/accounts");
  return { id: data.id };
}

