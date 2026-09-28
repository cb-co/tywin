"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/locale";

/** Switches the UI language and re-renders the server tree in it. */
function useLocaleChoice() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return { locale, choose, pending };
}

export function LanguageSwitcher() {
  const t = useTranslations("Nav");
  const { choose, pending } = useLocaleChoice();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("language")}
            isLoading={pending}
          />
        }
      >
        {pending ? null : <Languages className="h-5 w-5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((code) => (
          <DropdownMenuItem key={code} onClick={() => choose(code)}>
            {LOCALE_LABEL[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same switch as a labelled two-way choice, for Settings, where a bare
 *  icon doesn't say which language is on. */
export function LanguageChoice() {
  const t = useTranslations("Nav");
  const { locale, choose, pending } = useLocaleChoice();

  return (
    <Tabs value={locale} onValueChange={(v) => choose(v as Locale)}>
      <TabsList aria-label={t("language")}>
        {LOCALES.map((code) => (
          <TabsTrigger key={code} value={code} disabled={pending}>
            {LOCALE_LABEL[code]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
