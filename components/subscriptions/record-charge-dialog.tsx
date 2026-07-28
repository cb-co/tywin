"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { estimateSettledAmount, CARD_FX_SPREAD } from "@/lib/subscriptions/charge";
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

/**
 * Asked only when the merchant's billing currency differs from the currency the
 * charge account settles in — the common case here being a dollar subscription
 * on a peso card.
 *
 * The field starts filled with an estimate, and that is deliberate rather than
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
  rates,
  onConfirm,
  pending,
  trigger,
}: {
  subscription: SubscriptionWithRefs;
  accountCurrency: string;
  rates: Record<string, number>;
  onConfirm: (settledAmount: number) => Promise<boolean>;
  pending: boolean;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("RecordCharge");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const estimate = estimateSettledAmount({
    subAmount: subscription.amount,
    subCurrency: subscription.currency,
    accountCurrency,
    rates,
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Re-seeded on each open rather than held, so a stale edit from a dialog
    // dismissed last week never becomes this month's charge. Empty when the
    // pair's rate is unknown — better than a figure invented from nothing.
    if (next) setAmount(estimate != null ? String(estimate) : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return;
    // Only on success. A failed save leaves the dialog open with the figure
    // still in it, rather than discarding what was typed.
    if (await onConfirm(value)) setOpen(false);
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
            {t("billedLine", {
              amount: formatMoney(subscription.amount, subscription.currency),
              account: subscription.account?.name ?? "",
              currency: accountCurrency,
            })}
          </p>

          <div className="space-y-2">
            <Label htmlFor="settled_amount">{t("chargedLabel")}</Label>
            <div className="relative">
              <Input
                id="settled_amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16"
                aria-describedby="settled_currency settled_hint"
                required
                autoFocus
                // Prefilled, and the usual reason for opening this is to replace
                // that figure with the real one — so select it rather than making
                // someone clear it first.
                onFocus={(e) => e.target.select()}
              />
              <span
                id="settled_currency"
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
              >
                {accountCurrency}
              </span>
            </div>

            {/* No "use this" button: the estimate is already in the field, so a
                control that fills it with the same number would do nothing.
                This just says where the number came from. */}
            <p id="settled_hint" className="text-xs text-muted-foreground">
              {estimate != null
                ? t("estimateHint", { percent: Math.round(CARD_FX_SPREAD * 100) })
                : t("noEstimateHint", { currency: accountCurrency })}
            </p>
          </div>

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
