"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CurrencyRow } from "@/lib/accounts/queries";
import type { Locale } from "@/lib/i18n/locale";
import { STEPS, type Step } from "@/lib/onboarding/resume";
import { cn } from "@/lib/utils";
import { StepAbout } from "./step-about";
import { StepAccount } from "./step-account";
import { StepCards } from "./step-cards";
import { StepIncome } from "./step-income";
import { StepLoans } from "./step-loans";
import { StepBills } from "./step-bills";
import { StepDone } from "./step-done";
import type { StepProps, WelcomeData } from "./types";

export type { WelcomeData };

/** Counted steps; the closing summary is not one of them. */
const COUNTED = STEPS.length - 1;

/**
 * Onboarding that leaves the app configured: who you are, where your money is,
 * your cards and their statements, when you are paid, your loans and your fixed
 * bills. Every step writes through the same server actions the app uses and
 * refreshes the page's data, so a refresh or Back shows what already exists
 * instead of creating it again. Only the first two steps are required.
 */
export function WelcomeFlow({
  currencies,
  initialName,
  initialCurrency,
  initialStep,
  locale,
  email,
  data,
  stepLabels,
}: {
  currencies: CurrencyRow[];
  initialName: string;
  initialCurrency: string;
  initialStep: number;
  locale: Locale;
  email: string;
  data: WelcomeData;
  stepLabels: string[];
}) {
  const t = useTranslations("Welcome");
  const [step, setStep] = useState(initialStep);
  // Tracked here as well as saved, so later steps default to a currency the
  // user just picked without waiting on the refresh.
  const [baseCurrency, setBaseCurrency] = useState(initialCurrency);

  const current = STEPS[step];
  const goTo = (s: Step) => setStep(STEPS.indexOf(s));
  const props: StepProps = {
    data,
    currencies,
    baseCurrency,
    onNext: () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
    onBack: step > 0 ? () => setStep((s) => s - 1) : undefined,
  };

  return (
    <div className="w-full max-w-md">
      {/* Progress. Segments fill as steps complete, so the end is always in
          sight. */}
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: COUNTED }, (_, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                "block h-full rounded-full bg-primary transition-transform duration-500 ease-out",
                i <= step ? "scale-x-100" : "scale-x-0",
              )}
              style={{ transformOrigin: "left center" }}
            />
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {current === "done"
          ? stepLabels[step]
          : `${t("stepCounter", { current: step + 1, total: COUNTED })} · ${stepLabels[step]}`}
      </p>

      {/* Keyed so each step animates in and starts from fresh local state. */}
      <div key={step} className="rise mt-6">
        {current === "about" ? (
          <StepAbout
            {...props}
            initialName={initialName || (email.split("@")[0] ?? "")}
            locale={locale}
            onCurrencyChange={setBaseCurrency}
          />
        ) : current === "account" ? (
          <StepAccount {...props} />
        ) : current === "cards" ? (
          <StepCards {...props} />
        ) : current === "income" ? (
          <StepIncome {...props} />
        ) : current === "loans" ? (
          <StepLoans {...props} />
        ) : current === "bills" ? (
          <StepBills {...props} />
        ) : (
          <StepDone {...props} goTo={goTo} />
        )}
      </div>
    </div>
  );
}
