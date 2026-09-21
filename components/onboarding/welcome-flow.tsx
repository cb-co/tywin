"use client";

import { useState } from "react";
import type { CurrencyRow } from "@/lib/accounts/queries";
import type { Locale } from "@/lib/i18n/locale";
import { STEPS, type Step } from "@/lib/onboarding/resume";
import { Perforation } from "@/components/papel/perforation";
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
      {/* Progress: a perforated strip that punches out as steps pass, with
          the count printed as a serial. */}
      <Perforation
        decorative
        total={COUNTED}
        paid={Math.min(step + 1, COUNTED)}
        label={stepLabels[step]}
        className="text-foreground [&>i]:h-2 [&>i]:flex-1"
      />
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {current === "done" ? (
          stepLabels[step]
        ) : (
          <>
            <span className="figure legend tracking-widest text-foreground">
              {step + 1} / {COUNTED}
            </span>
            {` · ${stepLabels[step]}`}
          </>
        )}
      </p>

      {/* Keyed so each step animates in and starts from fresh local state. */}
      <div key={step} className="rise mt-6 border border-(--paper-line) bg-card p-5 sm:p-6">
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
