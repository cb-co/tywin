"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionInput, type SubscriptionInput } from "@/lib/subscriptions/schema";
import { baseRate, getExchangeRates } from "@/lib/fx";
import { settledCharge } from "@/lib/subscriptions/charge";
import { hasBrandColor } from "@/lib/subscriptions/brand-color";
import { inferBrandColor } from "@/lib/subscriptions/llm/brand-color";
import { dbError } from "@/lib/errors";

type Result = { error?: string; id?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/subscriptions");
  revalidatePath("/");
}

function toRow(v: SubscriptionInput) {
  return {
    name: v.name,
    brand: v.brand || null,
    amount: v.amount,
    billing_cycle: v.billing_cycle,
    anchor_day: v.anchor_day ?? null,
    account_id: v.account_id || null,
    category_id: v.category_id || null,
    is_active: v.is_active,
  };
}

export async function createSubscription(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({ ...toRow(parsed.data), currency: parsed.data.currency, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createSubscription") };
  revalidate();
  return { id: data.id };
}

export async function updateSubscription(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  // `color` is deliberately absent from the payload: it is not a form field, and
  // resolveSubscriptionColor is the only thing that writes it.
  const { error } = await supabase
    .from("subscriptions")
    .update({ ...toRow(parsed.data), currency: parsed.data.currency })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateSubscription") };
  revalidate();
  return { id };
}

/**
 * Resolve and store this subscription's brand colour.
 *
 * Called by the form dialog AFTER a save has already returned, never during one.
 * That separation is the whole point. Inference used to run inside
 * create/updateSubscription, and it could not work there: the call answers in
 * ~600ms once the process is warm but takes 9-70 SECONDS when it is cold, so a
 * budget short enough to keep the dialog responsive threw away the answer on
 * every cold call — saves completed with the colour silently unwritten — and a
 * budget long enough to catch it hung the dialog for over a minute. Off the save
 * path there is no such trade: the save returns immediately and the colour can
 * take as long as it needs, arriving on the refresh that follows.
 *
 * The gate is "no usable colour stored yet", which does all the work asked of it:
 *
 *   - a subscription that already has a colour costs nothing, so editing an
 *     amount does not each burn an inference call;
 *   - a subscription created BEFORE this feature has none, so it resolves the
 *     first time it is saved, with no backfill flag to carry around;
 *   - a value that is present but UNUSABLE — not a 6-digit hex — counts as
 *     empty and re-resolves, since nothing renders such a value and treating it
 *     as occupied would strand the row forever;
 *   - a name the model cannot place stays unresolved and renders the theme's
 *     neutral accent, rather than being written a wrong colour.
 *
 * The name is read from the ROW rather than taken as an argument: this is a
 * server action reachable with any id, so it should decide what to judge from
 * data RLS has already scoped to the caller. The name is also what people type
 * the service into — `brand` is an optional legal-entity field ("Netflix, Inc.")
 * that is usually empty and never more identifying than the name beside it.
 *
 * Every failure is silent and returns `resolved: false`. Nothing here is worth
 * surfacing: the save the person actually asked for has already succeeded, and
 * an unresolved colour is a cosmetic gap the next save tries again on.
 */
export async function resolveSubscriptionColor(id: string): Promise<{ resolved: boolean }> {
  const { supabase, user } = await requireUser();
  if (!user) return { resolved: false };

  const { data: existing, error: readError } = await supabase
    .from("subscriptions")
    .select("name, color")
    .eq("id", id)
    .maybeSingle();

  // A failed read is not the same as an empty colour. Guessing over it would
  // overwrite a good value we simply could not see.
  if (readError || !existing) return { resolved: false };
  if (hasBrandColor(existing.color)) return { resolved: false };

  const color = await inferBrandColor(existing.name);
  if (!color) return { resolved: false };

  const { error } = await supabase.from("subscriptions").update({ color }).eq("id", id);
  if (error) return { resolved: false };

  revalidate();
  return { resolved: true };
}

export async function deleteSubscription(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteSubscription") };
  revalidate();
  return {};
}

export async function setSubscriptionActive(id: string, active: boolean): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("subscriptions").update({ is_active: active }).eq("id", id);
  if (error) return { error: await dbError(error, "setSubscriptionActive") };
  revalidate();
  return { id };
}

/** Log this subscription's charge as an expense transaction linked back to it. */
/**
 * Record this month's charge against the subscription's account.
 *
 * `settledAmount` is what actually left the account, in the ACCOUNT's currency,
 * and is required exactly when the merchant bills in a different one — see
 * lib/subscriptions/charge. The client offers an estimate; this does not invent
 * one, because writing the billed amount into a differently-denominated account
 * is the bug being fixed (a USD 15.99 sub took 15.99 pesos off a DOP card).
 */
export async function addCharge(id: string, settledAmount?: number): Promise<Result> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Subscriptions");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, account:accounts!subscriptions_account_id_fkey(currency,type)")
    .eq("id", id)
    .maybeSingle();
  if (!sub) return { error: ts("notFound") };
  // The account supplies the currency, so a subscription without one has
  // nowhere to charge and no denomination to charge in.
  const accountCurrency = sub.account?.currency;
  if (!sub.account_id || !accountCurrency) return { error: ts("needsAccount") };

  const settled = settledCharge({
    subAmount: sub.amount,
    subCurrency: sub.currency,
    accountCurrency,
    settledAmount,
  });
  if ("needsSettledAmount" in settled)
    return { error: ts("needsSettledAmount", { currency: accountCurrency }) };

  /* The charge is denominated in the account's currency, so the base rate comes
     from that — not from the subscription's. Converting the 965 pesos actually
     paid at market gives a base figure that includes the bank's spread, where
     the old code recorded 15.99 as though it were pesos and then converted
     that. (The rate was also hardcoded to 1 before, counting a 1,500 DOP
     subscription as 1,500 USD in every base-currency total.) */
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();
  const baseCurrency = profile?.base_currency ?? "USD";
  const rates = accountCurrency === baseCurrency ? {} : await getExchangeRates(baseCurrency);

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: "expense",
    account_id: sub.account_id,
    category_id: sub.category_id,
    amount: settled.amount,
    currency: accountCurrency,
    exchange_rate: baseRate(accountCurrency, baseCurrency, rates),
    include_tax: false,
    include_commission: false,
    occurred_at: new Date().toISOString(),
    description: sub.name,
    subscription_id: sub.id,
    exclude_from_budget: sub.account?.type === "credit_card",
  });
  if (error) return { error: await dbError(error, "addCharge") };
  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
  return { id };
}
