"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { createSubscription } from "@/app/(app)/recurring/actions";
import { setPayCycle } from "@/app/(app)/settings/actions";
import { SWATCHES } from "@/lib/palette";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyDisplay } from "@/components/ui/money-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEMIMONTHLY_MAX_ANCHOR, semimonthlyStarts } from "@/lib/period/cycle";
import { cn } from "@/lib/utils";
import { AccountSelect, SavedRow, StepFooter, StepHeading } from "./parts";
import { isMainAccount, type StepProps } from "./types";

const CHOICES = ["semimonthly", "monthly", "weekly", "irregular"] as const;
type Choice = (typeof CHOICES)[number];

const CHOICE_KEYS = {
  semimonthly: ["incomeSemimonthly", "incomeSemimonthlyHint"],
  monthly: ["incomeMonthly", "incomeMonthlyHint"],
  weekly: ["incomeWeekly", "incomeWeeklyHint"],
  irregular: ["incomeIrregular", "incomeIrregularHint"],
} as const;

/* Monday first, valued in the subscriptions table's Sunday=1..Saturday=7
   scheme — the one nextChargeDate reads. The pay-cycle sync converts it to
   ISO for profiles.pay_cycle. */
const WEEKDAYS = [
  { value: 2, key: "weekdayMonday" },
  { value: 3, key: "weekdayTuesday" },
  { value: 4, key: "weekdayWednesday" },
  { value: 5, key: "weekdayThursday" },
  { value: 6, key: "weekdayFriday" },
  { value: 7, key: "weekdaySaturday" },
  { value: 1, key: "weekdaySunday" },
] as const;

/**
 * "¿Cuándo te pagan?" — answered with a recurring income template, which is
 * both the income baseline and, through createSubscription's pay-cycle sync,
 * the budget period. Irregular earners get calendar-month budgets and no
 * template, since there is no fixed amount or date to record.
 */
export function StepIncome({ data, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const tSettings = useTranslations("Settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const accounts = data.accounts.filter(isMainAccount);
  const [choice, setChoice] = useState<Choice>("semimonthly");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [day, setDay] = useState("30");
  const [weekday, setWeekday] = useState(6);
  // The 15th and the 30th: how most quincenas are paid here.
  const [firstPayday, setFirstPayday] = useState(String(SEMIMONTHLY_MAX_ANCHOR));
  const firstPaydayValid =
    Number.isInteger(Number(firstPayday)) &&
    Number(firstPayday) >= 1 &&
    Number(firstPayday) <= SEMIMONTHLY_MAX_ANCHOR;

  const cycleLabel = (cycle: string) =>
    cycle === "semimonthly"
      ? t("incomeSemimonthly")
      : cycle === "monthly"
        ? t("incomeMonthly")
        : cycle === "weekly"
          ? t("incomeWeekly")
          : undefined;

  const account = accounts.find((a) => a.id === accountId);
  const existing = data.income;

  const valid =
    choice === "irregular" ||
    (Number(amount) > 0 &&
      !!account &&
      (choice !== "monthly" || (Number(day) >= 1 && Number(day) <= 31)) &&
      (choice !== "semimonthly" || firstPaydayValid));

  function submit() {
    if (existing) return onNext();
    if (!valid || pending) return;
    startTransition(async () => {
      const r =
        choice === "irregular"
          ? await setPayCycle({ cycle: "monthly", anchorDay: 1 })
          : await createSubscription({
              kind: "income",
              name: t("incomeDefaultName"),
              amount: Number(amount),
              currency: account!.currency,
              billing_cycle: choice,
              anchor_day:
                choice === "monthly"
                  ? Number(day)
                  : choice === "weekly"
                    ? weekday
                    : Number(firstPayday),
              account_id: account!.id,
              is_active: true,
            });
      if (r.error) return void toast.error(r.error);
      router.refresh();
      onNext();
    });
  }

  if (existing) {
    return (
      <>
        <div className="space-y-5">
          <StepHeading title={t("incomeTitle")} body={t("incomeBody")} />
          <ul>
            <SavedRow
              icon={Banknote}
              color={SWATCHES[0]}
              title={existing.name}
              subtitle={cycleLabel(existing.billing_cycle)}
              trailing={<MoneyDisplay amount={existing.amount} currency={existing.currency} size="inline" />}
            />
          </ul>
        </div>
        <StepFooter onBack={onBack} primary={{ label: t("continueButton"), onClick: onNext }} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <StepHeading title={t("incomeTitle")} body={t("incomeBody")} />

        <div role="radiogroup" aria-label={t("incomeTitle")} className="grid grid-cols-2 gap-2">
          {CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={choice === c}
              onClick={() => setChoice(c)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                choice === c
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-card hover:border-foreground/30",
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{t(CHOICE_KEYS[c][0])}</span>
              <span className="block text-xs text-muted-foreground">{t(CHOICE_KEYS[c][1])}</span>
            </button>
          ))}
        </div>

        {choice === "irregular" ? (
          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            {t("incomeIrregularNote")}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="wf-income-amount">{t("incomeAmountLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="wf-income-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={amount}
                  placeholder="0.00"
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                {/* The deposit account decides the currency; shown, not picked. */}
                <span className="text-sm font-medium text-muted-foreground">{account?.currency}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("incomeAmountHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="wf-income-account">{t("incomeAccountLabel")}</Label>
                <AccountSelect
                  id="wf-income-account"
                  value={accountId}
                  onChange={setAccountId}
                  accounts={accounts}
                />
              </div>
              {choice === "monthly" ? (
                <div className="space-y-2">
                  <Label htmlFor="wf-income-day">{t("incomeDayLabel")}</Label>
                  <Input
                    id="wf-income-day"
                    type="number"
                    min="1"
                    max="31"
                    inputMode="numeric"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                  />
                </div>
              ) : choice === "semimonthly" ? (
                <div className="space-y-2">
                  <Label htmlFor="wf-income-paydays">{t("incomePaydaysLabel")}</Label>
                  <Input
                    id="wf-income-paydays"
                    type="number"
                    min="1"
                    max={SEMIMONTHLY_MAX_ANCHOR}
                    inputMode="numeric"
                    value={firstPayday}
                    aria-describedby="wf-income-paydays-hint"
                    onChange={(e) => setFirstPayday(e.target.value)}
                  />
                  <p id="wf-income-paydays-hint" className="text-xs text-muted-foreground">
                    {firstPaydayValid
                      ? t("incomeSecondPayday", { second: semimonthlyStarts(Number(firstPayday))[1] })
                      : tSettings("payCycleSemimonthlyRange")}
                  </p>
                </div>
              ) : choice === "weekly" ? (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="wf-income-weekday">{t("incomeWeekdayLabel")}</Label>
                  <Select
                    value={String(weekday)}
                    onValueChange={(v) => v && setWeekday(Number(v))}
                    items={Object.fromEntries(WEEKDAYS.map((w) => [String(w.value), tSettings(w.key)]))}
                  >
                    <SelectTrigger id="wf-income-weekday" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((w) => (
                        <SelectItem key={w.value} value={String(w.value)}>
                          {tSettings(w.key)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        skip={{ label: t("skipButton"), onClick: onNext }}
        primary={{ label: t("continueButton"), onClick: submit, disabled: !valid, pending }}
      />
    </>
  );
}
