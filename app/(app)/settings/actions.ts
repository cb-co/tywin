"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

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
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
