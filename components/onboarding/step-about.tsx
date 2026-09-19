"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateBaseCurrency, updateDisplayName } from "@/app/(app)/settings/actions";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CurrencySelect, StepFooter, StepHeading } from "./parts";
import type { StepProps } from "./types";

/** Name, language and base currency on one screen: three quick answers that
 *  used to be two steps, with the language one that was never asked. */
export function StepAbout({
  currencies,
  baseCurrency,
  onNext,
  initialName,
  locale,
  onCurrencyChange,
}: StepProps & { initialName: string; locale: Locale; onCurrencyChange: (code: string) => void }) {
  const t = useTranslations("Welcome");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [switching, startSwitch] = useTransition();
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState(baseCurrency);

  /* Applied the moment it is tapped, so the rest of the flow is read in the
     language chosen rather than the one the browser guessed. refresh() keeps
     this component's state; only the messages change underneath it. */
  function chooseLanguage(next: Locale) {
    if (next === locale) return;
    startSwitch(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  function submit() {
    if (!name.trim() || pending) return;
    startTransition(async () => {
      const r = await updateDisplayName(name);
      if (r.error) return void toast.error(r.error);
      if (currency !== baseCurrency) {
        const c = await updateBaseCurrency(currency);
        if (c.error) return void toast.error(c.error);
        onCurrencyChange(currency);
      }
      onNext();
    });
  }

  return (
    <>
      <div className="space-y-5">
        <StepHeading title={t("aboutTitle")} body={t("aboutBody")} />

        <div className="space-y-2">
          <Label htmlFor="wf-name">{t("nameLabel")}</Label>
          <Input
            id="wf-name"
            autoFocus
            value={name}
            maxLength={40}
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <div className="space-y-2">
          <Label id="wf-language-label">{t("languageLabel")}</Label>
          <div
            role="radiogroup"
            aria-labelledby="wf-language-label"
            aria-busy={switching || undefined}
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          >
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={l === locale}
                onClick={() => chooseLanguage(l)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  l === locale
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wf-currency">{t("currencyLabel")}</Label>
          <CurrencySelect id="wf-currency" value={currency} onChange={setCurrency} currencies={currencies} />
          <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
        </div>
      </div>

      <StepFooter
        primary={{
          label: t("continueButton"),
          onClick: submit,
          disabled: !name.trim() || currency.length !== 3 || switching,
          pending,
        }}
      />
    </>
  );
}
