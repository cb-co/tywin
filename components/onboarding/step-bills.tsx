"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Plus, Receipt } from "lucide-react";
import { createSubscription } from "@/app/(app)/recurring/actions";
import { BILL_PRESETS, billFromPreset, type BillPresetKey } from "@/lib/onboarding/bills";
import { SWATCHES } from "@/lib/palette";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyDisplay } from "@/components/ui/money-display";
import { cn } from "@/lib/utils";
import { AccountSelect, SavedRow, StepFooter, StepHeading } from "./parts";
import { isMainAccount, type StepProps } from "./types";

type Row = { name: string; amount: string; day: string; accountId: string; error?: string };

/**
 * Fixed monthly bills as recurring expense templates, picked from presets so
 * the common ones are a tap and an amount. They feed "safe to spend" and the
 * upcoming list; variable spending is what budgets and imports are for.
 * Loans are not here: they are accounts, one step back.
 */
export function StepBills({ data, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Bills can be paid from a card as easily as from the bank.
  const payFrom = data.accounts.filter((a) => isMainAccount(a) || a.type === "credit_card");
  const defaultAccount = payFrom[0]?.id ?? "";
  const [rows, setRows] = useState<Partial<Record<BillPresetKey, Row>>>({});

  const presetName = (key: BillPresetKey) => t(`billsPresets.${key}`);
  const saved = new Set(data.bills.map((b) => b.name.trim().toLowerCase()));
  const isSaved = (key: BillPresetKey) => key !== "other" && saved.has(presetName(key).toLowerCase());

  function toggle(key: BillPresetKey) {
    setRows((r) => {
      const next = { ...r };
      if (next[key]) delete next[key];
      else
        next[key] = {
          name: key === "other" ? "" : presetName(key),
          amount: "",
          day: "",
          accountId: defaultAccount,
        };
      return next;
    });
  }

  const update = (key: BillPresetKey, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [key]: { ...r[key]!, ...patch, error: undefined } }));

  const selected = BILL_PRESETS.filter((p) => rows[p.key]).map((p) => p.key);
  const rowValid = (r: Row) =>
    !!r.name.trim() && Number(r.amount) > 0 && (r.day === "" || (Number(r.day) >= 1 && Number(r.day) <= 31));
  const allValid = selected.every((k) => rowValid(rows[k]!));

  /* Saved one by one; whatever fails stays open with its error and whatever
     succeeds leaves the form, so a retry never creates a bill twice. */
  function save() {
    if (!allValid || pending) return;
    startTransition(async () => {
      let failed = false;
      for (const key of selected) {
        const r = rows[key]!;
        const currency = data.accounts.find((a) => a.id === r.accountId)?.currency ?? baseCurrency;
        const res = await createSubscription(
          billFromPreset({ preset: key, ...r, currency }, data.categories),
        );
        if (res.error) {
          failed = true;
          setRows((s) => ({ ...s, [key]: { ...s[key]!, error: res.error } }));
        } else {
          setRows((s) => {
            const next = { ...s };
            delete next[key];
            return next;
          });
        }
      }
      router.refresh();
      if (failed) toast.error(t("billsSaveFailed"));
      else onNext();
    });
  }

  return (
    <>
      <div className="space-y-5">
        <StepHeading title={t("billsTitle")} body={t("billsBody")} />

        {data.bills.length ? (
          <ul className="space-y-2">
            {data.bills.map((b) => (
              <SavedRow
                key={b.id}
                icon={Receipt}
                color={SWATCHES[5]}
                title={b.name}
                trailing={<MoneyDisplay amount={b.amount} currency={b.currency} size="inline" />}
              />
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {BILL_PRESETS.map(({ key }) => {
            const done = isSaved(key);
            const on = !!rows[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                disabled={done}
                onClick={() => toggle(key)}
                title={done ? t("billsSaved") : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:border-foreground/30",
                  done && "cursor-default opacity-50",
                )}
              >
                {on || done ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                {presetName(key)}
              </button>
            );
          })}
        </div>

        {selected.map((key) => {
          const r = rows[key]!;
          const currency = data.accounts.find((a) => a.id === r.accountId)?.currency ?? baseCurrency;
          return (
            <fieldset key={key} className="space-y-3 rounded-xl border bg-card p-4">
              <legend className="sr-only">{presetName(key)}</legend>
              {key === "other" ? (
                <div className="space-y-2">
                  <Label htmlFor={`wf-bill-${key}-name`}>{t("billNameLabel")}</Label>
                  <Input
                    id={`wf-bill-${key}-name`}
                    maxLength={60}
                    value={r.name}
                    placeholder={t("billNamePlaceholder")}
                    onChange={(e) => update(key, { name: e.target.value })}
                  />
                </div>
              ) : (
                <p className="text-sm font-semibold text-foreground">{r.name}</p>
              )}
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`wf-bill-${key}-amount`}>
                    {t("billAmountLabel")} ({currency})
                  </Label>
                  <Input
                    id={`wf-bill-${key}-amount`}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={r.amount}
                    placeholder="0.00"
                    onChange={(e) => update(key, { amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`wf-bill-${key}-day`}>{t("billDayLabel")}</Label>
                  <Input
                    id={`wf-bill-${key}-day`}
                    type="number"
                    min="1"
                    max="31"
                    inputMode="numeric"
                    value={r.day}
                    onChange={(e) => update(key, { day: e.target.value })}
                  />
                </div>
              </div>
              {payFrom.length > 1 ? (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`wf-bill-${key}-account`}>{t("billAccountLabel")}</Label>
                  <AccountSelect
                    id={`wf-bill-${key}-account`}
                    value={r.accountId}
                    onChange={(id) => update(key, { accountId: id })}
                    accounts={payFrom}
                  />
                </div>
              ) : null}
              {r.error ? <p className="text-xs text-destructive">{r.error}</p> : null}
            </fieldset>
          );
        })}
      </div>

      <StepFooter
        onBack={onBack}
        skip={
          selected.length || !data.bills.length
            ? { label: t("skipButton"), onClick: onNext }
            : undefined
        }
        primary={
          selected.length
            ? { label: t("billsSave"), onClick: save, disabled: !allValid, pending }
            : data.bills.length
              ? { label: t("continueButton"), onClick: onNext }
              : undefined
        }
      />
    </>
  );
}
