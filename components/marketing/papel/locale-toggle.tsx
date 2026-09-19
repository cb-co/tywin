"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/locale";
import s from "./papel.module.css";

/** ES | EN, set as two denominations on the note rather than a dropdown:
 *  there are only two languages, so both can simply be on the page. */
export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("Marketing");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={t("languageLabel")} className={s.localeToggle} aria-busy={pending}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={code === locale}
          aria-label={LOCALE_LABEL[code]}
          onClick={() => choose(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
