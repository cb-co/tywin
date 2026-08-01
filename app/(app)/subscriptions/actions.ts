"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionInput, type SubscriptionInput } from "@/lib/subscriptions/schema";
import { baseRate, getExchangeRates } from "@/lib/fx";
import { settledCharge } from "@/lib/subscriptions/charge";
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
  const { error } = await supabase
    .from("subscriptions")
    .update({ ...toRow(parsed.data), currency: parsed.data.currency })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateSubscription") };
  revalidate();
  return { id };
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
