"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from "./locale";

export async function setLocale(locale: Locale): Promise<void> {
  /* Server actions are callable by anything that can reach the endpoint, and
     the `Locale` type is erased at runtime, so the argument is untrusted.
     `i18n/request.ts` already re-validates on read before the messages import,
     but writing an arbitrary attacker-chosen string into a user's cookie is
     not something to allow just because the read side catches it. */
  const safe = isLocale(locale) ? locale : DEFAULT_LOCALE;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, safe, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
}
