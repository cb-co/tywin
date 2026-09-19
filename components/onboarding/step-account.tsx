"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createAccount } from "@/app/(app)/accounts/actions";
import { ACCOUNT_TYPE_META, type AccountType } from "@/lib/accounts/meta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CurrencySelect, SavedRow, StepFooter, StepHeading } from "./parts";
import { isMainAccount, type StepProps } from "./types";

/** One plain balance account. Cards and loans have steps of their own. */
const STARTER_TYPES = ["checking", "savings", "cash", "investment"] as const;
type StarterType = (typeof STARTER_TYPES)[number];

export function StepAccount({ data, currencies, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const tType = useTranslations("AccountTypes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<StarterType>("checking");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [balance, setBalance] = useState("");

  /* Coming back to this step after the account exists must not offer a second
     one: it shows what was created, and editing happens on Accounts later. */
  const existing = data.accounts.filter(isMainAccount);

  function submit() {
    if (existing.length) return onNext();
    if (!name.trim() || pending) return;
    startTransition(async () => {
      const created = await createAccount({
        name: name.trim(),
        type,
        currency,
        starting_balance: Number(balance || 0),
        transfer_tax_rate: 0.002,
        network_fee_amount: 0,
        network_fee_optional: true,
        current_balance: 0,
      });
      if (created.error) return void toast.error(created.error);
      router.refresh();
      onNext();
    });
  }

  return (
    <>
      <div className="space-y-5">
        <StepHeading title={t("accountTitle")} body={t("accountBody")} />

        {existing.length ? (
          <>
            <ul className="space-y-2">
              {existing.map((a) => {
                const meta = ACCOUNT_TYPE_META[a.type as AccountType];
                return (
                  <SavedRow
                    key={a.id}
                    icon={meta.icon}
                    color={meta.color}
                    title={a.name}
                    subtitle={`${tType(a.type)} · ${a.currency}`}
                  />
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">{t("accountDone")}</p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t("accountTypeLabel")}</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
                {STARTER_TYPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={type === s}
                    onClick={() => setType(s)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      type === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tType(s)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-acct-name">{t("accountNameLabel")}</Label>
              <Input
                id="wf-acct-name"
                autoFocus
                value={name}
                maxLength={80}
                placeholder={t("accountNamePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="wf-acct-currency">{t("accountCurrencyLabel")}</Label>
                <CurrencySelect
                  id="wf-acct-currency"
                  value={currency}
                  onChange={setCurrency}
                  currencies={currencies}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-acct-balance">{t("accountBalanceLabel")}</Label>
                <Input
                  id="wf-acct-balance"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={balance}
                  placeholder="0.00"
                  onChange={(e) => setBalance(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        primary={{
          label: t("continueButton"),
          onClick: submit,
          disabled: !existing.length && !name.trim(),
          pending,
        }}
      />
    </>
  );
}
