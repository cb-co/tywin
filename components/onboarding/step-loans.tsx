"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";
import { createAccount } from "@/app/(app)/accounts/actions";
import { ACCOUNT_TYPE_META } from "@/lib/accounts/meta";
import {
  estimateRemainingInstallments,
  loanAccountFromOnboarding,
  remainingInstallmentsOf,
  type OnboardingLoan,
} from "@/lib/onboarding/loan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyDisplay } from "@/components/ui/money-display";
import { CurrencySelect, SavedRow, StepFooter, StepHeading, localToday } from "./parts";
import type { StepProps } from "./types";

const blank = (currency: string): OnboardingLoan => ({
  name: "",
  currency,
  owedToday: "",
  installment: "",
  remainingInstallments: "",
  dueDay: "",
  annualRatePercent: "",
});

/**
 * Loans as real accounts, from questions a borrower can answer without their
 * contract: what they owe today, the installment, the rate and the day it is
 * due. Installments left are derived from the rate — people know their rate
 * far more often than their count — and can be typed instead, under "more
 * details", when the rate is unknown or the estimate is off. See
 * lib/onboarding/loan.ts for why "as of today" is exact.
 * The full loan form, with origination details, stays on Accounts.
 */
export function StepLoans({ data, currencies, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const loans = data.accounts.filter((a) => a.type === "loan");
  const [adding, setAdding] = useState(loans.length === 0);
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<OnboardingLoan>(() => blank(baseCurrency));
  const meta = ACCOUNT_TYPE_META.loan;

  const set = (k: keyof OnboardingLoan) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const estimate =
    form.annualRatePercent.trim() === ""
      ? null
      : estimateRemainingInstallments(
          Number(form.owedToday),
          Number(form.installment),
          Number(form.annualRatePercent),
        );
  const overridden = form.remainingInstallments.trim() !== "";
  const valid =
    !!form.name.trim() &&
    Number(form.owedToday) > 0 &&
    Number(form.installment) > 0 &&
    (remainingInstallmentsOf(form) ?? 0) >= 1;

  function add() {
    if (!valid || pending) return;
    startTransition(async () => {
      const r = await createAccount(loanAccountFromOnboarding(form, localToday()));
      if (r.error) return void toast.error(r.error);
      setForm(blank(baseCurrency));
      setMore(false);
      setAdding(false);
      router.refresh();
    });
  }

  const field = (
    id: keyof OnboardingLoan,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`wf-loan-${id}`}>{label}</Label>
      <Input
        id={`wf-loan-${id}`}
        type="number"
        min="0"
        inputMode="decimal"
        value={form[id]}
        onChange={(e) => set(id)(e.target.value)}
        {...props}
      />
    </div>
  );

  return (
    <>
      <div className="space-y-5">
        <StepHeading title={t("loansTitle")} body={t("loansBody")} />

        {loans.length ? (
          <ul className="space-y-2">
            {loans.map((l) => (
              <SavedRow
                key={l.id}
                icon={meta.icon}
                color={meta.color}
                title={l.name}
                subtitle={l.remaining ? t("loanSummary", { count: l.remaining }) : undefined}
                trailing={
                  l.installment ? (
                    <MoneyDisplay amount={l.installment} currency={l.currency} size="inline" />
                  ) : null
                }
              />
            ))}
          </ul>
        ) : null}

        {adding ? (
          <form
            className="space-y-4 rounded-xl border bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div className="space-y-2">
                <Label htmlFor="wf-loan-name">{t("loanNameLabel")}</Label>
                <Input
                  id="wf-loan-name"
                  autoFocus
                  maxLength={80}
                  value={form.name}
                  placeholder={t("loanNamePlaceholder")}
                  onChange={(e) => set("name")(e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="wf-loan-currency">{t("loanCurrencyLabel")}</Label>
                <CurrencySelect
                  id="wf-loan-currency"
                  value={form.currency}
                  onChange={set("currency")}
                  currencies={currencies}
                  compact
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("owedToday", t("loanOwedLabel"), { step: "0.01" })}
              {field("installment", t("loanInstallmentLabel"), { step: "0.01" })}
              {field("annualRatePercent", t("loanRateLabel"), { step: "0.01", max: "100" })}
              {field("dueDay", t("loanDueDayLabel"), { step: "1", min: "1", max: "31", inputMode: "numeric" })}
            </div>

            {/* What the rate implies, as the person types. Hidden once they
                type a count themselves: that count is what gets saved. */}
            {overridden ? null : estimate === "never" ? (
              <p className="text-xs text-destructive">{t("loanNeverPaysOff")}</p>
            ) : typeof estimate === "number" ? (
              <p className="text-xs text-muted-foreground">
                {t("loanRemainingEstimate", { count: estimate })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("loanRateHint")}</p>
            )}

            {more ? (
              <div className="space-y-2">
                {field("remainingInstallments", t("loanRemainingLabel"), {
                  step: "1",
                  min: "1",
                  inputMode: "numeric",
                  placeholder: typeof estimate === "number" ? String(estimate) : undefined,
                })}
                <p className="text-xs text-muted-foreground">{t("loanRemainingHint")}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMore(true)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="size-3.5" />
                {t("loanMoreDetails")}
              </button>
            )}

            <Button type="submit" disabled={!valid} isLoading={pending}>
              {t("loanAdd")}
            </Button>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {t("loanAddAnother")}
          </Button>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        primary={loans.length ? { label: t("continueButton"), onClick: onNext } : undefined}
        skip={loans.length ? undefined : { label: t("skipButton"), onClick: onNext }}
      />
    </>
  );
}
