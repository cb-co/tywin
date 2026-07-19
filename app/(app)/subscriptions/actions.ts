"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { subscriptionInput, type SubscriptionInput } from "@/lib/subscriptions/schema";

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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
  revalidate();
  return { id };
}

export async function deleteSubscription(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}

export async function setSubscriptionActive(id: string, active: boolean): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  const { error } = await supabase.from("subscriptions").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { id };
}

/** Log this subscription's charge as an expense transaction linked back to it. */
export async function addCharge(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Subscriptions");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sub) return { error: ts("notFound") };
  if (!sub.account_id) return { error: ts("needsAccount") };

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: "expense",
    account_id: sub.account_id,
    category_id: sub.category_id,
    amount: sub.amount,
    currency: sub.currency,
    exchange_rate: 1,
    include_tax: false,
    include_commission: false,
    budget_only: false,
    occurred_at: new Date().toISOString(),
    description: sub.name,
    subscription_id: sub.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
  return { id };
}
