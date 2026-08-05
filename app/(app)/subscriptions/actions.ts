"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionInput, type SubscriptionInput } from "@/lib/subscriptions/schema";
import { baseRate, getExchangeRates } from "@/lib/fx";
import { settledCharge } from "@/lib/subscriptions/charge";
import { hasBrandColor } from "@/lib/subscriptions/brand-color";
import { inferBrand } from "@/lib/subscriptions/llm/brand";
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

  /* The stored name decides two things: whether the brand on this row is still
     the right brand, and whether inference has anything new to work from. Read
     before the write, because after it the old name is gone. A read that FAILS
     is treated as "not renamed" — leaving a brand in place is a smaller error
     than clearing one over a question we could not answer. */
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const renamed = !!existing && existing.name !== parsed.data.name;

  /* `color` and `logo_url` are not form fields, and resolveSubscriptionBrand is
     normally the only thing that writes them. A RENAME is the exception, and it
     has to be: both were inferred from the old name, so "Netflix" edited to
     "Spotify" would otherwise keep Netflix's red and Netflix's mark. Clearing
     them here both removes the wrong answer immediately and re-opens the gate
     below, which is what makes the new name resolve. */
  const { error } = await supabase
    .from("subscriptions")
    .update({
      ...toRow(parsed.data),
      currency: parsed.data.currency,
      ...(renamed ? { color: null, logo_url: null } : {}),
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateSubscription") };
  revalidate();
  return { id };
}

/**
 * Resolve and store this subscription's brand colour and logo.
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
 * The gate is the stored COLOUR, matching the one cards use (see
 * accounts/actions resolveArtFor). A subscription that has a usable colour skips
 * the model entirely and saves like any other row; one that has none asks.
 *
 *   - a resolved subscription costs nothing on save, so editing an amount does
 *     not each burn an inference call;
 *   - a subscription created BEFORE any of this has no colour, so it resolves
 *     the first time it is saved — no backfill flag, no migration;
 *   - a RENAME clears the colour (see updateSubscription), so the new name gets
 *     its own call rather than keeping the old service's red;
 *   - a value present but UNUSABLE — not a 6-digit hex — counts as empty and
 *     re-resolves, since nothing renders it.
 *
 * The cost this accepts, deliberately: a name the model cannot place stores no
 * colour, so it asks again on every later edit of that row. A hidden "we already
 * tried" marker would stop that, and it was tried — it also meant a column whose
 * value no screen could explain, and a subscription that could never pick up a
 * better answer from a later prompt. One visible field, one rule.
 *
 * The name is read from the ROW rather than taken as an argument: this is a
 * server action reachable with any id, so it should decide what to judge from
 * data RLS has already scoped to the caller. The name is also what people type
 * the service into — `brand` is an optional legal-entity field ("Netflix, Inc.")
 * that is usually empty and never more identifying than the name beside it.
 *
 * Every failure is silent and returns `resolved: false`. Nothing here is worth
 * surfacing: the save the person actually asked for has already succeeded, and
 * an unresolved brand is a cosmetic gap the next save tries again on.
 */
export async function resolveSubscriptionBrand(id: string): Promise<{ resolved: boolean }> {
  const { supabase, user } = await requireUser();
  if (!user) return { resolved: false };

  const { data: existing, error: readError } = await supabase
    .from("subscriptions")
    .select("name, color, logo_url")
    .eq("id", id)
    .maybeSingle();

  // A failed read is not the same as an empty row. Guessing over it would
  // overwrite good values we simply could not see.
  if (readError || !existing) return { resolved: false };
  if (hasBrandColor(existing.color)) return { resolved: false };

  const { color, logoUri } = await inferBrand(existing.name);
  if (!color && !logoUri) return { resolved: false };

  /* Only what came back is written. The two resolve independently — a service
     with a mark but no usable colour is normal — and a null means "no answer",
     never "clear what is there". */
  const patch: { color?: string; logo_url?: string } = {};
  if (color) patch.color = color;
  if (logoUri) patch.logo_url = logoUri;

  const { error } = await supabase.from("subscriptions").update(patch).eq("id", id);
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
