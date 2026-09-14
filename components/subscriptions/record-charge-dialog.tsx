"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { estimateSettledAmount, CARD_FX_SPREAD } from "@/lib/subscriptions/charge";
import { estimateDestinationAmount } from "@/lib/subscriptions/template";
import type { SubscriptionWithRefs } from "@/lib/subscriptions/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type RecordAmounts = { settledAmount?: number; toAmount?: number };

/**
 * Asked only when recording needs a figure the template cannot hold, which is
 * whenever currencies differ:
 *
 *   - the template bills in one currency and its account settles in another
 *     (a dollar subscription on a peso card) — what actually left the account;
 *   - a payment's two accounts hold different currencies — what landed.
 *
 * Each field starts filled with an estimate, and that is deliberate rather than
 * lazy. The authorisation email arrives in the billing currency within seconds;
 * the converted figure is not known until the charge posts days later. Someone
 * recording a charge they just saw usually cannot supply the real number, so a
 * dialog that blocked without it would just be an obstacle. Filled means Record
 * is always one tap away.
 *
 * The estimate is computed, not remembered. A previous month's figure was
 * considered and rejected: the rate moves, so it would almost always be wrong
 * too, and being wrong in a way that looks authoritative ("last time: 962.10")
 * is worse than being wrong in a way that is labelled an estimate.
 */
export function RecordChargeDialog({
  subscription,
  accountCurrency,
  destinationCurrency,
  rates,
  onConfirm,
  pending,
  trigger,
}: {
  subscription: SubscriptionWithRefs;
  accountCurrency: string;
  /** Set only for a payment whose destination holds a different currency. */
  destinationCurrency: string | null;
  rates: Record<string, number>;
  onConfirm: (amounts: RecordAmounts) => Promise<boolean>;
  pending: boolean;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("RecordCharge");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  const asksSettled = subscription.currency !== accountCurrency;
  const settledEstimate = asksSettled
    ? estimateSettledAmount({
        subAmount: subscription.amount,
        subCurrency: subscription.currency,
        accountCurrency,
        rates,
      })
    : subscription.amount;

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Re-seeded on each open rather than held, so a stale edit from a dialog
    // dismissed last week never becomes this month's charge. Empty when the
    // pair's rate is unknown — better than a figure invented from nothing.
    if (!next) return;
    setAmount(settledEstimate != null ? String(settledEstimate) : "");
    const leg =
      destinationCurrency && settledEstimate != null
        ? estimateDestinationAmount({
            amount: settledEstimate,
            from: accountCurrency,
            to: destinationCurrency,
            rates,
          })
        : null;
    setToAmount(leg != null ? String(leg) : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const settled = Number(amount);
    const landed = Number(toAmount);
    if (asksSettled && !(settled > 0)) return;
    if (destinationCurrency && !(landed > 0)) return;
    // Only on success. A failed save leaves the dialog open with the figures
    // still in it, rather than discarding what was typed.
    const ok = await onConfirm({
      ...(asksSettled ? { settledAmount: settled } : {}),
      ...(destinationCurrency ? { toAmount: landed } : {}),
    });
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("title", { name: subscription.name })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {subscription.kind === "payment"
              ? t("paymentLine", {
                  amount: formatMoney(subscription.amount, subscription.currency),
                  account: subscription.account?.name ?? "",
                  to: subscription.to_account?.name ?? "",
                })
              : t("billedLine", {
                  amount: formatMoney(subscription.amount, subscription.currency),
                  account: subscription.account?.name ?? "",
                  currency: accountCurrency,
                })}
          </p>

          {asksSettled ? (
            <div className="space-y-2">
              <Label htmlFor="settled_amount">{t("chargedLabel")}</Label>
              <CurrencyInput
                id="settled_amount"
                currency={accountCurrency}
                value={amount}
                onChange={setAmount}
                describedBy="settled_hint"
                autoFocus
              />
              {/* No "use this" button: the estimate is already in the field, so a
                  control that fills it with the same number would do nothing.
                  This just says where the number came from. */}
              <p id="settled_hint" className="text-xs text-muted-foreground">
                {settledEstimate != null
                  ? t("estimateHint", { percent: Math.round(CARD_FX_SPREAD * 100) })
                  : t("noEstimateHint", { currency: accountCurrency })}
              </p>
            </div>
          ) : null}

          {destinationCurrency ? (
            <div className="space-y-2">
              <Label htmlFor="to_amount">
                {t("receivedLabel", { account: subscription.to_account?.name ?? "" })}
              </Label>
              <CurrencyInput
                id="to_amount"
                currency={destinationCurrency}
                value={toAmount}
                onChange={setToAmount}
                describedBy="to_amount_hint"
                autoFocus={!asksSettled}
              />
              <p id="to_amount_hint" className="text-xs text-muted-foreground">
                {t("receivedHint")}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending} isLoading={pending}>
              {t("submitButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CurrencyInput({
  id,
  currency,
  value,
  onChange,
  describedBy,
  autoFocus,
}: {
  id: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  describedBy: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-16"
        aria-describedby={`${id}_currency ${describedBy}`}
        required
        autoFocus={autoFocus}
        // Prefilled, and the usual reason for opening this is to replace that
        // figure with the real one — so select it rather than making someone
        // clear it first.
        onFocus={(e) => e.target.select()}
      />
      <span
        id={`${id}_currency`}
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        {currency}
      </span>
    </div>
  );
}
