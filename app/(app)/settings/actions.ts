"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";

export async function updateBaseCurrency(code: string): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Settings");
  if (!/^[A-Z]{3}$/.test(code)) return { error: ts("invalidCurrency") };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("profiles")
    .update({ base_currency: code })
    .eq("id", user.id);
  if (error) return { error: await dbError(error, "updateBaseCurrency") };
  revalidatePath("/", "layout");
  return {};
}

/** Max characters for a display name. Long enough for a full name, short
 *  enough that the sidebar row and the overview greeting never wrap. */
const DISPLAY_NAME_MAX = 40;

export async function deleteAccount(): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Cascades through every user-owned table — see the migration for detail.
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: await dbError(error, "deleteAccount") };

  await supabase.auth.signOut();
  return {};
}

export async function updateDisplayName(name: string): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const ts = await getTranslations("Settings");

  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return { error: ts("displayNameTooLong", { max: DISPLAY_NAME_MAX }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Clearing the field falls back to the email-derived label everywhere.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed || null })
    .eq("id", user.id);
  if (error) return { error: await dbError(error, "updateDisplayName") };
  revalidatePath("/", "layout");
  return {};
}
